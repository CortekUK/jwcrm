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

// Colors (normalized 0-1 for pdf-lib)
const PRIMARY_COLOR = rgb(12 / 255, 85 / 255, 54 / 255); // #0C5536
const GOLD_COLOR = rgb(198 / 255, 160 / 255, 59 / 255); // #C6A03B
const TEXT_COLOR = rgb(34 / 255, 34 / 255, 34 / 255); // #222222
const GRAY_COLOR = rgb(102 / 255, 102 / 255, 102 / 255); // #666666
const LIGHT_GRAY = rgb(245 / 255, 245 / 255, 245 / 255); // #F5F5F5
const WHITE = rgb(1, 1, 1);

// Arabic text constants
const AR = {
  invoice: "فاتورة",
  invoiceNumber: "رقم الفاتورة",
  invoiceDate: "تاريخ الفاتورة",
  dueDate: "تاريخ الاستحقاق",
  currency: "العملة",
  billTo: "فاتورة إلى",
  description: "الوصف",
  serviceDescription: "خدمات صياغة الوصايا الاحترافية",
  legalServices: "إعداد المستندات القانونية والاستشارات",
  quantity: "الكمية",
  price: "السعر",
  amount: "المبلغ",
  subtotal: "المجموع الفرعي",
  vat: "ضريبة القيمة المضافة",
  totalDue: "المبلغ المستحق",
  paymentInfo: "معلومات الدفع",
  paymentTerms: "شروط الدفع: مستحق عند الاستلام",
  paymentMethod: "طريقة الدفع: الدفع الآمن عبر الإنترنت",
  paymentInstructions: "يرجى استخدام رابط الدفع المرفق في بريدك الإلكتروني",
  thankYou: "شكراً لتعاملكم معنا",
  companyName: "جست ويلز",
};

