// HTML for the proposal email, lifted out of the send-proposal route.
//
// Two reasons it lives here rather than inline in the route:
//  - A Next.js route module may only export its HTTP handlers, so the builder
//    could not be rendered on its own for checking without sending an email.
//  - The court-choice variant (several registration courts offered, none
//    chosen yet) replaces the single total with per-court totals and the one
//    accept button with one per court, and that branching is easier to keep
//    honest in a pure function.
//
// When no choice is pending the output is exactly what the route produced
// before the move.

import { companyDetails } from "@/config/company";
import { lineItemCostLabel } from "@/lib/pdf/invoiceLineItems";
import type { InvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { COURT_LABELS, type CourtChoiceSummary } from "@/lib/lead-management/courtOptions";

export type ProposalEmailInput = {
  currency: string;
  invoiceNumber: string;
  accountManagerName: string;
  accountManagerEmail: string;
  /** The public accept PAGE — never the API route. */
  acceptUrl: string;
  /** The proposal's figures, from the saved row. */
  amounts: InvoiceAmounts;
  /**
   * Set only while the client still has a court to choose. Everything the
   * client is shown then comes from here instead of `amounts`, which (with no
   * court line yet) would present the fee without any government fee as if it
   * were the whole price.
   */
  courtChoice: CourtChoiceSummary | null;
  /** "AED 9,450.00", or "from AED 9,450.00" while a court choice is pending. */
  formattedAmount: string;
};

/**
 * The single-total figure used in the template variables and the subject
 * line. While a court choice is pending there is no single total, so it is the
 * cheapest option's, prefixed "from".
 */
export function proposalFormattedAmount(
  currency: string,
  amounts: InvoiceAmounts,
  courtChoice: CourtChoiceSummary | null
): string {
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  return courtChoice ? `from ${fmt(courtChoice.lowestTotal)}` : fmt(amounts.invoiceTotal);
}

const escHtml = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The structured blocks (reference, charges table, accept button, process
 * timeline). Used on both the template path and the hardcoded fallback, so a
 * template author edits the wording, never the itemised figures.
 */
export function buildProposalStructuredHtml(input: ProposalEmailInput): string {
  const {
    currency,
    invoiceNumber,
    accountManagerName,
    accountManagerEmail,
    acceptUrl,
    amounts,
    courtChoice,
    formattedAmount,
  } = input;
  const {
    subtotal: subtotalAmount,
    vatAmount,
    vatLabel,
    staged: rowStaged,
    upfrontTotal,
    laterTotal,
  } = amounts;

  // While a court is still to be chosen, the charges table lists only the part
  // that never varies; each court's fee is shown separately below it.
  const items = courtChoice ? courtChoice.baseItems : amounts.items;
  const staged = courtChoice ? courtChoice.staged : rowStaged;

  // Descriptions are multi-line now (the notarization row carries its fee
  // breakdown on its own lines), so escape first and only then turn the hard
  // line breaks into <br/> — the other order would let markup through.
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const itemRows = items
    .map(
      (item) => `
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; color: #222222; font-size: 13px;">${escHtml(item.description).replace(/\n/g, "<br/>")}${
                      // Say when each charge falls due, so the client can see
                      // which part of the total actually starts the work.
                      staged
                        ? `<div style="margin-top:4px;font-size:11px;font-style:italic;color:${
                            item.stage === "upfront" ? "#0C5536" : "#8a8a8a"
                          };">${item.stage === "upfront" ? "Payable upfront" : "At court appointment stage"}</div>`
                        : ""
                    }</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; text-align: center; color: #222222; font-size: 13px;">${lineItemCostLabel(item)}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(item.amount)}</td>
                  </tr>`
    )
    .join("");

  // Build the "What to Expect" process timeline block
  const timelineRows = companyDetails.processTimeline
    .map(
      (step) => `
                  <tr>
                    <td style="padding: 10px 12px 10px 0; vertical-align: top; white-space: nowrap; color: #0C5536; font-weight: bold; font-size: 13px;">${step.title}</td>
                    <td style="padding: 10px 0; color: #444444; font-size: 13px; line-height: 1.5;">${step.detail}</td>
                  </tr>`
    )
    .join("");

  if (courtChoice) {
    return buildCourtChoiceStructuredHtml({
      ...input,
      courtChoice,
      itemRows,
      timelineRows,
      fmtCurrency,
    });
  }

  return `
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Reference Number:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #222222;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Account Manager:</td>
                    <td style="padding: 8px 0; text-align: right; color: #222222;">
                      <span style="font-weight: bold;">${accountManagerName}</span><br/>
                      <a href="mailto:${accountManagerEmail}" style="color: #0C5536; font-size: 13px; text-decoration: none;">${accountManagerEmail}</a>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 14px;">Estimated Charges</h3>
                <!-- The items table and the totals table below are separate
                     tables, so they only line up if both declare the same
                     column widths. -->
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <colgroup><col style="width:58%"/><col style="width:14%"/><col style="width:28%"/></colgroup>
                  <thead>
                    <tr>
                      <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Description</th>
                      <th style="text-align: center; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Cost</th>
                      <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${itemRows}</tbody>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed;">
                  <colgroup><col style="width:58%"/><col style="width:14%"/><col style="width:28%"/></colgroup>
                  <tr>
                    <td colspan="2" style="padding: 4px 12px; color: #666666; font-size: 13px;">Sub-Total</td>
                    <td style="padding: 4px 12px; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(subtotalAmount)}</td>
                  </tr>
                  <tr>
                    <!-- vatLabel is already "5% VAT", or plain "VAT" when an
                         absolute override is in force — never re-derive it. -->
                    <td colspan="2" style="padding: 4px 12px; color: #666666; font-size: 13px;">${vatLabel}</td>
                    <td style="padding: 4px 12px; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(vatAmount)}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 8px 12px; color: #0C5536; font-weight: bold; font-size: 15px; border-top: 1px solid #E6E6E4;">Total Estimated Amount</td>
                    <td style="padding: 8px 12px; text-align: right; color: #0C5536; font-weight: bold; font-size: 15px; border-top: 1px solid #E6E6E4;">${formattedAmount}</td>
                  </tr>
                </table>
                ${
                  // The figure the client decides on: what it costs to start,
                  // versus what waits until the court date.
                  staged && laterTotal > 0
                    ? `<div style="margin-top:14px;background-color:#F4F8F5;border-left:3px solid #0C5536;border-radius:4px;padding:12px 14px;">
                        <div style="color:#0C5536;font-weight:bold;font-size:14px;">Payable now to begin drafting: ${fmtCurrency(upfrontTotal)}</div>
                        <div style="color:#6B6B6B;font-size:12px;margin-top:4px;">The remaining ${fmtCurrency(laterTotal)} is payable at the court appointment stage.</div>
                      </div>`
                    : ""
                }
              </div>
              <!-- The accept button. It links to a PAGE, not to the accept
                   API: Outlook ATP and other mail scanners fetch every link in
                   a delivered message, so a link that accepted on GET would
                   mark proposals accepted before the client opened the email.
                   The page shows the figures again and only its button posts. -->
              <div style="text-align: center; margin: 24px 0 8px 0;">
                <a href="${acceptUrl}" style="display: inline-block; background-color: #0C5536; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 6px;">
                  Accept this proposal
                </a>
                <div style="color: #6B6B6B; font-size: 12px; margin-top: 10px;">
                  No payment is taken on that page — accepting simply tells us you are happy to proceed,<br/>
                  and we will then send your invoice with a secure payment link.
                </div>
              </div>
              <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
                Prefer to reply by email? That works too — just let your account manager know.
              </p>
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 25px 0 10px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 16px;">What to Expect — Process Timeline</h3>
                <table style="width: 100%; border-collapse: collapse;">${timelineRows}</table>
              </div>`;
}

/**
 * The variant for a proposal offering two or three registration courts. There
 * is no single total until the client chooses, so instead of Sub-Total / VAT /
 * Total it shows the fixed part, then each court with the total the client
 * would pay if they chose it, and one button per court.
 */
function buildCourtChoiceStructuredHtml(
  input: ProposalEmailInput & {
    courtChoice: CourtChoiceSummary;
    itemRows: string;
    timelineRows: string;
    fmtCurrency: (n: number) => string;
  }
): string {
  const {
    invoiceNumber,
    accountManagerName,
    accountManagerEmail,
    acceptUrl,
    courtChoice,
    itemRows,
    timelineRows,
    fmtCurrency,
  } = input;

  const optionRows = courtChoice.options
    .map(
      ({ option, items, amounts }) => `
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; color: #222222; font-size: 13px;">${escHtml(option.description).replace(/\n/g, "<br/>")}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; text-align: center; color: #222222; font-size: 13px;">${lineItemCostLabel(items[items.length - 1])}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; text-align: right; color: #222222; font-size: 13px;">${fmtCurrency(option.amount)}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; text-align: right; color: #0C5536; font-weight: bold; font-size: 13px;">${fmtCurrency(amounts.invoiceTotal)}</td>
                  </tr>`
    )
    .join("");

  // One button per court, each to the same accept PAGE with the court
  // pre-selected. Still the page, never the API — see the note on the
  // single-button variant: mail scanners fetch every link in a message.
  const chooseButtons = courtChoice.options
    .map(
      ({ option }) => `
                <a href="${acceptUrl}?court=${option.court}" style="display: inline-block; background-color: #0C5536; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 24px; border-radius: 6px; margin: 4px;">
                  Choose ${COURT_LABELS[option.court]}
                </a>`
    )
    .join("");

  return `
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Reference Number:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #222222;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Account Manager:</td>
                    <td style="padding: 8px 0; text-align: right; color: #222222;">
                      <span style="font-weight: bold;">${accountManagerName}</span><br/>
                      <a href="mailto:${accountManagerEmail}" style="color: #0C5536; font-size: 13px; text-decoration: none;">${accountManagerEmail}</a>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 14px;">Estimated Charges</h3>
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <colgroup><col style="width:58%"/><col style="width:14%"/><col style="width:28%"/></colgroup>
                  <thead>
                    <tr>
                      <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Description</th>
                      <th style="text-align: center; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Cost</th>
                      <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${itemRows}</tbody>
                </table>
                <!-- No VAT or Total rows here: the total depends on the court,
                     so each court's total is given in the table below. -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed;">
                  <colgroup><col style="width:58%"/><col style="width:14%"/><col style="width:28%"/></colgroup>
                  <tr>
                    <td colspan="2" style="padding: 4px 12px; color: #666666; font-size: 13px;">Sub-Total (before government fee)</td>
                    <td style="padding: 4px 12px; text-align: right; color: #222222; font-size: 13px;">${fmtCurrency(courtChoice.baseSubtotal)}</td>
                  </tr>
                </table>
                <h3 style="color: #0C5536; margin: 22px 0 6px 0; font-size: 14px;">Registration court — please choose one</h3>
                <p style="color: #6B6B6B; font-size: 12px; margin: 0 0 10px 0;">
                  The government fee depends on the court that registers your Will. Only the court you choose is charged.
                </p>
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <colgroup><col style="width:40%"/><col style="width:12%"/><col style="width:22%"/><col style="width:26%"/></colgroup>
                  <thead>
                    <tr>
                      <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Court fee</th>
                      <th style="text-align: center; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Cost</th>
                      <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Amount</th>
                      <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Total incl. VAT if chosen</th>
                    </tr>
                  </thead>
                  <tbody>${optionRows}</tbody>
                </table>
                ${
                  // The court fee is always an at-court-stage charge, so the
                  // amount that starts the work is the same whichever court.
                  courtChoice.staged
                    ? `<div style="margin-top:14px;background-color:#F4F8F5;border-left:3px solid #0C5536;border-radius:4px;padding:12px 14px;">
                        <div style="color:#0C5536;font-weight:bold;font-size:14px;">Payable now to begin drafting: ${fmtCurrency(courtChoice.upfrontTotal)}</div>
                        <div style="color:#6B6B6B;font-size:12px;margin-top:4px;">The government fee for the court you choose, and the rest of the balance, is payable at the court appointment stage.</div>
                      </div>`
                    : ""
                }
              </div>
              <!-- One button per court, each opening the accept PAGE with that
                   court pre-selected. Never the accept API: mail scanners
                   fetch every link in a delivered message, and a link that
                   accepted on GET would choose and accept for the client. -->
              <div style="text-align: center; margin: 24px 0 8px 0;">${chooseButtons}
                <div style="color: #6B6B6B; font-size: 12px; margin-top: 10px;">
                  No payment is taken on that page — choosing your court and accepting simply tells us you are happy to proceed,<br/>
                  and we will then send your invoice with a secure payment link.
                </div>
              </div>
              <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
                Prefer to reply by email? That works too — just let your account manager know.
              </p>
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 25px 0 10px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 16px;">What to Expect — Process Timeline</h3>
                <table style="width: 100%; border-collapse: collapse;">${timelineRows}</table>
              </div>`;
}

/**
 * The whole email when the "Proposal Email" template is off or blank — the
 * original hardcoded builder, around the same structured blocks.
 */
export function buildDefaultProposalEmailHtml(input: {
  effectiveName: string;
  accountManagerName: string;
  accountManagerEmail: string;
  structuredHtml: string;
}): string {
  const { effectiveName, accountManagerName, accountManagerEmail, structuredHtml } = input;
  return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #0C5536; padding: 20px; text-align: center;">
              <h1 style="color: #C6A03B; margin: 0; font-size: 22px;">${companyDetails.legalName}</h1>
              <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Professional Will Drafting Services &middot; ${companyDetails.invoiceCity}</p>
            </div>
            <div style="padding: 30px; background-color: #FAFAF8;">
              <h2 style="color: #0C5536; margin-top: 0;">Dear ${effectiveName},</h2>
              <p style="color: #222222; line-height: 1.6;">
                Thank you for your interest in our services. Please find attached your <strong>Proposal</strong> for your review.
              </p>

              <!-- Same structured blocks the template path is given, rendered
                   from one builder so the two can never drift apart. -->
              ${structuredHtml}

              <p style="color: #444444; font-size: 14px; line-height: 1.6; margin: 18px 0 0 0;">
                If you have any questions, please contact <strong>${accountManagerName}</strong> at
                <a href="mailto:${accountManagerEmail}" style="color: #0C5536; text-decoration: none;">${accountManagerEmail}</a>.
              </p>
            </div>
            <div style="background-color: #222222; padding: 15px; text-align: center;">
              <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ${companyDetails.legalName}. All rights reserved.
              </p>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 11px;">
                TRN: ${companyDetails.trn} &middot; Questions? Contact us at ${companyDetails.invoiceEmail}
              </p>
            </div>
          </div>
        `;
}
