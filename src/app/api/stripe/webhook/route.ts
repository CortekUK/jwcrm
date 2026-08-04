import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/integrations/stripe/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';
import { invoiceTotalFor } from '@/lib/finance/outstandingBalance';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '@/config/email';

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

      // 2. Record the payment intent regardless of whether this clears the
      //    invoice — it is the audit trail for the charge that just happened.
      const { error: intentError } = await supabaseAdmin
        .from('proposals')
        .update({
          stripe_payment_intent_id: session.payment_intent as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposalId);

      if (intentError) {
        console.error('Error recording payment intent:', intentError);
        throw intentError;
      }

      // 3. Load the invoice so we can work out whether it is actually settled.
      const { data: proposal, error: fetchError } = await supabaseAdmin
        .from('proposals')
        .select('id, lead_id, amount, currency, line_items, status, paid_at')
        .eq('id', proposalId)
        .single();

      if (fetchError || !proposal) {
        console.error('Error fetching proposal:', fetchError);
        throw fetchError;
      }

      // 4. Is the invoice actually covered?
      //
      // A card payment may only be part of what is owed — the client pays the
      // drafting fee now and the court fees + VAT later. Marking the invoice
      // 'paid' on any successful charge is how a part-paid invoice used to
      // disappear from the outstanding list with money still owed on it.
      const { data: allPayments, error: paymentsReadError } = await supabaseAdmin
        .from('proposal_payments')
        .select('amount')
        .eq('proposal_id', proposalId);

      if (paymentsReadError) {
        console.error('Error reading payments:', paymentsReadError);
        throw paymentsReadError;
      }

      const totalPaid = (allPayments || []).reduce(
        (sum: number, p: { amount: number | string | null }) => sum + (Number(p.amount) || 0),
        0
      );
      // VAT-inclusive total, from the single source of truth.
      const invoiceTotal = invoiceTotalFor({
        id: proposal.id,
        amount: proposal.amount,
        currency: proposal.currency,
        line_items: proposal.line_items,
        status: proposal.status,
      });
      // Sub-cent remainders are rounding noise, not a debt.
      const fullyCovered = totalPaid >= invoiceTotal - 0.01;

      if (!fullyCovered) {
        // Part payment: the payment row above already moves the balance, and
        // that is all that should change. Status stays 'sent', paid_at stays
        // empty and the lead stays in its current pipeline stage — the work
        // has not been paid for yet.
        console.log(
          `Partial payment on proposal ${proposalId}: ${totalPaid} of ${invoiceTotal} — leaving status as '${proposal.status}'`
        );
        return NextResponse.json({ received: true, fullyCovered: false });
      }

      // 5. Settled in full — mark the invoice paid.
      const { error: proposalError } = await supabaseAdmin
        .from('proposals')
        .update({
          status: 'paid',
          // Keep the original settlement timestamp on a webhook retry.
          paid_at: proposal.paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposalId);

      if (proposalError) {
        console.error('Error updating proposal:', proposalError);
        throw proposalError;
      }

      // 6. Update lead status to 'won' and set payment fields
      const { error: leadError } = await supabaseAdmin
        .from('leads')
        .update({
          status: 'won',
          is_paid: true,
          paid_at: new Date().toISOString(),
          // Everything collected against this invoice, not just this charge —
          // a settled invoice may have been paid across several payments.
          paid_amount: totalPaid,
          paid_currency: proposal.currency || 'AED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposal.lead_id);

      if (leadError) {
        console.error('Error updating lead:', leadError);
        throw leadError;
      }

      // 7. Create client user in Supabase Auth
      //
      // Only reached when the invoice is settled in full. The welcome email
      // says "your payment has been received and your account is now ready",
      // which would be untrue — and would hand over portal access — while a
      // balance is still outstanding.
      if (!leadEmail) {
        // No address to create an account for or send credentials to. The
        // invoice is still correctly marked paid above.
        console.warn(`No leadEmail in session metadata for proposal ${proposalId}; skipping account creation`);
        return NextResponse.json({ received: true, fullyCovered: true });
      }

      const password = generatePassword();

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: leadEmail,
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

        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to: leadEmail,
            replyTo: EMAIL_REPLY_TO,
            subject: `Welcome to Just Wills - Your Account is Ready`,
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
