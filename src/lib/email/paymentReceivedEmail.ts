// "We have your payment and we are starting work" — the email a client gets
// the moment their will-drafting fee lands.
//
// This used to be welded to the client portal: the ONLY message sent at this
// point was the portal welcome, which happened to mention the payment. So when
// portal provisioning was skipped — a staff address, an existing account, or
// the portal simply being switched off — the client heard nothing at all, even
// though they had just paid and work was starting.
//
// The confirmation is now the primary message and always goes out. Portal
// credentials, when there are any, ride along inside it rather than being the
// reason it exists.

import { companyDetails } from "@/config/company";
import { formatMoney } from "@/lib/finance/outstandingBalance";
import type { StageState } from "@/lib/finance/invoiceAmounts";

export type PaymentReceivedEmailData = {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string | null;
  currency: string;
  stageState: StageState;
  /** What this particular payment was for. */
  amountReceived: number;
  /** Present only when a portal account was created for this client. */
  portal?: {
    url: string;
    /** A new account's first password. */
    password?: string;
    /** An existing account gets a set-password link instead. */
    recoveryUrl?: string;
  } | null;
};

const BRAND = "#0C5536";
const GOLD = "#C6A03B";

export function buildPaymentReceivedSubject(data: PaymentReceivedEmailData): string {
  return data.stageState.fullySettled
    ? `${companyDetails.name} — payment received, thank you`
    : `${companyDetails.name} — payment received, we're starting your Will`;
}

export function buildPaymentReceivedEmailHTML(data: PaymentReceivedEmailData): string {
  const {
    clientName,
    clientEmail,
    invoiceNumber,
    currency,
    stageState,
    amountReceived,
    portal,
  } = data;

  const settled = stageState.fullySettled;
  const balanceDue = Math.max(0, stageState.balanceDue);

  const intro = settled
    ? `Thank you — we have received your payment of <strong>${formatMoney(
        amountReceived,
        currency
      )}</strong>, and your invoice is now settled in full.`
    : `Thank you — we have received your will drafting fee of <strong>${formatMoney(
        amountReceived,
        currency
      )}</strong>. We will now begin drafting your Will.`;

  // Only shown while money is genuinely outstanding. States the figure without
  // asserting when it falls due — that timing is the team's to communicate.
  const balanceBlock =
    !settled && balanceDue > 0
      ? `
      <div style="background-color:#FFF9E6;border:1px solid ${GOLD};border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px;color:#222222;font-size:14px;">
          <strong>Remaining balance: ${formatMoney(balanceDue, currency)}</strong>
        </p>
      </div>`
      : "";

  const portalBlock = portal
    ? `
      <div style="background-color:#ffffff;border:1px solid #E6E6E4;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="color:${BRAND};margin-top:0;font-size:15px;">Your Client Portal</h3>
        <p style="margin:0 0 10px;color:#444444;font-size:13px;">
          You can follow the progress of your Will here.
        </p>
        ${
          portal.password
            ? `<p style="margin:5px 0;"><strong>Email:</strong> ${clientEmail}</p>
               <p style="margin:5px 0;"><strong>Password:</strong> ${portal.password}</p>
               <p style="margin:10px 0 0;color:#6B6B6B;font-size:12px;">Please change your password after your first login.</p>`
            : portal.recoveryUrl
              ? `<p style="margin:5px 0;color:#444444;font-size:13px;">You already have an account with us under <strong>${clientEmail}</strong>. <a href="${portal.recoveryUrl}" style="color:${BRAND};">Set a new password</a>.</p>`
              : `<p style="margin:5px 0;color:#444444;font-size:13px;">Sign in with <strong>${clientEmail}</strong>.</p>`
        }
        <div style="text-align:center;margin:18px 0 4px;">
          <a href="${portal.url}" style="background-color:${BRAND};color:#ffffff;padding:11px 26px;text-decoration:none;border-radius:5px;display:inline-block;font-size:14px;">Access Client Portal</a>
        </div>
      </div>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color:${BRAND};padding:20px;text-align:center;">
        <h1 style="color:${GOLD};margin:0;">${companyDetails.name}</h1>
      </div>
      <div style="padding:30px;background-color:#FAFAF8;">
        <h2 style="color:${BRAND};margin-top:0;">Dear ${clientName || "Client"},</h2>
        <p style="color:#222222;line-height:1.6;">${intro}</p>
        ${invoiceNumber ? `<p style="color:#6B6B6B;font-size:13px;margin:4px 0 0;">Invoice ${invoiceNumber}</p>` : ""}
        ${balanceBlock}
        ${portalBlock}
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
