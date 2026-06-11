import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
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
const BLACK = rgb(0, 0, 0);
const TEXT = rgb(0.08, 0.08, 0.08);
const GRAY = rgb(0.35, 0.35, 0.35);
const HEADER_FILL = rgb(0.925, 0.925, 0.925);
const LABEL_FILL = rgb(0.87, 0.87, 0.87);
const TRN_FILL = rgb(0.745, 0.745, 0.745);

const MM = 2.83465; // points per millimetre
const mm = (v: number) => v * MM;

export async function generateInvoicePDFArabic(data: InvoiceData): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load Arabic font (for the TRN label)
  let arabicFont: Awaited<ReturnType<typeof pdfDoc.embedFont>> | null = null;
  try {
    const fontPath = path.join(process.cwd(), "src/lib/pdf/fonts/Cairo-Regular.ttf");
    arabicFont = await pdfDoc.embedFont(fs.readFileSync(fontPath));
  } catch (error) {
    console.warn("Arabic font not loaded, using fallback:", error);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Logo (reuse existing brand logo)
  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const logoBytes = fs.readFileSync(path.join(process.cwd(), "src/assets/justwills.png"));
    logoImg = await pdfDoc.embedPng(logoBytes);
  } catch (error) {
    console.warn("Logo not loaded:", error);
  }

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const { width, height } = page.getSize();

  const ML = mm(12);
  const RIGHTX = width - ML;
  const CW = RIGHTX - ML;

  // ----- helpers -----
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

  type TextOpts = {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: typeof TEXT;
    align?: "left" | "center" | "right";
    arabic?: boolean;
  };

  // topMm = distance of the text baseline from the top of the page
  const txt = (str: string, xPt: number, topMm: number, opts: TextOpts = {}) => {
    const { size = 10, bold = false, italic = false, color = TEXT, align = "left", arabic = false } = opts;
    const useFont = arabic && arabicFont ? arabicFont : bold ? fontBold : italic ? fontItalic : font;
    const w = useFont.widthOfTextAtSize(str, size);
    let x = xPt;
    if (align === "center") x = xPt - w / 2;
    else if (align === "right") x = xPt - w;
    page.drawText(str, { x, y: height - mm(topMm), size, font: useFont, color });
  };

  // x/top/w/h all in mm from the top-left
  const box = (xMm: number, topMm: number, wMm: number, hMm: number, fill?: typeof HEADER_FILL) => {
    page.drawRectangle({
      x: mm(xMm),
      y: height - mm(topMm + hMm),
      width: mm(wMm),
      height: mm(hMm),
      ...(fill ? { color: fill } : {}),
      borderColor: BLACK,
      borderWidth: 0.8,
    });
  };

  // ----- totals -----
  const subtotal = data.amount;
  const vatAmount = subtotal * (companyDetails.vatRate / 100);
  const total = subtotal + vatAmount;

  // =========================================================================
  // TITLE
  // =========================================================================
  txt("TAX INVOICE", width / 2, 13, { size: 16, bold: true, align: "center" });

  // =========================================================================
  // HEADER (logo + company address)
  // =========================================================================
  const headerTop = 18;
  const headerH = 28;
  box(12, headerTop, CW / MM, headerH, HEADER_FILL);

  if (logoImg) {
    const maxW = mm(44);
    const maxH = mm(20);
    const ratio = logoImg.width / logoImg.height;
    let lw = maxW;
    let lh = maxW / ratio;
    if (lh > maxH) {
      lh = maxH;
      lw = maxH * ratio;
    }
    page.drawImage(logoImg, {
      x: ML + mm(3),
      y: height - mm(headerTop + headerH) + (mm(headerH) - lh) / 2,
      width: lw,
      height: lh,
    });
  } else {
    txt("JW LEGAL CONSULTANTS", ML + mm(4), headerTop + 16, { size: 14, bold: true });
  }

  let ay = headerTop + 6;
  companyDetails.invoiceAddressLines.forEach((line) => {
    txt(line, RIGHTX - mm(3), ay, { size: 7.5, align: "right" });
    ay += 4;
  });
  txt(`PHONE: ${companyDetails.invoicePhone}`, RIGHTX - mm(3), ay, { size: 7.5, align: "right" });
  ay += 4;
  txt(`EMAIL: ${companyDetails.invoiceEmail}`, RIGHTX - mm(3), ay, { size: 7.5, align: "right" });

  // =========================================================================
  // BILL TO / INVOICE DETAILS GRID
  // =========================================================================
  const gridTop = headerTop + headerH; // 46
  const gridH = 30;
  const midMm = 12 + 93;

  // Left: BILL TO
  box(12, gridTop, 93, gridH);
  txt("BILL TO:", ML + mm(3), gridTop + 7, { size: 10, bold: true });
  txt(data.clientName, ML + mm(3), gridTop + 15, { size: 10, bold: true });
  let by = gridTop + 21;
  txt(data.clientEmail, ML + mm(3), by, { size: 8.5, color: GRAY });
  by += 5;
  if (data.clientCompany) {
    txt(data.clientCompany, ML + mm(3), by, { size: 8.5, color: GRAY });
    by += 5;
  }
  if (data.clientPhone) {
    txt(data.clientPhone, ML + mm(3), by, { size: 8.5, color: GRAY });
  }

  // Right: Invoice No / Date / Reference
  const rLabelW = 35;
  const rW = (RIGHTX - mm(midMm)) / MM; // remaining width in mm
  const rowH = 10;
  box(midMm, gridTop, rLabelW, rowH, LABEL_FILL);
  box(midMm + rLabelW, gridTop, rW - rLabelW, rowH);
  txt("Invoice No.", mm(midMm) + mm(2), gridTop + 6.5, { size: 9, bold: true });
  txt(data.invoiceNumber, mm(midMm + rLabelW) + mm(2), gridTop + 6.5, { size: 9, bold: true });
  box(midMm, gridTop + rowH, rLabelW, rowH, LABEL_FILL);
  box(midMm + rLabelW, gridTop + rowH, rW - rLabelW, rowH);
  txt("Date", mm(midMm) + mm(2), gridTop + rowH + 6.5, { size: 9, bold: true });
  txt(formatDate(data.invoiceDate), mm(midMm + rLabelW) + mm(2), gridTop + rowH + 6.5, { size: 9 });
  box(midMm, gridTop + 2 * rowH, rW, gridH - 2 * rowH);
  txt(`Reference:  ${data.clientName}`, mm(midMm) + mm(2), gridTop + 2 * rowH + 6.5, { size: 9, bold: true });

  // =========================================================================
  // LINE ITEMS TABLE
  // =========================================================================
  const tableTop = gridTop + gridH; // 76
  const descW = 120;
  const costW = 33;
  const priceW = CW / MM - descW - costW;
  const costX = 12 + descW;
  const priceX = 12 + descW + costW;
  const costMid = mm(costX + costW / 2);
  const priceMid = mm(priceX + priceW / 2);

  const thH = 9;
  box(12, tableTop, descW, thH, LABEL_FILL);
  box(costX, tableTop, costW, thH, LABEL_FILL);
  box(priceX, tableTop, priceW, thH, LABEL_FILL);
  txt("DESCRIPTION", mm(12 + descW / 2), tableTop + 6, { size: 9, bold: true, align: "center" });
  txt("COST", costMid, tableTop + 6, { size: 9, bold: true, align: "center" });
  txt("NET PRICE AED", priceMid, tableTop + 6, { size: 9, bold: true, align: "center" });

  // Row 1 — Will (UAE)
  const row1Top = tableTop + thH;
  const rowH1 = 30;
  box(12, row1Top, descW, rowH1);
  box(costX, row1Top, costW, rowH1);
  box(priceX, row1Top, priceW, rowH1);
  txt("Will (UAE)", ML + mm(4), row1Top + 9, { size: 10, bold: true });
  txt("X", costMid, row1Top + 9, { size: 10, bold: true, align: "center" });
  txt(fmt(subtotal), priceMid, row1Top + 9, { size: 10, align: "center" });

  // Row 2 — Notarization Fee (informational)
  const row2Top = row1Top + rowH1;
  const rowH2 = 30;
  box(12, row2Top, descW, rowH2);
  box(costX, row2Top, costW, rowH2);
  box(priceX, row2Top, priceW, rowH2);
  txt("Notarization Fee", ML + mm(4), row2Top + 8, { size: 9.5, bold: true });
  txt("(Includes legalization, PRO Services)", ML + mm(38), row2Top + 8, { size: 8.5, italic: true, color: GRAY });
  let ny = row2Top + 14;
  companyDetails.notarizationNote.forEach((line) => {
    txt(line, ML + mm(4), ny, { size: 8.5 });
    ny += 5;
  });
  txt("X", costMid, row2Top + 9, { size: 10, bold: true, align: "center" });

  // =========================================================================
  // BANK DETAILS + TOTALS
  // =========================================================================
  const lowerTop = row2Top + rowH2; // 145
  const totLabelMid = mm(costX + costW / 2);
  const totValMid = mm(priceX + priceW / 2);

  const tr1 = 12;
  const tr2 = 10;
  const tr3 = 10;
  const tr4 = 16;
  const tr5 = 16;

  const drawTotal = (top: number, h: number, label: string[], value: string, emphasize = false) => {
    box(costX, top, costW, h, LABEL_FILL);
    box(priceX, top, priceW, h);
    const lblSize = label.length > 1 ? 8 : 9;
    const startTop = top + h / 2 - (label.length - 1) * 1.6 + 0.6;
    label.forEach((ln, i) => {
      txt(ln, totLabelMid, startTop + i * 3.2, { size: lblSize, bold: true, align: "center" });
    });
    txt(value, totValMid, top + h / 2 + 1.2, { size: emphasize ? 10 : 9, bold: true, align: "center" });
  };

  drawTotal(lowerTop, tr1, ["SUB-TOTAL"], fmt(subtotal));
  drawTotal(lowerTop + tr1, tr2, [`${companyDetails.vatRate}% VAT`], fmt(vatAmount));
  drawTotal(lowerTop + tr1 + tr2, tr3, ["TOTAL"], `${fmt(total)} AED`);
  drawTotal(lowerTop + tr1 + tr2 + tr3, tr4, ["PAYMENT", "REQUIRED INCL", "VAT"], `${fmt(total)} AED`, true);
  drawTotal(lowerTop + tr1 + tr2 + tr3 + tr4, tr5, ["BALANCE", "AMOUNT"], `${fmt(total)} AED`, true);

  // Bank details box (left)
  const bankH = tr1 + tr2 + tr3;
  box(12, lowerTop, descW, bankH);
  let ky = lowerTop + 5;
  txt("Please draw your cheque payable to:", ML + mm(3), ky, { size: 8 });
  ky += 4;
  txt(companyDetails.bank.payee, ML + mm(3), ky, { size: 8, bold: true });
  ky += 5;
  txt(`Bank: ${companyDetails.bank.name}`, ML + mm(3), ky, { size: 7.5 });
  ky += 3.5;
  txt(`Payee: ${companyDetails.bank.payee}`, ML + mm(3), ky, { size: 7.5 });
  ky += 3.5;
  txt(`Account : ${companyDetails.bank.account}`, ML + mm(3), ky, { size: 7.5 });
  ky += 3.5;
  txt(`Swift Code: ${companyDetails.bank.swift}`, ML + mm(3), ky, { size: 7.5 });
  ky += 3.5;
  txt(`IBAN# ${companyDetails.bank.iban}`, ML + mm(3), ky, { size: 7.5 });

  // TRN box (left) — with Arabic label
  const trnTop = lowerTop + bankH;
  const trnH = tr4 + tr5;
  box(12, trnTop, descW, trnH, TRN_FILL);
  if (arabicFont) {
    txt("رقم التسجيل الضريبي / TRN#", mm(12 + descW / 2), trnTop + trnH / 2 - 2, {
      size: 11,
      bold: true,
      align: "center",
      arabic: true,
    });
  } else {
    txt("Tax Registration No. / TRN#", mm(12 + descW / 2), trnTop + trnH / 2 - 2, {
      size: 11,
      bold: true,
      align: "center",
    });
  }
  txt(companyDetails.trn, mm(12 + descW / 2), trnTop + trnH / 2 + 6, { size: 13, bold: true, align: "center" });

  // =========================================================================
  // FOOTER
  // =========================================================================
  page.drawLine({
    start: { x: ML, y: height - mm(277) },
    end: { x: RIGHTX, y: height - mm(277) },
    thickness: 0.8,
    color: BLACK,
  });
  txt(companyDetails.legalName, width / 2, 283, { size: 11, bold: true, align: "center" });
  txt(companyDetails.invoiceCity, width / 2, 288, { size: 8.5, color: GRAY, align: "center" });

  const base64 = await pdfDoc.saveAsBase64();
  return base64;
}
