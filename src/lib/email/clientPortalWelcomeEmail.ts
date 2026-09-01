// The email a client receives when their portal account is opened.
//
// This used to be inline in the Stripe webhook and could only ever be sent on
// full settlement, so it said flatly "your payment has been received". The
// portal is now opened as soon as the will-drafting fee is covered, which means
// that sentence would be untrue for a client who still owes the court fees —
// and would read as a receipt for money we have not taken.
//
// So the copy branches on whether the invoice is actually settled.

import { companyDetails } from "@/config/company";
import { formatMoney } from "@/lib/finance/outstandingBalance";

export type PortalWelcomeEmailData = {
  leadName: string;
  leadEmail: string;
  portalUrl: string;
  /** Omitted when we are linking an account that already existed. */
  password?: string;
  /** Set instead of `password` for an existing account: a set-password link. */
  recoveryUrl?: string;
  fullySettled: boolean;
  amountReceived: number;
  balanceDue: number;
  currency: string;
  /** Where the client pays the rest — the balance-resolving link, never Stripe's. */
  payBalanceUrl?: string;
};

const BRAND = "#0C5536";
const GOLD = "#C6A03B";

export function buildPortalWelcomeSubject(data: PortalWelcomeEmailData): string {
  return data.fullySettled
    ? `Welcome to ${companyDetails.name} - Your Account is Ready`
    : `Welcome to ${companyDetails.name} - We've started work on your Will`;
}

export function buildPortalWelcomeEmailHTML(data: PortalWelcomeEmailData): string {
  const {
    leadName,
    leadEmail,
    portalUrl,
    password,
    recoveryUrl,
    fullySettled,
    amountReceived,
    balanceDue,
    currency,
    payBalanceUrl,
  } = data;

  const intro = fullySettled
    ? `Thank you for choosing ${companyDetails.name}. Your payment has been received in full and your account is now ready.`
    : `Thank you for choosing ${companyDetails.name}. We've received your will drafting fee of <strong>${formatMoney(
        amountReceived,
        currency
      )}</strong> and have begun work on your Will. Your client portal is now open so you can follow its progress.`;

  // Only shown while money is genuinely outstanding, and it links to the
  // balance resolver so it always asks for what is left at the time it is
  // clicked — never a stale amount frozen into the email.
  const balanceBlock =
    !fullySettled && balanceDue > 0
      ? `
        <div style="background-color:#FFF9E6;border:1px solid ${GOLD};border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;color:#222222;font-size:14px;">
            <strong>Remaining balance: ${formatMoney(balanceDue, currency)}</strong>
          </p>
          <p style="margin:0;color:#6B6B6B;font-size:13px;line-height:1.5;">
            This covers the court and notarization fees, and is payable at the
            court appointment stage. There is nothing to do right now — we will
            be in touch when your Will is ready to be registered.
          </p>
          ${
            payBalanceUrl
              ? `<p style="margin:12px 0 0;"><a href="${payBalanceUrl}" style="color:${BRAND};font-size:13px;">Pay the remaining balance</a></p>`
              : ""
          }
        </div>`
      : "";

  const credentialsBlock = password
    ? `
        <div style="background-color:#ffffff;border:1px solid #E6E6E4;border-radius:8px;padding:20px;margin:20px 0;">
          <h3 style="color:${BRAND};margin-top:0;">Your Login Credentials</h3>
          <p style="margin:5px 0;"><strong>Email:</strong> ${leadEmail}</p>
          <p style="margin:5px 0;"><strong>Password:</strong> ${password}</p>
        </div>
        <p style="color:#6B6B6B;font-size:14px;">
          Please change your password after your first login for security.
        </p>`
    : `
        <div style="background-color:#ffffff;border:1px solid #E6E6E4;border-radius:8px;padding:20px;margin:20px 0;">
          <h3 style="color:${BRAND};margin-top:0;">Signing In</h3>
          <p style="margin:5px 0;color:#222222;">
            You already have an account with us under <strong>${leadEmail}</strong>,
            so please sign in with your existing password.
          </p>
          ${
            recoveryUrl
              ? `<p style="margin:12px 0 0;"><a href="${recoveryUrl}" style="color:${BRAND};">Set a new password</a></p>`
              : ""
          }
        </div>`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color:${BRAND};padding:20px;text-align:center;">
        <h1 style="color:${GOLD};margin:0;">${companyDetails.name}</h1>
      </div>
      <div style="padding:30px;background-color:#FAFAF8;">
        <h2 style="color:${BRAND};">Welcome, ${leadName || "Valued Client"}!</h2>
        <p style="color:#222222;line-height:1.6;">${intro}</p>
        ${balanceBlock}
        ${credentialsBlock}
        <div style="text-align:center;margin:30px 0;">
          <a href="${portalUrl}" style="background-color:${BRAND};color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:5px;display:inline-block;">
            Access Client Portal
          </a>
        </div>
        <p style="color:#6B6B6B;font-size:14px;">
          If you have any questions, please don't hesitate to contact us.
        </p>
      </div>
      <div style="background-color:#222222;padding:15px;text-align:center;">
        <p style="color:#E6E6E4;margin:0;font-size:12px;">
          &copy; ${new Date().getFullYear()} ${companyDetails.name}. All rights reserved.
        </p>
      </div>
    </div>
  `;
}
