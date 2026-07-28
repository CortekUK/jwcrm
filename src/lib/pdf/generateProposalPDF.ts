import { jsPDF } from "jspdf";
import { companyDetails } from "@/config/company";
import { normalizeLineItems, lineItemsSubtotal, type InvoiceLineItem } from "./invoiceLineItems";

export type ProposalData = {
  invoiceNumber: string;
  proposalDate: Date;
  validUntil: Date;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientCompany?: string | null;
  amount: number;
  currency: string;
  proposalContent: string; // HTML content from TipTap
  lineItems?: InvoiceLineItem[]; // itemised charges (drafting, court fee, MOJ stamps, etc.)
};

// Colors
const PRIMARY_COLOR: [number, number, number] = [12, 85, 54]; // #0C5536
const GOLD_COLOR: [number, number, number] = [198, 160, 59]; // #C6A03B
const TEXT_COLOR: [number, number, number] = [34, 34, 34]; // #222222
const GRAY_COLOR: [number, number, number] = [102, 102, 102]; // #666666
const LIGHT_GRAY: [number, number, number] = [250, 250, 248]; // #FAFAF8

// Strip HTML tags and convert to plain text with basic formatting
function htmlToPlainText(html: string): string[] {
  let listCounter = 0;
  let inOrderedList = false;

  // Process ordered lists with numbering
  let text = html
    // Track ordered list context
    .replace(/<ol[^>]*>/gi, () => { inOrderedList = true; listCounter = 0; return ""; })
    .replace(/<\/ol>/gi, () => { inOrderedList = false; return "\n"; })
    // Track unordered list context
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/ul>/gi, "\n")
    // Handle list items with proper bullets/numbers
    .replace(/<li[^>]*>/gi, () => {
      if (inOrderedList) {
        listCounter++;
        return `  ${listCounter}. `;
      }
      return "  \u2022 "; // Bullet character
    })
    .replace(/<\/li>/gi, "\n")
    // Handle other elements
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "") // Remove remaining HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
    .trim();

  return text.split("\n");
}