export async function generateInvoicePDFArabic(data: InvoiceData): Promise<string> {
  const pdfDoc = await PDFDocument.create();

  // Register fontkit for custom fonts
  pdfDoc.registerFontkit(fontkit);

  // Load Arabic font
  let arabicFont;
  let hasArabicFont = false;

  try {
    const fontPath = path.join(process.cwd(), "src/lib/pdf/fonts/Cairo-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    arabicFont = await pdfDoc.embedFont(fontBytes);
    hasArabicFont = true;
  } catch (error) {
    console.warn("Arabic font not loaded, using fallback:", error);
  }

  // Load standard font as fallback
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Create page
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
  const { width, height } = page.getSize();
  const margin = 56.7; // 20mm in points

  // Helper function to draw text
  const drawText = (
    text: string,
    x: number,
    y: number,
    options: {
      font?: typeof helvetica;
      size?: number;
      color?: typeof PRIMARY_COLOR;
      align?: "left" | "center" | "right";
      isArabic?: boolean;
    } = {}
  ) => {
    const {
      font = helvetica,
      size = 10,
      color = TEXT_COLOR,
      align = "left",
      isArabic = false,
    } = options;

    const useFont = isArabic && hasArabicFont && arabicFont ? arabicFont : font;
    const textWidth = useFont.widthOfTextAtSize(text, size);

    let xPos = x;
    if (align === "center") {
      xPos = x - textWidth / 2;
    } else if (align === "right") {
      xPos = x - textWidth;
    }

    page.drawText(text, {
      x: xPos,
      y,
      size,
      font: useFont,
      color,
    });
  };

  // Helper to draw rectangle
  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: typeof PRIMARY_COLOR
  ) => {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color,
    });
  };

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

  let y = height - margin;

  // ========== HEADER SECTION ==========
  // Green header background
  drawRect(0, height - 127.56, width, 127.56, PRIMARY_COLOR); // 45mm in points

  // Company name (right side for RTL)
  drawText(companyDetails.name.toUpperCase(), width - margin, height - 51, {
    font: helveticaBold,
    size: 24,
    color: WHITE,
    align: "right",
  });

  // Company details
  drawText(companyDetails.address, width - margin, height - 74, {
    size: 9,
    color: WHITE,
    align: "right",
  });
  drawText(`TRN: ${companyDetails.trn}`, width - margin, height - 91, {
    size: 9,
    color: WHITE,
    align: "right",
  });
  drawText(companyDetails.email, width - margin, height - 108, {
    size: 9,
    color: WHITE,
    align: "right",
  });

  // INVOICE title (left side)
  if (hasArabicFont && arabicFont) {
    drawText(AR.invoice, margin + 60, height - 62, {
      font: arabicFont,
      size: 28,
      color: GOLD_COLOR,
      align: "left",
      isArabic: true,
    });
  } else {
    drawText("INVOICE", margin, height - 62, {
      font: helveticaBold,
      size: 28,
      color: GOLD_COLOR,
      align: "left",
    });
  }

  // Invoice number
  drawText(data.invoiceNumber, margin, height - 91, {
    size: 11,
    color: WHITE,
    align: "left",
  });

  y = height - 156; // 55mm from top

  // ========== INVOICE DETAILS BOX ==========
  drawRect(margin, y - 79.37, width - 2 * margin, 79.37, LIGHT_GRAY); // 28mm height

  // Invoice Date
  drawText("Invoice Date:", width - margin - 14, y - 22.68, {
    size: 9,
    color: GRAY_COLOR,
    align: "right",
  });
  drawText(formatDate(data.invoiceDate), width - margin - 14, y - 39.69, {
    font: helveticaBold,
    size: 10,
    color: TEXT_COLOR,
    align: "right",
  });

  // Due Date
  drawText("Due Date:", width - margin - 156, y - 22.68, {
    size: 9,
    color: GRAY_COLOR,
    align: "right",
  });
  drawText(formatDate(data.dueDate), width - margin - 156, y - 39.69, {
    font: helveticaBold,
    size: 10,
    color: GOLD_COLOR,
    align: "right",
  });

  // Currency
  drawText("Currency:", width - margin - 298, y - 22.68, {
    size: 9,
    color: GRAY_COLOR,
    align: "right",
  });
  drawText(data.currency, width - margin - 298, y - 39.69, {
    font: helveticaBold,
    size: 10,
    color: TEXT_COLOR,
    align: "right",
  });

  y -= 107.72; // Move down

  // ========== BILL TO SECTION ==========
  drawRect(width - margin - 198.43, y, 198.43, 19.84, PRIMARY_COLOR);

  if (hasArabicFont && arabicFont) {
    drawText(AR.billTo, width - margin - 8.5, y + 5.67, {
      font: arabicFont,
      size: 10,
      color: WHITE,
      align: "right",
      isArabic: true,
    });
  } else {
    drawText("BILL TO", width - margin - 8.5, y + 5.67, {
      font: helveticaBold,
      size: 10,
      color: WHITE,
      align: "right",
    });
  }

  y -= 34;

  // Client details
  drawText(data.clientName, width - margin, y, {
    font: helveticaBold,
    size: 12,
    color: TEXT_COLOR,
    align: "right",
  });
  y -= 17;

  drawText(data.clientEmail, width - margin, y, {
    size: 10,
    color: GRAY_COLOR,
    align: "right",
  });
  y -= 14;

  if (data.clientPhone) {
    drawText(data.clientPhone, width - margin, y, {
      size: 10,
      color: GRAY_COLOR,
      align: "right",
    });
    y -= 14;
  }

  if (data.clientCompany) {
    drawText(data.clientCompany, width - margin, y, {
      size: 10,
      color: GRAY_COLOR,
      align: "right",
    });
    y -= 14;
  }

  y -= 28;

  // ========== TABLE HEADER ==========
  drawRect(margin, y - 28.35, width - 2 * margin, 28.35, PRIMARY_COLOR);

  // RTL: Description on right, Amount on left
  if (hasArabicFont && arabicFont) {
    drawText(AR.description, width - margin - 8.5, y - 19.84, {
      font: arabicFont,
      size: 9,
      color: WHITE,
      align: "right",
      isArabic: true,
    });
    drawText(AR.quantity, width / 2, y - 19.84, {
      font: arabicFont,
      size: 9,
      color: WHITE,
      align: "center",
      isArabic: true,
    });
    drawText(AR.price, margin + 155.91, y - 19.84, {
      font: arabicFont,
      size: 9,
      color: WHITE,
      align: "center",
      isArabic: true,
    });
    drawText(AR.amount, margin + 8.5, y - 19.84, {
      font: arabicFont,
      size: 9,
      color: WHITE,
      align: "left",
      isArabic: true,
    });
  } else {
    drawText("DESCRIPTION", width - margin - 8.5, y - 19.84, {
      font: helveticaBold,
      size: 9,
      color: WHITE,
      align: "right",
    });
    drawText("QTY", width / 2, y - 19.84, {
      font: helveticaBold,
      size: 9,
      color: WHITE,
      align: "center",
    });
    drawText("PRICE", margin + 155.91, y - 19.84, {
      font: helveticaBold,
      size: 9,
      color: WHITE,
      align: "center",
    });
    drawText("AMOUNT", margin + 8.5, y - 19.84, {
      font: helveticaBold,
      size: 9,
      color: WHITE,
      align: "left",
    });
  }

  y -= 28.35;

  // ========== TABLE ROW ==========
  // Draw line at bottom
  page.drawLine({
    start: { x: margin, y: y - 42.52 },
    end: { x: width - margin, y: y - 42.52 },
    thickness: 0.5,
    color: rgb(230 / 255, 230 / 255, 228 / 255),
  });

  // Service description
  const description = data.description || (hasArabicFont ? AR.serviceDescription : "Professional Will Drafting Services");
  drawText(description, width - margin - 8.5, y - 17, {
    size: 10,
    color: TEXT_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });

  const secondaryDesc = hasArabicFont ? AR.legalServices : "Legal document preparation and consultation";
  drawText(secondaryDesc, width - margin - 8.5, y - 31.18, {
    size: 8,
    color: GRAY_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });

  drawText("1", width / 2, y - 22.68, {
    size: 10,
    color: TEXT_COLOR,
    align: "center",
  });
  drawText(formatCurrency(subtotal), margin + 155.91, y - 22.68, {
    size: 10,
    color: TEXT_COLOR,
    align: "center",
  });
  drawText(formatCurrency(subtotal), margin + 8.5, y - 22.68, {
    font: helveticaBold,
    size: 10,
    color: TEXT_COLOR,
    align: "left",
  });

  y -= 56.69;

  // ========== TOTALS SECTION ==========
  // Subtotal
  const subtotalLabel = hasArabicFont ? AR.subtotal + ":" : "Subtotal:";
  drawText(subtotalLabel, margin + 255.12, y, {
    size: 10,
    color: GRAY_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });
  drawText(formatCurrency(subtotal), margin, y, {
    size: 10,
    color: TEXT_COLOR,
    align: "left",
  });
  y -= 19.84;

  // VAT
  const vatLabel = hasArabicFont ? `${AR.vat} (${companyDetails.vatRate}%):` : `VAT (${companyDetails.vatRate}%):`;
  drawText(vatLabel, margin + 255.12, y, {
    size: 10,
    color: GRAY_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });
  drawText(formatCurrency(vatAmount), margin, y, {
    size: 10,
    color: TEXT_COLOR,
    align: "left",
  });
  y -= 28.35;

  // Total box
  drawRect(margin - 14.17, y - 34.02, 297.64, 34.02, PRIMARY_COLOR);

  const totalLabel = hasArabicFont ? AR.totalDue + ":" : "TOTAL DUE:";
  drawText(totalLabel, margin + 255.12, y - 22.68, {
    font: hasArabicFont && arabicFont ? arabicFont : helveticaBold,
    size: 11,
    color: WHITE,
    align: "right",
    isArabic: hasArabicFont,
  });
  drawText(formatCurrency(total), margin - 5.67, y - 22.68, {
    font: helveticaBold,
    size: 13,
    color: GOLD_COLOR,
    align: "left",
  });

  y -= 70.87;

  // ========== PAYMENT INFO SECTION ==========
  drawRect(margin, y - 99.21, width - 2 * margin, 99.21, LIGHT_GRAY);

  const paymentTitle = hasArabicFont ? AR.paymentInfo : "PAYMENT INFORMATION";
  drawText(paymentTitle, width - margin - 14.17, y - 22.68, {
    font: hasArabicFont && arabicFont ? arabicFont : helveticaBold,
    size: 10,
    color: PRIMARY_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });

  const paymentLine1 = hasArabicFont ? AR.paymentTerms : "Payment Terms: Due upon receipt";
  const paymentLine2 = hasArabicFont ? AR.paymentMethod : "Payment Method: Secure online payment via Stripe";
  const paymentLine3 = hasArabicFont ? AR.paymentInstructions : "Please use the payment link provided in your email to complete the transaction.";

  drawText(paymentLine1, width - margin - 14.17, y - 45.35, {
    size: 9,
    color: TEXT_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });
  drawText(paymentLine2, width - margin - 14.17, y - 62.36, {
    size: 9,
    color: TEXT_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });
  drawText(paymentLine3, width - margin - 14.17, y - 79.37, {
    size: 9,
    color: TEXT_COLOR,
    align: "right",
    isArabic: hasArabicFont,
  });

  y -= 127.56;

  // ========== FOOTER ==========
  // Thank you
  const thankYou = hasArabicFont ? AR.thankYou : "Thank you for your business!";
  drawText(thankYou, width / 2, y, {
    font: hasArabicFont && arabicFont ? arabicFont : helveticaBold,
    size: 12,
    color: PRIMARY_COLOR,
    align: "center",
    isArabic: hasArabicFont,
  });

  // Footer line
  page.drawLine({
    start: { x: margin, y: 56.69 },
    end: { x: width - margin, y: 56.69 },
    thickness: 2.83,
    color: GOLD_COLOR,
  });

  // Footer text
  drawText(
    `${companyDetails.name} | ${companyDetails.website} | ${companyDetails.email}`,
    width / 2,
    34.02,
    {
      size: 8,
      color: GRAY_COLOR,
      align: "center",
    }
  );

  // Save and return base64
  const pdfBytes = await pdfDoc.save();
  const base64 = Buffer.from(pdfBytes).toString("base64");
  return base64;
}
