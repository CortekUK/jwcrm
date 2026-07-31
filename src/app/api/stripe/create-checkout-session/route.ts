// DEPRECATED — nothing in the app calls this.
//
// It creates a checkout session for a caller-supplied amount and stores it as
// the proposal's payment link, which is exactly the frozen-amount behaviour
// that caused a part-paid invoice to be charged in full a second time. The
// payment path is now GET /api/pay/[proposalId], which resolves the
// outstanding balance at click time. Do not wire this route back up.

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/integrations/stripe/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, amount, currency = 'AED', leadEmail, leadName } = body;

    if (!proposalId || !amount || !leadEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: proposalId, amount, leadEmail' },
        { status: 400 }
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: leadEmail,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Just Wills - Legal Services',
              description: `Proposal for ${leadName || 'Client'}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects amount in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        proposalId,
        leadEmail,
        leadName: leadName || '',
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/cancelled`,
    });

    // Update proposal with Stripe session info
    const { error: updateError } = await supabaseAdmin
      .from('proposals')
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_link: session.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (updateError) {
      console.error('Error updating proposal with Stripe session:', updateError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
