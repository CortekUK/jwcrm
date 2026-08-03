import { jsPDF } from "jspdf";
import { companyDetails } from "@/config/company";
import type { Answers, WillJurisdiction } from "@/types/will-form";
import {
  buildCourtWillDocument,
  paraIsEmpty,
  type WillPara,
} from "@/lib/will/courtTemplate";

/**
 * Last Will & Testament generator (PDF, jsPDF).
 *
 * ENGLISH ONLY — and deliberately so. jsPDF cannot shape Arabic script: it has
 * no bidi reordering and no Arabic letter joining, so Arabic text comes out as
 * disconnected, left-to-right glyphs. This is therefore the ONLY output path
 * that is not bilingual. The Word (.docx) generator and the on-screen print
 * preview both render the full bilingual document.
 *
 * All clause wording comes from the shared court template model
 * (@/lib/will/courtTemplate), which holds the lawyer's text verbatim. Nothing
 * in this file may restate legal wording.
 *
 * Paragraphs arrive as the lawyer's own formatting runs. jsPDF has no rich-text
 * primitive, so richParagraph() below does its own word wrapping across runs:
 * each word is measured in its own run's font style, bold runs are drawn with
 * the bold face, and underlined runs get a rule drawn under exactly the words
 * they cover (jsPDF has no underline attribute, so it is stroked by hand at the
 * measured width — the underline therefore hugs the words, as in the source).
 */

export type WillPdfInput = {
  answers: Answers;
  jurisdiction: WillJurisdiction;
  clientName: string;
  draft?: boolean; // add a DRAFT watermark
  /**
   * Base64 PNG data URL of the testator's signature on the FINALISED will
   * (wills.client_signature). When present it is drawn onto the execution
   * block instead of a blank ruled line. Absent for drafts, which are
   * produced before the client has signed anything.
   */
  signature?: string | null;
  signatureDate?: string | null;
};

const val = (v: unknown, fallback = "____________"): string => {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : fallback;
};