export function generateProposalPDF(data: ProposalData): string {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: data.currency,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  // ========== HEADER SECTION ==========
  // Green header background
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(companyDetails.name.toUpperCase(), margin, 18);

  // Tagline
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD_COLOR);
  doc.text("Professional Will Drafting Services", margin, 26);

  // Company details
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`${companyDetails.email} | ${companyDetails.website}`, margin, 38);

  // PROPOSAL title on right
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD_COLOR);
  doc.text("PROPOSAL", pageWidth - margin, 22, { align: "right" });

  // Proposal number below title
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Ref: ${data.invoiceNumber}`, pageWidth - margin, 32, { align: "right" });

  y = 55;

  // ========== PROPOSAL INFO & CLIENT SECTION ==========
  // Two column layout
  const leftColWidth = (pageWidth - 2 * margin - 10) / 2;
  const rightColX = margin + leftColWidth + 10;

  // Left column - Proposal Details
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, leftColWidth, 40, 3, 3, "F");

  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PROPOSAL DETAILS", margin + 5, y + 8);

  doc.setTextColor(...GRAY_COLOR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Date:", margin + 5, y + 17);
  doc.text("Valid Until:", margin + 5, y + 24);
  doc.text("Amount:", margin + 5, y + 31);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(data.proposalDate), margin + 35, y + 17);
  doc.text(formatDate(data.validUntil), margin + 35, y + 24);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(11);
  doc.text(formatCurrency(data.amount), margin + 35, y + 31);

  // Right column - Client Details
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(rightColX, y, leftColWidth, 40, 3, 3, "F");

  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PREPARED FOR", rightColX + 5, y + 8);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(11);
  doc.text(data.clientName, rightColX + 5, y + 18);

  doc.setTextColor(...GRAY_COLOR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientEmail, rightColX + 5, y + 25);

  if (data.clientPhone) {
    doc.text(data.clientPhone, rightColX + 5, y + 31);
  }
  if (data.clientCompany) {
    doc.text(data.clientCompany, rightColX + 5, y + 37);
  }

  y += 50;

  // ========== SERVICE AGREEMENT SECTION ==========
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(margin, y, pageWidth - 2 * margin, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE AGREEMENT", margin + 5, y + 6);

  y += 15;

  // Parse HTML content to plain text
  const contentLines = htmlToPlainText(data.proposalContent);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const lineHeight = 5;
  const maxWidth = pageWidth - 2 * margin - 10;

  for (const line of contentLines) {
    if (line.trim() === "") {
      y += 3; // Smaller gap for empty lines
      continue;
    }

    // Check if we need a new page
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    // Check if line starts with bullet point
    const isBullet = line.trim().startsWith("-") || line.trim().startsWith("•");

    // Split long lines
    const wrappedLines = doc.splitTextToSize(line, maxWidth);

    for (const wrappedLine of wrappedLines) {
      doc.text(wrappedLine, margin + 5, y);
      y += lineHeight;
    }
  }

  y += 10;

  // ========== PAYMENT TERMS SECTION ==========
  // Check if we need a new page
  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 30, 3, 3, "F");

  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT TERMS", margin + 5, y + 8);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Payment is due upon acceptance of this proposal.", margin + 5, y + 16);
  doc.text("To accept this proposal and proceed with payment, please use the secure payment", margin + 5, y + 22);
  doc.text("link provided in your email.", margin + 5, y + 28);

  y += 40;

  // ========== ITEMISED CHARGES ==========
  const items = normalizeLineItems(data.lineItems, data.amount);
  const subtotal = lineItemsSubtotal(items);
  const vatAmount = subtotal * (companyDetails.vatRate / 100);
  const total = subtotal + vatAmount;

  if (y > pageHeight - 60 - items.length * 8) {
    doc.addPage();
    y = margin;
  }

  const tableX = margin;
  const tableW = pageWidth - 2 * margin;
  const descColW = tableW * 0.7;
  const amountColW = tableW - descColW;
  const rowH = 8;

  // Header row
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(tableX, y, tableW, rowH, "F");
  doc.setDrawColor(...GOLD_COLOR);
  doc.setLineWidth(0.3);
  doc.rect(tableX, y, tableW, rowH);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", tableX + 4, y + 5.5);
  doc.text("AMOUNT", tableX + tableW - 4, y + 5.5, { align: "right" });
  y += rowH;

  // Item rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  for (const item of items) {
    doc.setDrawColor(220, 220, 218);
    doc.rect(tableX, y, tableW, rowH);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(doc.splitTextToSize(item.description, descColW - 8)[0], tableX + 4, y + 5.5);
    doc.text(formatCurrency(item.amount), tableX + tableW - 4, y + 5.5, { align: "right" });
    y += rowH;
  }

  y += 4;

  // Totals block
  const totalsX = tableX + descColW;
  const drawTotalRow = (label: string, value: string, emphasize = false) => {
    doc.setFontSize(emphasize ? 11 : 9.5);
    doc.setFont("helvetica", emphasize ? "bold" : "normal");
    doc.setTextColor(...(emphasize ? PRIMARY_COLOR : GRAY_COLOR));
    doc.text(label, totalsX, y);
    doc.setTextColor(...(emphasize ? PRIMARY_COLOR : TEXT_COLOR));
    doc.text(value, tableX + tableW - 4, y, { align: "right" });
    y += emphasize ? 8 : 6;
  };
  drawTotalRow("Sub-Total:", formatCurrency(subtotal));
  drawTotalRow(`VAT (${companyDetails.vatRate}%):`, formatCurrency(vatAmount));
  y += 2;
  doc.setDrawColor(...GOLD_COLOR);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y - 5, tableX + tableW, y - 5);
  drawTotalRow("Total Amount:", formatCurrency(total), true);

  y += 15;

  // ========== FOOTER ==========
  // Footer line
  doc.setDrawColor(...GOLD_COLOR);
  doc.setLineWidth(1);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  // Thank you message
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for considering Just Wills.", pageWidth / 2, pageHeight - 18, { align: "center" });

  // Footer text
  doc.setTextColor(...GRAY_COLOR);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${companyDetails.name} | ${companyDetails.address} | ${companyDetails.email}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Return base64 string
  return doc.output("datauristring").split(",")[1];
}
