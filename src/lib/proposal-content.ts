// The standard proposal body, supplied verbatim by the client.
//
// It seeds the TipTap editor in SendProposalDialog, so a salesperson can adjust
// the wording for a particular client before sending — it is a default, not a
// lock.
//
// The fee table is NOT written into this text. The body cannot carry a real
// table: the editor has no table extension, and the PDF generator flattens HTML
// to plain text, which would reduce a <table> to a run of naked cell values.
// Instead the body carries FEE_TABLE_TOKEN, and each renderer splits on it and
// draws its own table from the invoice line items. Staff can move the token to
// reposition the table; they cannot corrupt the numbers.

/** Placeholder marking where the itemised fee table is drawn. */
export const FEE_TABLE_TOKEN = "{{FEE_TABLE}}";

/**
 * Split a proposal body around the fee table.
 *
 * Legacy proposals were saved before the token existed, so a body without one
 * renders whole and the caller falls back to drawing the table after it —
 * which is exactly what those proposals did before.
 */
export function splitAroundFeeTable(content: string): {
  before: string;
  after: string;
  hasToken: boolean;
} {
  const idx = content.indexOf(FEE_TABLE_TOKEN);
  if (idx === -1) return { before: content, after: "", hasToken: false };
  return {
    before: content.slice(0, idx),
    after: content.slice(idx + FEE_TABLE_TOKEN.length),
    hasToken: true,
  };
}

/**
 * Client's standard UAE Will proposal. Only the client name and the fee table
 * vary; everything else is their signed-off wording.
 */
export const DEFAULT_PROPOSAL_CONTENT = `
<p>Dear <strong>[Client Name]</strong>,</p>
<p>It was a pleasure to speak to you today. It is great that you are taking the next steps to plan ahead.</p>
<p>I have also included below the breakdown of the pricing to draft your Will and the associated court fees.</p>
<p>Should you have any questions or require clarification, please do not hesitate to reach out. I am here to support you with any queries.</p>
<p>${FEE_TABLE_TOKEN}</p>
<p><strong>TIME-LINE OF WORK – FOR UAE WILL</strong></p>
<p><strong>Stage 1</strong> – Understanding your Wishes and Beneficiaries level</p>
<p><strong>Stage 2</strong> - Drafting of Will</p>
<p><strong>Stage 3</strong> – Approval from Client (A draft will be sent to you for your understanding prior to the Arabic translation, you can make changes if you desire)</p>
<p><strong>Stage 4</strong> – Arabic translation &amp; legal stamping</p>
<p><strong>Stage 5</strong> – Finalizing the schedule with Abu Dhabi judge for documents stamping as per your preferred date &amp; time</p>
<p><strong>Note: The Will covers the below:</strong></p>
<ul>
  <li>UAE assets</li>
  <li>Guardianship for minor children, which can be split into 3 different types: Temporary Guardian, Permanent Guardian, and a Financial Guardian</li>
  <li>Any current and future assets in your name up until the day of passing, such as Companies/ Bank accounts/ Properties</li>
  <li>There are no renewal fees and valid for as long as you need it to be</li>
</ul>
<p>Let me know what you would like to do.</p>
<p>Best Regards,</p>
`;
