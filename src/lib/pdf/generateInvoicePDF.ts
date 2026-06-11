import { jsPDF } from "jspdf";
import { companyDetails } from "@/config/company";
import fs from "fs";
import path from "path";

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

// Grayscale palette to match the official JW Legal Consultants tax invoice
const BLACK: [number, number, number] = [0, 0, 0];
const TEXT: [number, number, number] = [20, 20, 20];
const GRAY: [number, number, number] = [90, 90, 90];
const HEADER_FILL: [number, number, number] = [236, 236, 236];
const LABEL_FILL: [number, number, number] = [222, 222, 222];
const TRN_FILL: [number, number, number] = [190, 190, 190];

export function generateInvoicePDF(data: InvoiceData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const M = 12; // left margin
  const RIGHT = pageWidth - M; // 198
  const contentW = RIGHT - M;

  // ----- helpers -----
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);

  const box = (x: number, y: number, w: number, h: number, fill?: [number, number, number]) => {
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(x, y, w, h, "F");
    }
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h, "S");
  };

  // ----- totals -----
  const subtotal = data.amount;
  const vatAmount = subtotal * (companyDetails.vatRate / 100);
  const total = subtotal + vatAmount;

  // =========================================================================
  // TITLE
  // =========================================================================
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INVOICE", pageWidth / 2, 14, { align: "center" });

  // =========================================================================
  // HEADER (logo + company address)
  // =========================================================================
  const headerY = 18;
  const headerH = 28;
  box(M, headerY, contentW, headerH, HEADER_FILL);

  // Logo (reuse existing brand logo)
  try {
    const logoBytes = fs.readFileSync(path.join(process.cwd(), "src/assets/justwills.png"));
    const logoUri = "data:image/png;base64," + logoBytes.toString("base64");
    const props = doc.getImageProperties(logoUri);
    const maxW = 44;
    const maxH = 22;
    let lw = maxW;
    let lh = (maxW * props.height) / props.width;
    if (lh > maxH) {
      lh = maxH;
      lw = (maxH * props.width) / props.height;
    }
    doc.addImage(logoUri, "PNG", M + 3, headerY + (headerH - lh) / 2, lw, lh);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...TEXT);
    doc.text("JW LEGAL CONSULTANTS", M + 4, headerY + 16);
  }

  // Company address block (right aligned)
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let ay = headerY + 6;
  companyDetails.invoiceAddressLines.forEach((line) => {
    doc.text(line, RIGHT - 3, ay, { align: "right" });
    ay += 4;
  });
  doc.text(`PHONE: ${companyDetails.invoicePhone}`, RIGHT - 3, ay, { align: "right" });
  ay += 4;
  doc.text(`EMAIL: ${companyDetails.invoiceEmail}`, RIGHT - 3, ay, { align: "right" });

  // =========================================================================
  // BILL TO / INVOICE DETAILS GRID
  // =========================================================================
  const gridY = headerY + headerH; // 46
  const gridH = 30;
  const midX = M + 93;

  // Left: BILL TO
  box(M, gridY, midX - M, gridH);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO:", M + 3, gridY + 6);
  doc.setFontSize(10);
  doc.text(data.clientName, M + 3, gridY + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const billW = midX - M - 6; // available width inside the cell
  let by = gridY + 17;
  doc.text(doc.splitTextToSize(data.clientEmail, billW)[0], M + 3, by);
  by += 4.2;
  if (data.clientCompany) {
    doc.text(doc.splitTextToSize(data.clientCompany, billW)[0], M + 3, by);
    by += 4.2;
  }
  if (data.clientPhone) {
    doc.text(data.clientPhone, M + 3, by);
  }

  // Right: Invoice No / Date / Reference
  const rLabelW = 35;
  const rX = midX;
  const rW = RIGHT - midX;
  const rowH = 10;
  // Invoice No row
  box(rX, gridY, rLabelW, rowH, LABEL_FILL);
  box(rX + rLabelW, gridY, rW - rLabelW, rowH);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Invoice No.", rX + 2, gridY + 6.5);
  doc.text(data.invoiceNumber, rX + rLabelW + 2, gridY + 6.5);
  // Date row
  box(rX, gridY + rowH, rLabelW, rowH, LABEL_FILL);
  box(rX + rLabelW, gridY + rowH, rW - rLabelW, rowH);
  doc.text("Date", rX + 2, gridY + rowH + 6.5);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.invoiceDate), rX + rLabelW + 2, gridY + rowH + 6.5);
  // Reference row (full width)
  box(rX, gridY + 2 * rowH, rW, gridH - 2 * rowH);
  doc.setFont("helvetica", "bold");
  doc.text(`Reference:  ${data.clientName}`, rX + 2, gridY + 2 * rowH + 6.5);

  // =========================================================================
  // LINE ITEMS TABLE
  // =========================================================================
  const tableY = gridY + gridH; // 76
  const descW = 120;
  const costW = 33;
  const priceW = contentW - descW - costW; // 33
  const colDescX = M;
  const colCostX = M + descW;
  const colPriceX = M + descW + costW;
  const costMid = colCostX + costW / 2;
  const priceMid = colPriceX + priceW / 2;

  // Header row
  const thH = 9;
  box(colDescX, tableY, descW, thH, LABEL_FILL);
  box(colCostX, tableY, costW, thH, LABEL_FILL);
  box(colPriceX, tableY, priceW, thH, LABEL_FILL);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESCRIPTION", colDescX + descW / 2, tableY + 6, { align: "center" });
  doc.text("COST", costMid, tableY + 6, { align: "center" });
  doc.text("NET PRICE AED", priceMid, tableY + 6, { align: "center" });

  // Row 1 — Will (UAE)
  const row1Y = tableY + thH;
  const row1H = 30;
  box(colDescX, row1Y, descW, row1H);
  box(colCostX, row1Y, costW, row1H);
  box(colPriceX, row1Y, priceW, row1H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Will (UAE)", colDescX + 4, row1Y + 9);
  doc.text("X", costMid, row1Y + 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(fmt(subtotal), priceMid, row1Y + 9, { align: "center" });

  // Row 2 — Notarization Fee (informational)
  const row2Y = row1Y + row1H;
  const row2H = 30;
  box(colDescX, row2Y, descW, row2H);
  box(colCostX, row2Y, costW, row2H);
  box(colPriceX, row2Y, priceW, row2H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Notarization Fee", colDescX + 4, row2Y + 8);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text("(Includes legalization, PRO Services)", colDescX + 38, row2Y + 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  let ny = row2Y + 14;
  companyDetails.notarizationNote.forEach((line) => {
    doc.text(line, colDescX + 4, ny);
    ny += 5;
  });
  doc.setFont("helvetica", "bold");
  doc.text("X", costMid, row2Y + 9, { align: "center" });

  // =========================================================================
  // BANK DETAILS + TOTALS
  // =========================================================================
  const lowerY = row2Y + row2H; // start of bank box / totals
  const bankW = descW; // left block under description column
  const totLabelX = colCostX;
  const totLabelW = costW;
  const totValX = colPriceX;
  const totValW = priceW;

  // Totals rows (right)
  const tr1 = 12; // SUB-TOTAL
  const tr2 = 10; // 5% VAT
  const tr3 = 10; // TOTAL
  const tr4 = 16; // PAYMENT REQUIRED INCL VAT
  const tr5 = 16; // BALANCE AMOUNT

  const drawTotal = (
    yPos: number,
    h: number,
    label: string[],
    value: string,
    emphasize = false
  ) => {
    box(totLabelX, yPos, totLabelW, h, LABEL_FILL);
    box(totValX, yPos, totValW, h);
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(label.length > 1 ? 8 : 9);
    const labelMid = totLabelX + totLabelW / 2;
    const startY = yPos + h / 2 - ((label.length - 1) * 3.5) / 2 + 1.5;
    label.forEach((ln, i) => {
      doc.text(ln, labelMid, startY + i * 3.5, { align: "center" });
    });
    doc.setFontSize(emphasize ? 10 : 9);
    doc.text(value, totValX + totValW / 2, yPos + h / 2 + 1.5, { align: "center" });
  };

  drawTotal(lowerY, tr1, ["SUB-TOTAL"], fmt(subtotal));
  drawTotal(lowerY + tr1, tr2, [`${companyDetails.vatRate}% VAT`], fmt(vatAmount));
  drawTotal(lowerY + tr1 + tr2, tr3, ["TOTAL"], `${fmt(total)} AED`);
  drawTotal(lowerY + tr1 + tr2 + tr3, tr4, ["PAYMENT", "REQUIRED INCL", "VAT"], `${fmt(total)} AED`, true);
  drawTotal(lowerY + tr1 + tr2 + tr3 + tr4, tr5, ["BALANCE", "AMOUNT"], `${fmt(total)} AED`, true);

  // Bank details box (left) — aligned with SUB-TOTAL..TOTAL
  const bankH = tr1 + tr2 + tr3;
  box(M, lowerY, bankW, bankH);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let kx = M + 3;
  let ky = lowerY + 5;
  doc.text("Please draw your cheque payable to:", kx, ky);
  ky += 4;
  doc.setFont("helvetica", "bold");
  doc.text(companyDetails.bank.payee, kx, ky);
  ky += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Bank: ${companyDetails.bank.name}`, kx, ky);
  ky += 3.5;
  doc.text(`Payee: ${companyDetails.bank.payee}`, kx, ky);
  ky += 3.5;
  doc.text(`Account : ${companyDetails.bank.account}`, kx, ky);
  ky += 3.5;
  doc.text(`Swift Code: ${companyDetails.bank.swift}`, kx, ky);
  ky += 3.5;
  doc.text(`IBAN# ${companyDetails.bank.iban}`, kx, ky);

  // TRN box (left) — aligned with PAYMENT + BALANCE rows
  const trnY = lowerY + bankH;
  const trnH = tr4 + tr5;
  box(M, trnY, bankW, trnH, TRN_FILL);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Tax Registration No. / TRN#", M + bankW / 2, trnY + trnH / 2 - 2, { align: "center" });
  doc.setFontSize(13);
  doc.text(companyDetails.trn, M + bankW / 2, trnY + trnH / 2 + 6, { align: "center" });

  // =========================================================================
  // FOOTER
  // =========================================================================
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(M, pageHeight - 20, RIGHT, pageHeight - 20);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(companyDetails.legalName, pageWidth / 2, pageHeight - 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(companyDetails.invoiceCity, pageWidth / 2, pageHeight - 9, { align: "center" });

  return doc.output("datauristring").split(",")[1];
}
