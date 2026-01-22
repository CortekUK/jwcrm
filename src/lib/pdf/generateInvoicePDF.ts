import { jsPDF } from "jspdf";
import { companyDetails } from "@/config/company";

export type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientCompany?: string | null;
  amount: number;
  currency: string;
  description?: string;
};

// Colors
const PRIMARY_COLOR: [number, number, number] = [12, 85, 54]; // #0C5536
const GOLD_COLOR: [number, number, number] = [198, 160, 59]; // #C6A03B
const TEXT_COLOR: [number, number, number] = [34, 34, 34]; // #222222
const GRAY_COLOR: [number, number, number] = [102, 102, 102]; // #666666
const LIGHT_GRAY: [number, number, number] = [245, 245, 245]; // #F5F5F5

export function generateInvoicePDF(data: InvoiceData): string {
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

  // Calculate VAT
  const subtotal = data.amount;
  const vatAmount = subtotal * (companyDetails.vatRate / 100);
  const total = subtotal + vatAmount;

  // ========== HEADER SECTION ==========
  // Green header background
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(companyDetails.name.toUpperCase(), margin, 18);

  // Company details
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(companyDetails.address, margin, 26);
  doc.text(`TRN: ${companyDetails.trn}`, margin, 32);
  doc.text(companyDetails.email, margin, 38);

  // INVOICE title on right
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD_COLOR);
  doc.text("INVOICE", pageWidth - margin, 22, { align: "right" });

  // Invoice number below title
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(data.invoiceNumber, pageWidth - margin, 32, { align: "right" });

  y = 55;

  // ========== INVOICE DETAILS SECTION ==========
  doc.setTextColor(...TEXT_COLOR);

  // Invoice details box
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 28, 3, 3, "F");

  // Invoice Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_COLOR);
  doc.text("Invoice Date:", margin + 5, y + 8);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(data.invoiceDate), margin + 5, y + 14);

  // Due Date
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_COLOR);
  doc.text("Due Date:", margin + 60, y + 8);
  doc.setTextColor(...GOLD_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(data.dueDate), margin + 60, y + 14);

  // Currency
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_COLOR);
  doc.text("Currency:", margin + 120, y + 8);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(data.currency, margin + 120, y + 14);

  y += 38;

  // ========== BILL TO SECTION ==========
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(margin, y, 70, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", margin + 3, y + 5);

  y += 12;

  // Client details
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.clientName, margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_COLOR);
  doc.text(data.clientEmail, margin, y);
  y += 5;

  if (data.clientPhone) {
    doc.text(data.clientPhone, margin, y);
    y += 5;
  }

  if (data.clientCompany) {
    doc.text(data.clientCompany, margin, y);
    y += 5;
  }

  y += 10;

  // ========== LINE ITEMS TABLE ==========
  const tableStartY = y;
  const col1 = margin;
  const col2 = pageWidth - margin - 60;
  const col3 = pageWidth - margin - 35;
  const col4 = pageWidth - margin;

  // Table header
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(margin, y, pageWidth - 2 * margin, 10, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", col1 + 3, y + 7);
  doc.text("QTY", col2, y + 7, { align: "center" });
  doc.text("PRICE", col3 + 5, y + 7, { align: "center" });
  doc.text("AMOUNT", col4, y + 7, { align: "right" });

  y += 10;

  // Table row
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, pageWidth - 2 * margin, 15, "F");
  doc.setDrawColor(230, 230, 228);
  doc.line(margin, y + 15, pageWidth - margin, y + 15);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const description = data.description || "Professional Will Drafting Services";
  doc.text(description, col1 + 3, y + 6);

  // Add a second line for more detail
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_COLOR);
  doc.text("Legal document preparation and consultation", col1 + 3, y + 11);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(10);
  doc.text("1", col2, y + 8, { align: "center" });
  doc.text(formatCurrency(subtotal), col3 + 5, y + 8, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(subtotal), col4, y + 8, { align: "right" });

  y += 20;

  // ========== TOTALS SECTION ==========
  const totalsX = pageWidth - margin - 80;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_COLOR);
  doc.text("Subtotal:", totalsX, y);
  doc.setTextColor(...TEXT_COLOR);
  doc.text(formatCurrency(subtotal), col4, y, { align: "right" });
  y += 7;

  // VAT
  doc.setTextColor(...GRAY_COLOR);
  doc.text(`VAT (${companyDetails.vatRate}%):`, totalsX, y);
  doc.setTextColor(...TEXT_COLOR);
  doc.text(formatCurrency(vatAmount), col4, y, { align: "right" });
  y += 10;

  // Total line
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 10, y - 3, col4, y - 3);

  // Total
  doc.setFillColor(...PRIMARY_COLOR);
  doc.roundedRect(totalsX - 15, y, 95, 12, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL DUE:", totalsX - 5, y + 8);
  doc.setTextColor(...GOLD_COLOR);
  doc.setFontSize(13);
  doc.text(formatCurrency(total), col4 - 3, y + 8, { align: "right" });

  y += 25;

  // ========== PAYMENT TERMS SECTION ==========
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 35, 3, 3, "F");

  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT INFORMATION", margin + 5, y + 8);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Payment Terms: Due upon receipt", margin + 5, y + 16);
  doc.text("Payment Method: Secure online payment via Stripe", margin + 5, y + 22);
  doc.text("Please use the payment link provided in your email to complete the transaction.", margin + 5, y + 28);

  y += 45;

  // ========== FOOTER ==========
  // Thank you message
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for your business!", pageWidth / 2, y, { align: "center" });

  // Footer line
  doc.setDrawColor(...GOLD_COLOR);
  doc.setLineWidth(1);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

  // Footer text
  doc.setTextColor(...GRAY_COLOR);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${companyDetails.name} | ${companyDetails.website} | ${companyDetails.email}`,
    pageWidth / 2,
    pageHeight - 12,
    { align: "center" }
  );

  // Return base64 string
  return doc.output("datauristring").split(",")[1];
}
