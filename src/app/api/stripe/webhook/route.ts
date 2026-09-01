import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/integrations/stripe/server';
import { createClient } from '@supabase/supabase-js';
import { applyPaymentSideEffects } from '@/lib/finance/applyPaymentSideEffects';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      // charged, so a staged or adjusted payment is recorded accurately.
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

      // 3. Everything else — settling the invoice, moving the lead, opening the
      //    client portal — is shared with the manual "record payment" path so a
      //    bank transfer produces exactly the same outcome as a card payment.
      //    It decides for itself whether this payment covered the drafting fee,
      //    the whole invoice, or neither.
      const result = await applyPaymentSideEffects(supabaseAdmin, proposalId, {
        trigger: 'stripe',
        leadEmailFallback: leadEmail,
        leadNameFallback: leadName,
      });

      if (!result.ok) {
        console.error('Post-payment processing failed:', result.error);
        throw new Error(result.error);
      }

      if (!result.stageState.fullySettled) {
        console.log(
          `Partial payment on proposal ${proposalId}: ${result.stageState.totalPaid} of ` +
            `${result.stageState.amounts.invoiceTotal} — invoice stays open ` +
            `(portal: ${result.provisioned.status})`
        );
      }

      return NextResponse.json({
        received: true,
        fullyCovered: result.stageState.fullySettled,
        stage: result.stageState.stage,
        portal: result.provisioned.status,
      });
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
