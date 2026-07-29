import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/integrations/stripe/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate a secure random password
function generatePassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { proposalId, leadEmail, leadName } = session.metadata || {};

    if (!proposalId) {
      console.error('No proposalId in session metadata');
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
    }

    try {
      // 1. Record the payment itself.
      //
      // The balance shown in the CRM is derived from proposal_payments, so a
      // card payment MUST land there — otherwise the invoice reads "paid"
      // while the balance line still shows the full amount outstanding.
      // session.amount_total is authoritative: it is what Stripe actually
      // charged, so a partial or adjusted payment is recorded accurately.
      const amountPaid = (session.amount_total ?? 0) / 100;
      if (amountPaid > 0) {
        const { error: paymentInsertError } = await supabaseAdmin
          .from('proposal_payments')
          .insert({
            proposal_id: proposalId,
            amount: amountPaid,
            method: 'stripe',
            notes: 'Paid online via payment link',
            // Stripe retries webhooks, so the session id keeps this insert
            // idempotent (unique index on external_reference).
            external_reference: session.id,
          });

        // 23505 = duplicate key: this event was already processed. Not an error.
        if (paymentInsertError && paymentInsertError.code !== '23505') {
          console.error('Error recording Stripe payment:', paymentInsertError);
          throw paymentInsertError;
        }
      }

      // 2. Update proposal status to 'paid'
      const { error: proposalError } = await supabaseAdmin
        .from('proposals')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposalId);

      if (proposalError) {
        console.error('Error updating proposal:', proposalError);
        throw proposalError;
      }

      // 3. Get the lead from the proposal
      const { data: proposal, error: fetchError } = await supabaseAdmin
        .from('proposals')
        .select('lead_id')
        .eq('id', proposalId)
        .single();

      if (fetchError || !proposal) {
        console.error('Error fetching proposal:', fetchError);
        throw fetchError;
      }

      // 4. Get the proposal amount for tracking
      const { data: proposalData, error: proposalDataError } = await supabaseAdmin
        .from('proposals')
        .select('amount, currency')
        .eq('id', proposalId)
        .single();

      if (proposalDataError) {
        console.error('Error fetching proposal data:', proposalDataError);
      }

      // 5. Update lead status to 'won' and set payment fields
      const { error: leadError } = await supabaseAdmin
        .from('leads')
        .update({
          status: 'won',
          is_paid: true,
          paid_at: new Date().toISOString(),
          paid_amount: proposalData?.amount || session.amount_total ? (session.amount_total as number) / 100 : null,
          paid_currency: proposalData?.currency || 'AED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposal.lead_id);

      if (leadError) {
        console.error('Error updating lead:', leadError);
        throw leadError;
      }

      // 6. Create client user in Supabase Auth
      const password = generatePassword();

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: leadEmail!,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: leadName || '',
          source: 'lead_conversion',
        },
      });

      if (authError) {
        // User might already exist
        if (authError.message.includes('already been registered')) {
          console.log('User already exists, skipping user creation');
        } else {
          console.error('Error creating auth user:', authError);
          throw authError;
        }
      } else if (authUser?.user) {
        // 7. Create profile for the new user
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            user_id: authUser.user.id,
            full_name: leadName || '',
            locale: 'en',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }

        // 6. Assign client role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: authUser.user.id,
            role: 'client',
          });

        if (roleError) {
          console.error('Error assigning role:', roleError);
        }

        // 7. Send welcome email with credentials
        const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/client`;

        // Test mode: all emails go to admin with original recipient in subject
        const adminEmail = process.env.ADMIN_EMAIL || 'aw736024@gmail.com';
        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
        const isTestMode = !process.env.PRODUCTION_EMAIL_MODE;

        const recipientEmail = isTestMode ? adminEmail : leadEmail!;
        const subjectPrefix = isTestMode ? `[Original: ${leadEmail}] ` : '';

        try {
          await resend.emails.send({
            from: fromEmail,
            to: recipientEmail,
            subject: `${subjectPrefix}Welcome to Just Wills - Your Account is Ready`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #0C5536; padding: 20px; text-align: center;">
                  <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
                </div>
                <div style="padding: 30px; background-color: #FAFAF8;">
                  <h2 style="color: #0C5536;">Welcome, ${leadName || 'Valued Client'}!</h2>
                  <p style="color: #222222; line-height: 1.6;">
                    Thank you for choosing Just Wills. Your payment has been received and your account is now ready.
                  </p>
                  <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #0C5536; margin-top: 0;">Your Login Credentials</h3>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${leadEmail}</p>
                    <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
                  </div>
                  <p style="color: #6B6B6B; font-size: 14px;">
                    Please change your password after your first login for security.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${portalUrl}" style="background-color: #0C5536; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                      Access Client Portal
                    </a>
                  </div>
                  <p style="color: #6B6B6B; font-size: 14px;">
                    If you have any questions, please don't hesitate to contact us.
                  </p>
                </div>
                <div style="background-color: #222222; padding: 15px; text-align: center;">
                  <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} Just Wills. All rights reserved.
                  </p>
                </div>
              </div>
            `,
          });
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Don't fail the webhook, just log the error
        }
      }

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  }

  // Return 200 for unhandled event types
  return NextResponse.json({ received: true });
}
