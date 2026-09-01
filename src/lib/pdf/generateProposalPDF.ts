import { jsPDF } from "jspdf";
import { companyDetails } from "@/config/company";
import { type InvoiceLineItem } from "./invoiceLineItems";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { splitAroundFeeTable } from "@/lib/proposal-content";

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
  vatRate?: number | null; // per-proposal VAT override (percent); null/undefined = company default
  vatAmount?: number | null; // absolute VAT override; wins over vatRate
};

// Colors
const PRIMARY_COLOR: [number, number, number] = [12, 85, 54]; // #0C5536
const GOLD_COLOR: [number, number, number] = [198, 160, 59]; // #C6A03B
const TEXT_COLOR: [number, number, number] = [34, 34, 34]; // #222222
const GRAY_COLOR: [number, number, number] = [102, 102, 102]; // #666666
const LIGHT_GRAY: [number, number, number] = [250, 250, 248]; // #FAFAF8

// Sentinels that carry <strong>/<b> through the tag-stripping step. The body
// used to be flattened to one flat font, which lost every heading and the
// "Stage 1 –" labels the client's wording depends on.
const BOLD_ON = "\u0001";
const BOLD_OFF = "\u0002";

// Strip HTML tags and convert to plain text with basic formatting
function htmlToPlainText(html: string): string[] {
  let listCounter = 0;
  let inOrderedList = false;

  // Process ordered lists with numbering
  let text = html
    .replace(/<(strong|b)(\s[^>]*)?>/gi, BOLD_ON)
    .replace(/<\/(strong|b)>/gi, BOLD_OFF)
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

  const lineHeight = 5;
  const maxWidth = pageWidth - 2 * margin - 10;
  // Space kept clear at the bottom of every page for the footer rule and text.
  const FOOTER_RESERVE = 34;

  type Run = { text: string; bold: boolean };

  /** Split a line on the bold sentinels into runs of styled text. */
  const toRuns = (line: string): Run[] => {
    const runs: Run[] = [];
    let bold = false;
    let buffer = "";
    for (const ch of line) {
      if (ch === BOLD_ON || ch === BOLD_OFF) {
        if (buffer) runs.push({ text: buffer, bold });
        buffer = "";
        bold = ch === BOLD_ON;
      } else {
        buffer += ch;
      }
    }
    if (buffer) runs.push({ text: buffer, bold });
    return runs.length ? runs : [{ text: "", bold: false }];
  };

  const runWidth = (run: Run) => {
    doc.setFont("helvetica", run.bold ? "bold" : "normal");
    return doc.getTextWidth(run.text);
  };

  /**
   * Word-wrap across styled runs.
   *
   * jsPDF's splitTextToSize only understands one font at a time, so it cannot
   * wrap a line that is part bold ("Stage 1 – Understanding your…"). This
   * measures word by word in each run's own font instead.
   */
  const wrapRuns = (runs: Run[], firstWidth: number, restWidth: number): Run[][] => {
    const lines: Run[][] = [];
    let current: Run[] = [];
    let used = 0;
    let limit = firstWidth;

    const push = () => {
      lines.push(current);
      current = [];
      used = 0;
      limit = restWidth;
    };

    for (const run of runs) {
      // Keep the spaces so words rejoin exactly as written.
      for (const word of run.text.split(/(\s+)/)) {
        if (!word) continue;
        const piece: Run = { text: word, bold: run.bold };
        const w = runWidth(piece);
        if (used + w > limit && current.length > 0 && word.trim() !== "") {
          push();
        }
        // A leading space after a wrap would indent the line; drop it.
        if (current.length === 0 && piece.text.trim() === "") continue;
        current.push(piece);
        used += w;
      }
    }
    if (current.length) lines.push(current);
    return lines.length ? lines : [[]];
  };

  type Block =
    | { kind: "gap"; height: number }
    | {
        kind: "text";
        lines: Run[][];
        height: number;
        baseX: number;
        hangX: number;
        isHeading: boolean;
      };

  // Renders a chunk of the TipTap body, honouring inline bold.
  const renderBodyText = (html: string) => {
    const contentLines = htmlToPlainText(html);
    if (contentLines.length === 1 && contentLines[0] === "") return;

    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Measure everything up front. Deciding page breaks needs to know how tall
    // the CONTENT AFTER a heading is, which is not knowable while streaming
    // line by line — that is why the timeline heading kept being left behind on
    // its own while its stages moved to the next page.
    const blocks: Block[] = contentLines.map((line): Block => {
      if (line.trim() === "") return { kind: "gap", height: 3 };

      // List items get a hanging indent so wrapped text lines up under the
      // first word instead of running back to the bullet.
      const bulletMatch = line.match(/^\s*(\u2022|\d+\.)\s+/);
      const baseX = margin + 5 + (bulletMatch ? 4 : 0);
      const hangX = bulletMatch ? baseX + doc.getTextWidth("\u2022  ") : baseX;

      const runs = toRuns(line.replace(/^\s+/, ""));
      const lines = wrapRuns(
        runs,
        maxWidth - (baseX - margin - 5),
        maxWidth - (hangX - margin - 5)
      );
      return {
        kind: "text",
        lines,
        height: lines.length * lineHeight,
        baseX,
        hangX,
        // A short, wholly bold line introduces what follows.
        isHeading:
          line.replace(/[\u0001\u0002]/g, "").trim().length < 60 &&
          line.trimStart().startsWith(BOLD_ON),
      };
    });

    // How much of what follows a heading must travel with it. A heading is
    // useless without its section, so the whole run of blocks up to the next
    // heading is measured — capped, so a very long section still breaks
    // somewhere rather than pushing a mostly-empty page.
    const KEEP_WITH_HEADING_CAP = 60;
    const followingHeight = (start: number): number => {
      let total = 0;
      for (let i = start; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.kind === "text" && b.isHeading) break;
        total += b.height;
        if (total >= KEEP_WITH_HEADING_CAP) return KEEP_WITH_HEADING_CAP;
      }
      return total;
    };

    blocks.forEach((block, idx) => {
      if (block.kind === "gap") {
        y += block.height;
        return;
      }

      const needed = block.isHeading
        ? block.height + followingHeight(idx + 1)
        : block.height;

      // FOOTER_RESERVE keeps body text clear of the footer rule, which is drawn
      // on every page at a fixed offset.
      if (y + needed > pageHeight - FOOTER_RESERVE) {
        doc.addPage();
        y = margin;
      }

      block.lines.forEach((lineRuns, i) => {
        let x = i === 0 ? block.baseX : block.hangX;
        for (const run of lineRuns) {
          doc.setFont("helvetica", run.bold ? "bold" : "normal");
          doc.text(run.text, x, y);
          x += doc.getTextWidth(run.text);
        }
        y += lineHeight;
      });
      doc.setFont("helvetica", "normal");
    });
  };

  // ========== ITEMISED CHARGES ==========
  // Single source of truth for the money, so a per-proposal VAT override in the
  // database can never disagree with what the client is shown.
  const { items, subtotal, vatAmount, vatLabel, invoiceTotal, staged, upfrontTotal, laterTotal } =
    computeInvoiceAmounts(
      {
        amount: data.amount,
        line_items: data.lineItems,
        vat_rate: data.vatRate,
        vat_amount: data.vatAmount,
      },
      companyDetails.vatRate
    );

  const drawFeeTable = () => {
    if (y > pageHeight - FOOTER_RESERVE - 26 - items.length * 8) {
      doc.addPage();
      y = margin;
    }

    const tableX = margin;
    const tableW = pageWidth - 2 * margin;
    const descColW = tableW * 0.7;
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

    // Item rows. A description may carry hard line breaks (the client itemises
    // e.g. a court fee with its per-person note underneath), so each row is
    // sized to its own text instead of being clipped to one line.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    for (const item of items) {
      const descLines: string[] = item.description
        .split("\n")
        .flatMap((part) => doc.splitTextToSize(part, descColW - 8) as string[]);
      // Say WHEN each charge falls due. Without it the client sees only the
      // 9,450 total and has no way to know that a little over two thirds of it
      // is what actually starts the work.
      const stageTag = staged
        ? item.stage === "upfront"
          ? "Payable upfront"
          : "At court appointment stage"
        : null;
      const thisRowH = Math.max(
        rowH,
        descLines.length * lineHeight + 3 + (stageTag ? 4 : 0)
      );

      if (y + thisRowH > pageHeight - FOOTER_RESERVE - 6) {
        doc.addPage();
        y = margin;
      }

      doc.setDrawColor(220, 220, 218);
      doc.rect(tableX, y, tableW, thisRowH);
      doc.setTextColor(...TEXT_COLOR);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text(descLines, tableX + 4, y + 5.5);
      doc.text(formatCurrency(item.amount), tableX + tableW - 4, y + 5.5, { align: "right" });

      if (stageTag) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...(item.stage === "upfront" ? PRIMARY_COLOR : GRAY_COLOR));
        doc.text(stageTag, tableX + 4, y + 5.5 + descLines.length * lineHeight);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXT_COLOR);
      }
      y += thisRowH;
    }

    y += 4;

    // Totals block.
    //
    // The label and the value get their own columns and are BOTH right-aligned:
    // left-aligning the label at the amount column left it only ~50mm to share
    // with the value, so "Total Amount:" in 11pt bold ran straight into
    // "AED 9,450.00". Reserving the value column keeps them apart at any
    // amount, currency or VAT label.
    const valueRightX = tableX + tableW - 4;
    const valueColW = 34;
    const labelRightX = valueRightX - valueColW;
    const totalsX = tableX + descColW;
    const drawTotalRow = (label: string, value: string, emphasize = false) => {
      doc.setFontSize(emphasize ? 11 : 9.5);
      doc.setFont("helvetica", emphasize ? "bold" : "normal");
      doc.setTextColor(...(emphasize ? PRIMARY_COLOR : GRAY_COLOR));
      doc.text(label, labelRightX, y, { align: "right" });
      doc.setTextColor(...(emphasize ? PRIMARY_COLOR : TEXT_COLOR));
      doc.text(value, valueRightX, y, { align: "right" });
      y += emphasize ? 8 : 6;
    };
    drawTotalRow("Sub-Total:", formatCurrency(subtotal));
    drawTotalRow(`${vatLabel}:`, formatCurrency(vatAmount));
    y += 2;
    doc.setDrawColor(...GOLD_COLOR);
    doc.setLineWidth(0.5);
    doc.line(totalsX, y - 5, tableX + tableW, y - 5);
    drawTotalRow("Total Amount:", formatCurrency(invoiceTotal), true);

    // The line the client actually acts on: what leaving today costs, versus
    // what waits until the court date. Only shown when the invoice is genuinely
    // split, so an ordinary proposal is unchanged.
    if (staged && laterTotal > 0) {
      y += 2;
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(tableX, y, tableW, 16, 2, 2, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PRIMARY_COLOR);
      doc.text(
        `Payable now to begin drafting: ${formatCurrency(upfrontTotal)}`,
        tableX + 5,
        y + 6.5
      );
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY_COLOR);
      doc.text(
        `Remaining ${formatCurrency(laterTotal)} payable at the court appointment stage.`,
        tableX + 5,
        y + 12
      );
      y += 20;
    }
  };

  // The body cannot contain a real table (the editor has no table extension and
  // htmlToPlainText would flatten one), so it carries a placeholder token and
  // the table is drawn here, exactly where the token sits. Proposals saved
  // before the token existed have none: `before` is then the whole body and
  // `after` is empty, which reproduces today's body-then-table order unchanged.
  const { before, after } = splitAroundFeeTable(data.proposalContent);

  renderBodyText(before);
  y += 10;
  drawFeeTable();
  y += 10;
  renderBodyText(after);

  y += 15;

  // ========== FOOTER ==========
  // Drawn on EVERY page. It used to be drawn once, at the end, which landed it
  // on whichever page the content happened to finish on and left a two-page
  // proposal with an unfinished-looking first page.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    doc.setDrawColor(...GOLD_COLOR);
    doc.setLineWidth(1);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

    // The sign-off belongs on the last page only; repeating it mid-document
    // would read as the proposal ending there.
    if (page === pageCount) {
      doc.setTextColor(...PRIMARY_COLOR);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Thank you for considering Just Wills.", pageWidth / 2, pageHeight - 18, {
        align: "center",
      });
    }

    doc.setTextColor(...GRAY_COLOR);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${companyDetails.name} | ${companyDetails.address} | ${companyDetails.email}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    if (pageCount > 1) {
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 10, {
        align: "right",
      });
    }
  }

  // Return base64 string
  return doc.output("datauristring").split(",")[1];
}
