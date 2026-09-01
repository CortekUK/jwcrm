import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { companyDetails } from "@/config/company";
import { lineItemCostLabel, type InvoiceLineItem } from "./invoiceLineItems";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
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
  lineItems?: InvoiceLineItem[];
  // VAT is editable per invoice; both may be absent, in which case the company
  // default rate applies. See computeInvoiceAmounts for the precedence rules.
  vatRate?: number | null;
  vatAmount?: number | null;
  // Everything already received against this invoice, used for BALANCE AMOUNT.
  amountPaid?: number;
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

  // `let` because a long item list can overflow onto a continuation page; every
  // helper below draws onto whichever page is current.
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const { width, height } = page.getSize();
  const pageHeightMm = height / MM;

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

  // Greedy word wrap for a cell of `maxWidthMm`. widthOfTextAtSize returns
  // points, so the budget is converted with the same mm() used for every other
  // measurement in this file. Honours hard "\n" breaks in the description first.
  const wrap = (
    text: string,
    maxWidthMm: number,
    size: number,
    useFont: typeof font
  ): string[] => {
    const maxPt = mm(maxWidthMm);
    const out: string[] = [];
    text.split("\n").forEach((hardLine) => {
      const words = hardLine.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        out.push("");
        return;
      }
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const candidate = `${line} ${words[i]}`;
        if (useFont.widthOfTextAtSize(candidate, size) <= maxPt) line = candidate;
        else {
          out.push(line);
          line = words[i];
        }
      }
      out.push(line);
    });
    return out;
  };

  // ----- totals -----
  // Single source of truth for the money, shared with the English PDF, the
  // email renderer and the payment link, so a per-invoice VAT override cannot
  // reach only some of them.
  const {
    items,
    subtotal,
    vatAmount,
    vatLabel,
    invoiceTotal: total,
  } = computeInvoiceAmounts(
    {
      amount: data.amount,
      line_items: data.lineItems,
      vat_rate: data.vatRate,
      vat_amount: data.vatAmount,
    },
    companyDetails.vatRate
  );

  // BALANCE AMOUNT is what is still owed, so it is the total minus what has
  // already been received — unlike TOTAL / PAYMENT REQUIRED, which always show
  // the full invoice. Clamped: overlapping payments can exceed the total.
  const balance = Math.max(0, total - (Number(data.amountPaid) || 0));

  // =========================================================================
  // TITLE
  // =========================================================================
  txt("INVOICE", width / 2, 13, { size: 16, bold: true, align: "center" });

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
  txt("BILL TO:", ML + mm(3), gridTop + 6, { size: 10, bold: true });
  txt(data.clientName, ML + mm(3), gridTop + 12, { size: 10, bold: true });
  let by = gridTop + 17;
  txt(data.clientEmail, ML + mm(3), by, { size: 8, color: GRAY });
  by += 4.2;
  if (data.clientCompany) {
    txt(data.clientCompany, ML + mm(3), by, { size: 8, color: GRAY });
    by += 4.2;
  }
  if (data.clientPhone) {
    txt(data.clientPhone, ML + mm(3), by, { size: 8, color: GRAY });
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

  // Itemised rows (one per line item). Row height is measured, not fixed:
  // descriptions may carry hard line breaks and long text has to wrap inside
  // the DESCRIPTION cell rather than run under the COST column.
  const DESC_PAD = 4; // mm of padding either side of the description text
  const ITEM_LINE_H = 5; // mm per rendered description line
  const MAX_ITEM_LINES = 6; // beyond this a pathological description is clipped
  const MIN_ROW_H = 11; // the original fixed row height
  // The hardcoded Notarization Fee block used to pad this table out; it is now
  // an ordinary priced line item, so a filler row keeps the signed-off height.
  const MIN_BODY_H = 55;
  const ROW_LIMIT = pageHeightMm - 90; // below this the totals block will not fit

  let rowTop = tableTop + thH;
  let usedH = 0; // body height drawn on the CURRENT page

  items.forEach((item) => {
    const lines = wrap(item.description, descW - DESC_PAD * 2, 10, fontBold).slice(
      0,
      MAX_ITEM_LINES
    );
    const rowH = Math.max(MIN_ROW_H, lines.length * ITEM_LINE_H + 6);

    // Overflow guard: start a continuation page rather than draw off the sheet.
    if (rowTop + rowH > ROW_LIMIT) {
      page = pdfDoc.addPage([595.28, 841.89]);
      rowTop = 20;
      usedH = 0;
    }

    box(12, rowTop, descW, rowH);
    box(costX, rowTop, costW, rowH);
    box(priceX, rowTop, priceW, rowH);
    // Descriptions stay LTR here even though the rest of the document is
    // bilingual — unchanged from the previous behaviour.
    const firstBaseline = rowTop + (rowH - lines.length * ITEM_LINE_H) / 2 + 4;
    lines.forEach((ln, i) => {
      txt(ln, ML + mm(DESC_PAD), firstBaseline + i * ITEM_LINE_H, { size: 10, bold: true });
    });
    txt(lineItemCostLabel(item), costMid, rowTop + rowH / 2 + 1.5, {
      size: 10,
      bold: true,
      align: "center",
    });
    txt(fmt(item.amount), priceMid, rowTop + rowH / 2 + 1.5, { size: 10, align: "center" });
    rowTop += rowH;
    usedH += rowH;
  });

  // Empty filler spanning the three columns so a short invoice keeps roughly
  // the table height the client signed off on.
  const fillerH = Math.max(0, MIN_BODY_H - usedH);
  if (fillerH > 0) {
    box(12, rowTop, descW, fillerH);
    box(costX, rowTop, costW, fillerH);
    box(priceX, rowTop, priceW, fillerH);
    rowTop += fillerH;
  }

  // =========================================================================
  // BANK DETAILS + TOTALS
  // =========================================================================
  const lowerTop = rowTop;
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
  drawTotal(lowerTop + tr1, tr2, [vatLabel], fmt(vatAmount));
  drawTotal(lowerTop + tr1 + tr2, tr3, ["TOTAL"], `${fmt(total)} AED`);
  drawTotal(lowerTop + tr1 + tr2 + tr3, tr4, ["PAYMENT", "REQUIRED INCL", "VAT"], `${fmt(total)} AED`, true);
  drawTotal(lowerTop + tr1 + tr2 + tr3 + tr4, tr5, ["BALANCE", "AMOUNT"], `${fmt(balance)} AED`, true);

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
