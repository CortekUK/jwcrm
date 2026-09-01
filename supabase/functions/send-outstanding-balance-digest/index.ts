// Weekly digest of invoices that still have money owed.
//
// Clients often pay the drafting fee up front and the court fees + VAT later.
// The invoice stays open in the CRM, but nothing used to chase it — the team
// tracked it on a spreadsheet and had to remember at the court date. This
// sends one email a week listing every open balance, largest first, so a
// part-paid invoice cannot go quiet.
//
// Internal only: this never emails the client. It goes to the team so a person
// decides how and when to chase.

import { Resend } from 'npm:resend@6.1.3';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';
import { getAdminFallbackEmail } from '../_shared/accountManager.ts';
import { computeInvoiceAmounts, DEFAULT_VAT_RATE } from '../_shared/invoiceAmounts.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Recipient is configured from the finance dashboard (system_settings),
    // so it can be changed without a redeploy. Env vars remain the fallback,
    // which means a missing/blank setting can never lose the digest.
    const { data: settingRow } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'finance_outstanding_digest')
      .maybeSingle();

    const setting = (settingRow?.setting_value ?? {}) as {
      enabled?: boolean;
      recipient_email?: string;
      recipient_name?: string;
    };

    // Explicitly disabled from the dashboard — do no work and send nothing.
    if (setting.enabled === false) {
      console.log('Outstanding balance digest is disabled in settings.');
      return new Response(
        JSON.stringify({ success: true, message: 'Digest disabled in settings', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payable invoices only: a proposal without invoiced_at is informational,
    // so nobody owes anything on it yet.
    const { data: proposals, error: proposalError } = await supabase
      .from('proposals')
      // vat_rate/vat_amount are required: VAT is set per invoice now, so
      // assuming the default here would quote a balance the client never saw.
      .select('id, amount, currency, line_items, status, invoice_number, invoiced_at, vat_rate, vat_amount, lead:leads(full_name, email)')
      .not('invoiced_at', 'is', null)
      .not('status', 'in', '(paid,cancelled)');
    if (proposalError) throw proposalError;

    const { data: payments, error: paymentError } = await supabase
      .from('proposal_payments')
      .select('proposal_id, amount');
    if (paymentError) throw paymentError;

    const paidByProposal = new Map<string, number>();
    for (const p of payments || []) {
      paidByProposal.set(
        p.proposal_id,
        (paidByProposal.get(p.proposal_id) || 0) + (Number(p.amount) || 0)
      );
    }

    const outstanding = (proposals || [])
      .map((proposal: any) => {
        const amounts = computeInvoiceAmounts(proposal, DEFAULT_VAT_RATE);
        const totalPaid = paidByProposal.get(proposal.id) || 0;
        // Whether the drafting fee itself is still unpaid decides how urgent
        // this row is: work has not started, versus work underway and only the
        // court fees pending.
        const awaitingUpfront =
          amounts.staged && totalPaid < amounts.upfrontTotal - 0.01;
        return {
          invoiceNumber: proposal.invoice_number || '—',
          clientName: proposal.lead?.full_name || 'Unknown client',
          currency: proposal.currency || 'AED',
          invoiceTotal: amounts.invoiceTotal,
          totalPaid,
          balanceDue: amounts.invoiceTotal - totalPaid,
          partiallyPaid: totalPaid > 0,
          staged: amounts.staged,
          awaitingUpfront,
          // What we would ask for right now, which on a staged invoice is the
          // drafting fee rather than the whole balance.
          amountDueNow: awaitingUpfront
            ? amounts.upfrontTotal - totalPaid
            : amounts.invoiceTotal - totalPaid,
        };
      })
      // Sub-cent remainders are rounding noise, not a debt.
      .filter((i) => i.balanceDue >= 0.01)
      .sort((a, b) => b.balanceDue - a.balanceDue);

    if (outstanding.length === 0) {
      console.log('No outstanding balances — digest not sent.');
      return new Response(
        JSON.stringify({ success: true, message: 'Nothing outstanding, no email sent', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currency = outstanding[0].currency;
    const totalOwed = outstanding.reduce((sum, i) => sum + i.balanceDue, 0);

    const rows = outstanding
      .map(
        (i) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #EEE;color:#222;">
            ${i.clientName}
            ${i.partiallyPaid ? '<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:10px;background:#F6EBD0;color:#8B6914;font-size:11px;">part paid</span>' : ''}
            ${i.awaitingUpfront ? '<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:10px;background:#FDE8E8;color:#9B2C2C;font-size:11px;">drafting fee unpaid</span>' : ''}
            ${i.staged && !i.awaitingUpfront ? '<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:10px;background:#E6F0FF;color:#2563EB;font-size:11px;">court fees pending</span>' : ''}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #EEE;color:#777;">${i.invoiceNumber}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #EEE;text-align:right;color:#555;">${money(i.invoiceTotal, i.currency)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #EEE;text-align:right;color:#0A7C42;">${money(i.totalPaid, i.currency)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #EEE;text-align:right;font-weight:bold;color:#C6A03B;">${money(i.balanceDue, i.currency)}</td>
        </tr>`
      )
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#0C5536 0%,#128277 100%);padding:24px 20px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Outstanding Balances</h1>
          <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px;">Weekly summary of invoices with money still owed</p>
        </div>
        <div style="padding:24px 20px;border:1px solid #E6E6E4;border-top:none;">
          <p style="margin:0 0 4px;color:#555;font-size:13px;">Total outstanding</p>
          <p style="margin:0 0 20px;color:#C6A03B;font-size:26px;font-weight:bold;">${money(totalOwed, currency)}</p>
          <p style="margin:0 0 12px;color:#333;font-size:14px;">
            ${outstanding.length} invoice${outstanding.length === 1 ? '' : 's'} still ${outstanding.length === 1 ? 'has' : 'have'} a balance owing.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="text-align:left;color:#555;">
                <th style="padding:8px;border-bottom:2px solid #E6E6E4;">Client</th>
                <th style="padding:8px;border-bottom:2px solid #E6E6E4;">Invoice</th>
                <th style="padding:8px;border-bottom:2px solid #E6E6E4;text-align:right;">Total</th>
                <th style="padding:8px;border-bottom:2px solid #E6E6E4;text-align:right;">Paid</th>
                <th style="padding:8px;border-bottom:2px solid #E6E6E4;text-align:right;">Outstanding</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:18px 0 0;color:#777;font-size:11px;">
            Totals include VAT at the rate set on each invoice, matching the amount shown on the client's copy.
            This is an internal summary — no reminder has been sent to any client.
          </p>
        </div>
      </div>`;

    const financeEmail =
      (setting.recipient_email || '').trim() ||
      (Deno.env.get('FINANCE_EMAIL') || '').trim() ||
      getAdminFallbackEmail();
    const baseSubject = `Outstanding balances — ${money(totalOwed, currency)} across ${outstanding.length} invoice${outstanding.length === 1 ? '' : 's'}`;

    const resend = new Resend(resendApiKey);
    const { data: emailData, error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: financeEmail,
      replyTo: EMAIL_REPLY_TO,
      subject: baseSubject,
      html,
    });

    if (sendError) throw new Error(`Failed to send digest: ${sendError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Outstanding balance digest sent',
        emailId: emailData?.id,
        count: outstanding.length,
        totalOutstanding: totalOwed,
        routedTo: financeEmail,
        recipientSource: (setting.recipient_email || '').trim() ? 'dashboard setting' : 'environment fallback',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending outstanding balance digest:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
