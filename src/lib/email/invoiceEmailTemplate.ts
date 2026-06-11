import { companyDetails } from "@/config/company";

export type InvoiceEmailData = {
  invoiceNumber: string;
  invoiceDate: Date;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCompany?: string | null;
  amount: number;
  paymentUrl?: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Email-safe (table-based, inline styles) branded tax invoice that mirrors the
// JW Legal Consultants PDF / in-app preview. Designed to render in Gmail,
// Outlook and Apple Mail.
export function buildInvoiceEmailHTML(data: InvoiceEmailData): string {
  const subtotal = data.amount;
  const vat = subtotal * (companyDetails.vatRate / 100);
  const total = subtotal + vat;

  const cell = "padding:7px 9px;border:1px solid #000000;font-size:13px;color:#141414;";
  const cellC = cell + "text-align:center;";
  const labelCell = cell + "background-color:#dedede;font-weight:bold;";
  const labelCellC = labelCell + "text-align:center;";

  const addressLines = companyDetails.invoiceAddressLines
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");

  const notarization = companyDetails.notarizationNote
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");

  return `
  <div style="background-color:#f3f3f1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" align="center" style="width:640px;max-width:100%;margin:0 auto;background-color:#ffffff;border-collapse:collapse;">
      <!-- Brand band -->
      <tr>
        <td style="background-color:#0C5536;padding:18px 24px;text-align:center;">
          <div style="color:#C6A03B;font-size:22px;font-weight:bold;letter-spacing:0.5px;">${esc(companyDetails.legalName)}</div>
          <div style="color:#E6E6E4;font-size:12px;margin-top:4px;">${esc(companyDetails.invoiceCity)}</div>
        </td>
      </tr>

      <tr>
        <td style="padding:24px;">
          <!-- Title -->
          <div style="text-align:center;font-size:20px;font-weight:bold;color:#141414;margin-bottom:12px;">INVOICE</div>

          <!-- Header: company address -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #000000;background-color:#ececec;">
            <tr>
              <td style="padding:10px 12px;font-size:9px;line-height:1.5;color:#141414;text-align:right;">
                ${addressLines}
                <div>PHONE: ${esc(companyDetails.invoicePhone)}</div>
                <div>EMAIL: ${esc(companyDetails.invoiceEmail)}</div>
              </td>
            </tr>
          </table>

          <!-- Bill To / Invoice details -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td rowspan="3" width="52%" style="${cell}vertical-align:top;">
                <div style="font-weight:bold;margin-bottom:8px;">BILL TO:</div>
                <div style="font-weight:bold;font-size:14px;">${esc(data.clientName)}</div>
                ${data.clientEmail ? `<div style="font-size:11px;color:#5a5a5a;margin-top:4px;">${esc(data.clientEmail)}</div>` : ""}
                ${data.clientCompany ? `<div style="font-size:11px;color:#5a5a5a;">${esc(data.clientCompany)}</div>` : ""}
                ${data.clientPhone ? `<div style="font-size:11px;color:#5a5a5a;">${esc(data.clientPhone)}</div>` : ""}
              </td>
              <td width="18%" style="${labelCell}">Invoice No.</td>
              <td style="${cell}font-weight:bold;">${esc(data.invoiceNumber)}</td>
            </tr>
            <tr>
              <td style="${labelCell}">Date</td>
              <td style="${cell}">${fmtDate(data.invoiceDate)}</td>
            </tr>
            <tr>
              <td colspan="2" style="${cell}font-weight:bold;">Reference:&nbsp;&nbsp;${esc(data.clientName)}</td>
            </tr>
          </table>

          <!-- Line items -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:-1px;">
            <tr>
              <td width="62%" style="${labelCellC}">DESCRIPTION</td>
              <td width="16%" style="${labelCellC}">COST</td>
              <td width="22%" style="${labelCellC}">NET PRICE AED</td>
            </tr>
            <tr>
              <td style="${cell}font-weight:bold;height:54px;vertical-align:top;">Will (UAE)</td>
              <td style="${cellC}font-weight:bold;vertical-align:top;">X</td>
              <td style="${cellC}vertical-align:top;">${fmt(subtotal)}</td>
            </tr>
            <tr>
              <td style="${cell}height:54px;vertical-align:top;">
                <span style="font-weight:bold;">Notarization Fee </span>
                <span style="font-style:italic;color:#5a5a5a;font-size:11px;">(Includes legalization, PRO Services)</span>
                <div style="margin-top:6px;font-size:11px;">${notarization}</div>
              </td>
              <td style="${cellC}font-weight:bold;vertical-align:top;">X</td>
              <td style="${cell}"></td>
            </tr>
          </table>

          <!-- Bank details + totals -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:-1px;">
            <tr>
              <td rowspan="5" width="62%" style="${cell}vertical-align:top;font-size:12px;line-height:1.6;">
                <div>Please draw your cheque payable to:</div>
                <div style="font-weight:bold;">${esc(companyDetails.bank.payee)}</div>
                <div style="margin-top:8px;">
                  <div>Bank: ${esc(companyDetails.bank.name)}</div>
                  <div>Payee: ${esc(companyDetails.bank.payee)}</div>
                  <div>Account : ${esc(companyDetails.bank.account)}</div>
                  <div>Swift Code: ${esc(companyDetails.bank.swift)}</div>
                  <div>IBAN# ${esc(companyDetails.bank.iban)}</div>
                </div>
              </td>
              <td width="16%" style="${labelCellC}">SUB-TOTAL</td>
              <td width="22%" style="${cellC}font-weight:bold;">${fmt(subtotal)}</td>
            </tr>
            <tr>
              <td style="${labelCellC}">${companyDetails.vatRate}% VAT</td>
              <td style="${cellC}font-weight:bold;">${fmt(vat)}</td>
            </tr>
            <tr>
              <td style="${labelCellC}">TOTAL</td>
              <td style="${cellC}font-weight:bold;">${fmt(total)} AED</td>
            </tr>
            <tr>
              <td style="${labelCellC}font-size:11px;">PAYMENT REQUIRED INCL VAT</td>
              <td style="${cellC}font-weight:bold;">${fmt(total)} AED</td>
            </tr>
            <tr>
              <td style="${labelCellC}">BALANCE AMOUNT</td>
              <td style="${cellC}font-weight:bold;">${fmt(total)} AED</td>
            </tr>
          </table>

          <!-- TRN -->
          <table role="presentation" width="62%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:-1px;">
            <tr>
              <td style="${cell}background-color:#bebebe;text-align:center;padding:10px;">
                <div style="font-weight:bold;font-size:12px;">رقم التسجيل الضريبي / TRN#</div>
                <div style="font-weight:bold;font-size:15px;margin-top:4px;">${esc(companyDetails.trn)}</div>
              </td>
            </tr>
          </table>

          ${
            data.paymentUrl
              ? `<div style="text-align:center;margin:26px 0 6px;">
                  <a href="${data.paymentUrl}" style="background-color:#0C5536;color:#ffffff;padding:14px 38px;text-decoration:none;border-radius:5px;display:inline-block;font-size:16px;font-weight:bold;">Pay ${fmt(total)} AED Now</a>
                  <div style="color:#6B6B6B;font-size:12px;margin-top:10px;">Secure payment via Stripe. A PDF copy of this invoice is attached.</div>
                </div>`
              : `<div style="text-align:center;color:#6B6B6B;font-size:12px;margin-top:20px;">A PDF copy of this invoice is attached.</div>`
          }
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background-color:#222222;padding:16px 24px;text-align:center;">
          <div style="color:#E6E6E4;font-size:12px;">&copy; ${new Date().getFullYear()} ${esc(companyDetails.legalName)}. All rights reserved.</div>
          <div style="color:#9a9a9a;font-size:11px;margin-top:4px;">TRN: ${esc(companyDetails.trn)} &middot; ${esc(companyDetails.invoiceEmail)}</div>
        </td>
      </tr>
    </table>
  </div>`;
}
