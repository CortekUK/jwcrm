/**
 * Fixed proposal template for will-drafting services.
 * This template is used for the quick proposal flow where only the price varies.
 */

export interface ProposalTemplateData {
  clientName: string;
  price: number;
  currency: string;
  invoiceNumber: string;
  dueDate: Date;
  validUntil: Date;
}

/**
 * Generates the proposal HTML content from the fixed template.
 * Only the price and client details are dynamic - the rest is standardized.
 */
export function generateProposalContent(data: ProposalTemplateData): string {
  const formattedPrice = new Intl.NumberFormat("en-AE", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(data.price);

  const formattedDueDate = data.dueDate.toLocaleDateString("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedValidUntil = data.validUntil.toLocaleDateString("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<p>Dear <strong>${data.clientName}</strong>,</p>

<p>Thank you for your recent consultation with Just Wills. We are pleased to present this proposal for our professional will drafting services.</p>

<h3>Service: Professional Will Drafting</h3>

<p><strong>Scope of Services:</strong></p>
<ul>
  <li>Comprehensive will drafting tailored to your requirements</li>
  <li>Legal consultation and guidance throughout the process</li>
  <li>Document preparation and thorough review</li>
  <li>Secure storage and management of your will</li>
  <li>Future amendments consultation</li>
</ul>

<p><strong>Investment:</strong></p>
<table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
  <tr>
    <td style="padding: 10px; border: 1px solid #E6E6E4;">Professional Will Drafting Services</td>
    <td style="padding: 10px; border: 1px solid #E6E6E4; text-align: right; font-weight: bold;">${data.currency} ${formattedPrice}</td>
  </tr>
  <tr style="background-color: #FAFAF8;">
    <td style="padding: 10px; border: 1px solid #E6E6E4; font-weight: bold;">Total Amount Due</td>
    <td style="padding: 10px; border: 1px solid #E6E6E4; text-align: right; font-weight: bold; color: #0C5536;">${data.currency} ${formattedPrice}</td>
  </tr>
</table>

<p><strong>Terms and Conditions:</strong></p>
<ol>
  <li>Payment is due upon acceptance of this proposal</li>
  <li>Services will commence upon receipt of payment</li>
  <li>All information provided will be kept strictly confidential</li>
  <li>This proposal is valid until ${formattedValidUntil}</li>
</ol>

<p><strong>Payment Due Date:</strong> ${formattedDueDate}</p>

<p>We look forward to assisting you with your estate planning needs. Should you have any questions, please do not hesitate to contact us.</p>

<p>Best regards,<br/><strong>Just Wills Team</strong></p>
`.trim();
}

/**
 * Generates a simple text summary for activity logs
 */
export function generateProposalSummary(data: {
  clientName: string;
  price: number;
  currency: string;
  invoiceNumber: string;
}): string {
  const formattedPrice = new Intl.NumberFormat("en-AE", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(data.price);

  return `Proposal ${data.invoiceNumber} for ${data.currency} ${formattedPrice} sent to ${data.clientName}`;
}