export function generateWillPDF(input: WillPdfInput): string {
  const { answers, jurisdiction, clientName, draft, signature, signatureDate } = input;
  const isAUD = jurisdiction === "abu_dhabi";
  const cityLine = isAUD ? "Abu Dhabi, United Arab Emirates" : "Dubai, United Arab Emirates";

  const model = buildCourtWillDocument({ answers, jurisdiction, clientName });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 20;
  const RIGHT = pageWidth - M;
  const contentW = RIGHT - M;
  const BOTTOM = pageHeight - 20;

  let y = M;

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = M;
    }
  };

  const paragraph = (
    text: string,
    opts: { size?: number; bold?: boolean; gap?: number; indent?: number } = {}
  ) => {
    const { size = 10.5, bold = false, gap = 3, indent = 0 } = opts;
    doc.setFont("times", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(text, contentW - indent) as string[];
    const lineH = size * 0.42;
    for (const line of lines) {
      ensureSpace(lineH + 1);
      doc.text(line, M + indent, y);
      y += lineH;
    }
    y += gap;
  };

  /**
   * Draw one paragraph of formatting runs, wrapping across runs.
   *
   * Words are laid out one at a time so that a bold span and the plain text
   * around it can share a line. Underline is stroked under the drawn width of
   * each underlined fragment, which is the only way to underline in jsPDF and
   * happens to be exactly the behaviour the lawyer's templates have (the rule
   * hugs the words, it is not a full-width heading rule).
   */
  const richParagraph = (
    para: WillPara,
    opts: { size?: number; gap?: number; color?: [number, number, number] } = {}
  ) => {
    const { size = 10.5, gap = 3, color = [20, 20, 20] } = opts;
    if (paraIsEmpty(para)) return;
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lineH = size * 0.42;

    // Flatten to word-level tokens that remember their run's formatting.
    type Tok = { t: string; b: boolean; u: boolean };
    const toks: Tok[] = [];
    for (const run of para) {
      const parts = run.t.split(/(\s+)/);
      for (const p of parts) {
        if (p.length === 0) continue;
        toks.push({ t: p, b: !!run.b, u: !!run.u });
      }
    }

    let x = M;
    let lineStarted = false;
    ensureSpace(lineH + 1);

    // An underlined span is stroked as ONE continuous rule, including the
    // spaces inside it, so it reads as it does in Word rather than as a row of
    // dashes under individual words. It is flushed at a line break, when the
    // underline stops, or at the end of the paragraph.
    let uStart: number | null = null;
    const flushUnderline = (xEnd: number) => {
      if (uStart === null) return;
      doc.setDrawColor(...color);
      doc.setLineWidth(0.2);
      doc.line(uStart, y + size * 0.09, xEnd, y + size * 0.09);
      uStart = null;
    };

    const newline = () => {
      flushUnderline(x);
      y += lineH;
      ensureSpace(lineH + 1);
      x = M;
      lineStarted = false;
    };

    for (const tok of toks) {
      const isSpace = /^\s+$/.test(tok.t);
      doc.setFont("times", tok.b ? "bold" : "normal");
      const w = doc.getTextWidth(tok.t);
      if (isSpace) {
        if (!lineStarted) continue; // never open a line with a space
        if (!tok.u) flushUnderline(x); // a plain space ends the rule
        x += w;
        continue;
      }
      if (lineStarted && x + w > RIGHT) newline();
      if (!tok.u) flushUnderline(x);
      else if (uStart === null) uStart = x;
      doc.setFont("times", tok.b ? "bold" : "normal");
      doc.text(tok.t, x, y);
      x += w;
      lineStarted = true;
    }
    flushUnderline(x);
    y += lineH + gap;
    // The next paragraph must start at a known font state.
    doc.setFont("times", "normal");
  };

  /** A numbered section: its own opening paragraph, then the rest. */
  const clause = (paragraphs: WillPara[]) => {
    if (paragraphs.length === 0) return;
    ensureSpace(14);
    // No forced bold, no colour, no larger type: in the lawyer's templates the
    // heading line is the same size as the body and only the ordinal (and the
    // underlined title) is emphasised. That emphasis is in the run data.
    y += 2;
    richParagraph(paragraphs[0], { gap: 2 });
    for (const body of paragraphs.slice(1)) {
      if (paraIsEmpty(body)) continue;
      richParagraph(body, { gap: 4 });
    }
    y += 1;
  };

  const centered = (
    text: string,
    size: number,
    bold: boolean,
    color: [number, number, number] = [20, 20, 20]
  ) => {
    doc.setFont("times", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    ensureSpace(size * 0.5);
    doc.text(text, pageWidth / 2, y, { align: "center" });
    y += size * 0.5;
  };

  // ---------- Cover page ----------
  // The branded cover carries the same content as the lawyer's English cover
  // block (title / testator / firm / city / contact), laid out for print.
  y = 60;
  centered("LAST WILL AND", 20, true, [12, 85, 54]);
  centered("TESTAMENT OF", 20, true, [12, 85, 54]);
  y += 16;
  centered(val(clientName, "Client's Full Name").toUpperCase(), 18, true);
  y += 40;
  centered(companyDetails.legalName, 13, true);
  centered(cityLine, 11, false, [90, 90, 90]);
  y += 6;
  centered(companyDetails.invoicePhone, 10, false, [90, 90, 90]);
  centered(companyDetails.invoiceEmail.toLowerCase(), 10, false, [90, 90, 90]);

  // ---------- Body (English court template, verbatim) ----------
  doc.addPage();
  y = M;

  for (const line of model.preamble.en) {
    richParagraph(line, { gap: 5 });
  }

  for (const section of model.sections) {
    clause(section.en.filter((p) => !paraIsEmpty(p)));
  }

  // ---------- Execution ----------
  ensureSpace(40);
  y += 4;
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(12, 85, 54);
  doc.text("EXECUTION AND ATTESTATION", M, y);
  y += 7;
  paragraph(`${model.execution.en.nameLabel} ${model.execution.en.name}`, { gap: 10 });

  if (signature) {
    // Draw the captured signature in place of the ruled line. Wrapped so a
    // malformed data URL can never abort generation of the whole will —
    // worst case we fall back to the blank line below.
    let drawn = false;
    try {
      ensureSpace(30);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(18, 18, 18);
      doc.text(model.execution.en.signatureLabel, M, y);
      doc.addImage(signature, "PNG", M + 28, y - 10, 55, 18);
      y += 14;
      doc.setDrawColor(190, 190, 190);
      doc.line(M + 28, y, M + 100, y);
      y += 6;
      if (signatureDate) {
        doc.setFontSize(9.5);
        doc.setTextColor(110, 110, 110);
        doc.text(
          `Signed electronically on ${new Date(signatureDate).toLocaleString("en-GB")}`,
          M + 28,
          y
        );
        y += 8;
      }
      drawn = true;
    } catch (err) {
      console.error("Failed to embed signature in will PDF:", err);
    }
    if (!drawn) {
      paragraph(`${model.execution.en.signatureLabel} ______________________________`, { gap: 8 });
    }
  } else {
    paragraph(`${model.execution.en.signatureLabel} ______________________________`, { gap: 8 });
  }

  // ---------- Court attestation (Abu Dhabi only) ----------
  if (model.court) {
    ensureSpace(30);
    y += 6;
    doc.setDrawColor(190, 190, 190);
    doc.line(M, y, RIGHT, y);
    y += 8;
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(90, 90, 90);
    richParagraph(model.court[0].en, { size: 10.5, gap: 4, color: [90, 90, 90] });
    for (const row of model.court.slice(1)) {
      richParagraph([...row.en, { t: " ____________________" }], {
        size: 10.5,
        gap: 4,
        color: [90, 90, 90],
      });
    }
  }

  // Footer line on every page + optional DRAFT watermark
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `This is the Last Will and Testament of ${val(clientName).toUpperCase()}`,
      pageWidth / 2,
      pageHeight - 12,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });

    if (draft) {
      // Faint diagonal JUST WILLS brand watermark across every page.
      doc.setFont("times", "bold");
      doc.setFontSize(46);
      doc.setTextColor(198, 160, 59);
      doc.saveGraphicsState();
      // @ts-expect-error setGState exists at runtime via jsPDF
      doc.setGState(new doc.GState({ opacity: 0.07 }));
      doc.text(
        companyDetails.name.toUpperCase(),
        pageWidth / 2,
        pageHeight / 2,
        { align: "center", angle: 45 }
      );
      doc.restoreGraphicsState();
    }
  }

  return doc.output("datauristring").split(",")[1]; // base64 (no data: prefix)
}
