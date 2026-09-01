// A short, client-facing "here is what is due now" email.
//
// A staged invoice is collected in two goes: the drafting fee to start work,
// then the court and notarization fees at the court appointment stage — weeks
// later. Without this, asking for the second instalment meant telling the
// client to scroll back to an invoice email from weeks ago and press its
// button again. The link resolves the live balance, so it is always right, but
// nobody should have to go hunting for it.
//
// Deliberately not a second copy of the invoice: the invoice has already been
// issued and its number is unchanged. This is a reminder pointing at it.

import { companyDetails } from "@/config/company";
import { formatMoney } from "@/lib/finance/outstandingBalance";
import type { StageState } from "@/lib/finance/invoiceAmounts";

export type PaymentRequestEmailData = {
  clientName: string;
  invoiceNumber: string | null;
  currency: string;
  stageState: StageState;
  /** The /api/pay/[proposalId] resolver — never a frozen Stripe URL. */
  paymentUrl: string;
  /** Optional line the sender can add from the dialog. */
  message?: string | null;
  contactName?: string | null;
};

const BRAND = "#0C5536";
const GOLD = "#C6A03B";

export function buildPaymentRequestSubject(data: PaymentRequestEmailData): string {
  const ref = data.invoiceNumber ? ` ${data.invoiceNumber}` : "";
  return data.stageState.stage === "upfront"
    ? `${companyDetails.name} — will drafting fee for invoice${ref}`
    : `${companyDetails.name} — remaining balance for invoice${ref}`;
}

export function buildPaymentRequestEmailHTML(data: PaymentRequestEmailData): string {
  const { clientName, invoiceNumber, currency, stageState, paymentUrl, message } = data;
  const { amounts } = stageState;
  const dueNow = formatMoney(stageState.amountDue, currency);

  // The two stages need genuinely different explanations: one is "pay this so
  // we can start", the other is "the work is done, here is the rest".
  const intro =
    stageState.stage === "upfront"
      ? `Thank you for choosing ${companyDetails.name}. To begin drafting your Will, the drafting fee below is payable now. The court and notarization fees follow later, at the court appointment stage.`
      : `Your Will is progressing, and the remaining balance on your invoice is now payable. This covers the court and notarization fees.`;

  const breakdown =
    amounts.staged && stageState.stage === "remainder"
      ? `
        <table style="width:100%;border-collapse:collapse;margin:8px 0 0;font-size:13px;color:#555555;">
          <tr>
            <td style="padding:4px 0;">Invoice total</td>
            <td style="padding:4px 0;text-align:right;">${formatMoney(amounts.invoiceTotal, currency)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;">Already received</td>
            <td style="padding:4px 0;text-align:right;color:#0A7C42;">${formatMoney(stageState.totalPaid, currency)}</td>
          </tr>
        </table>`
      : "";

  const senderNote = message
    ? `<p style="color:#222222;line-height:1.6;margin:16px 0 0;">${message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")}</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color:${BRAND};padding:20px;text-align:center;">
        <h1 style="color:${GOLD};margin:0;">${companyDetails.name}</h1>
      </div>
      <div style="padding:30px;background-color:#FAFAF8;">
        <h2 style="color:${BRAND};margin-top:0;">Dear ${clientName || "Client"},</h2>
        <p style="color:#222222;line-height:1.6;">${intro}</p>
        ${senderNote}

        <div style="background-color:#ffffff;border:1px solid #E6E6E4;border-radius:8px;padding:20px;margin:22px 0;text-align:center;">
          <div style="color:#6B6B6B;font-size:13px;">Amount payable now</div>
          <div style="color:${BRAND};font-size:26px;font-weight:bold;margin:6px 0 2px;">${dueNow}</div>
          ${
            invoiceNumber
              ? `<div style="color:#9a9a9a;font-size:12px;">Invoice ${invoiceNumber}</div>`
              : ""
          }
          ${breakdown}
        </div>

        <div style="text-align:center;margin:26px 0 6px;">
          <a href="${paymentUrl}" style="background-color:${BRAND};color:#ffffff;padding:14px 38px;text-decoration:none;border-radius:5px;display:inline-block;font-size:16px;font-weight:bold;">Pay ${dueNow} Now</a>
          <div style="color:#6B6B6B;font-size:12px;margin-top:10px;">
            Secure payment via Stripe. The link always charges the amount outstanding at the time you open it.
          </div>
        </div>

        <p style="color:#6B6B6B;font-size:13px;margin-top:24px;">
          If you have any questions, simply reply to this email.
        </p>
      </div>
      <div style="background-color:#222222;padding:16px 24px;text-align:center;">
        <div style="color:#E6E6E4;font-size:12px;">&copy; ${new Date().getFullYear()} ${companyDetails.legalName}. All rights reserved.</div>
        <div style="color:#9a9a9a;font-size:11px;margin-top:4px;">TRN: ${companyDetails.trn} &middot; ${companyDetails.invoiceEmail}</div>
      </div>
    </div>
  `;
}
