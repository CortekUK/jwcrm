import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Footer,
  PageNumber,
  BorderStyle,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  UnderlineType,
} from "docx";
import { companyDetails } from "@/config/company";
import type { WillPdfInput } from "@/lib/pdf/generateWillPDF";
import {
  buildCourtWillDocument,
  paraIsEmpty,
  type WillDocumentModel,
  type WillPara,
} from "@/lib/will/courtTemplate";

/**
 * Word (.docx) Last Will & Testament — BILINGUAL, TWO COLUMNS.
 *
 * Layout mirrors the lawyer's own templates (WILL_DXB_TR.docx /
 * WILL_AUH_TR.docx). In word/document.xml of those files the entire document
 * body is a single table with ONE row and TWO cells — cell 0 English, cell 1
 * Arabic, with no <w:bidiVisual>, so Word lays it out English LEFT / Arabic
 * RIGHT. Each cell contains that language's complete document, so the two
 * columns flow independently; they are NOT paired clause by clause.
 *
 *   [Abu Dhabi only] cover page      — its own 1x2 table (English | Arabic)
 *   [Dubai only]     branded English cover page (the DXB template has none)
 *   THE DOCUMENT — one 1x2 table:
 *       cell 0 = complete ENGLISH document (preamble, ONE..FOURTEEN, execution)
 *       cell 1 = complete ARABIC document  (preamble, أولاً..رابع عشر, execution)
 *   [Abu Dhabi only] court attestation block — its own table, one row per line
 *
 * All wording comes from the shared court template model
 * (@/lib/will/courtTemplate), which holds the lawyer's text verbatim — the
 * same model the PDF and the print preview consume, so they cannot drift.
 *
 * Arabic paragraphs are emitted with `bidirectional: true` and right
 * alignment so Word lays them out right-to-left and shapes the script itself.
 *
 * BOLD AND UNDERLINE COME FROM THE DATA. Every paragraph in the model is a list
 * of the lawyer's own formatting runs, and each becomes one docx TextRun with
 * that run's `bold` / `underline`. Nothing here decides what to embolden — the
 * lawyer's headings are "ORDINAL:" in bold followed by an underlined title, and
 * several of them are full sentences with only the ordinal bold.
 */

const GREEN = "0C5536";
const GREY = "5A5A5A";
const INK = "141414";
const AR_FONT = "Arial";

/** Invisible table borders — the lawyer's body table has tblBorders "none". */
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
} as const;

/** One row, two cells: English left, Arabic right — the lawyer's structure. */
function bilingualTable(en: Paragraph[], ar: Paragraph[]): Table {
  const cell = (children: Paragraph[], margins: { left: number; right: number }) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 0, bottom: 0, ...margins },
      // A cell must never be empty in OOXML.
      children: children.length > 0 ? children : [new Paragraph({ children: [] })],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4500, 4680], // as in the lawyer's tblGrid
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        cantSplit: false, // the row MUST be allowed to flow across pages
        children: [cell(en, { left: 0, right: 160 }), cell(ar, { left: 160, right: 0 })],
      }),
    ],
  });
}

const val = (v: unknown, fallback = "____________"): string => {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : fallback;
};

export async function generateWillDocx(input: WillPdfInput): Promise<Buffer> {
  const { answers, jurisdiction, clientName, draft, signature, signatureDate } = input;
  const isAUD = jurisdiction === "abu_dhabi";
  const cityLine = isAUD ? "Abu Dhabi, United Arab Emirates" : "Dubai, United Arab Emirates";

  const model: WillDocumentModel = buildCourtWillDocument({ answers, jurisdiction, clientName });

  /** Top-level document flow: cover table, body table, court table. */
  const children: (Paragraph | Table)[] = [];

  /** Paragraphs of the ENGLISH column (left cell of the body table). */
  const enCol: Paragraph[] = [];
  /** Paragraphs of the ARABIC column (right cell of the body table). */
  const arCol: Paragraph[] = [];

  const centered = (
    sink: Paragraph[],
    text: string,
    size: number,
    bold: boolean,
    color = INK
  ) =>
    sink.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: size * 10 },
        children: [new TextRun({ text, bold, size: size * 2, color, font: "Times New Roman" })],
      })
    );

  /**
   * The lawyer's runs → docx runs. Bold and underline are taken verbatim from
   * the run; only size / colour / font are ours.
   */
  const toRuns = (
    para: WillPara,
    opts: { size?: number; color?: string; ar?: boolean } = {}
  ): TextRun[] => {
    const { size = 10.5, color = INK, ar = false } = opts;
    return para.map(
      (r) =>
        new TextRun({
          text: r.t,
          bold: !!r.b,
          underline: r.u ? { type: UnderlineType.SINGLE } : undefined,
          size: Math.round(size * 2),
          color,
          font: ar ? AR_FONT : "Times New Roman",
          ...(ar ? { rightToLeft: true } : {}),
        })
    );
  };

  /** Plain string → one docx run, for the labels this file owns (not the will). */
  const plainRun = (
    text: string,
    opts: { size?: number; color?: string; ar?: boolean; bold?: boolean } = {}
  ): TextRun[] =>
    toRuns([{ t: text, ...(opts.bold ? { b: 1 as const } : {}) }], opts);

  const paragraph = (sink: Paragraph[], para: WillPara, opts: { size?: number } = {}) => {
    if (paraIsEmpty(para)) return;
    sink.push(
      new Paragraph({
        spacing: { after: 160 },
        children: toRuns(para, opts),
      })
    );
  };

  const paragraphAr = (
    sink: Paragraph[],
    para: WillPara,
    opts: { size?: number; color?: string } = {}
  ) => {
    if (paraIsEmpty(para)) return;
    sink.push(
      new Paragraph({
        spacing: { after: 160 },
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        children: toRuns(para, { ...opts, ar: true }),
      })
    );
  };

  /**
   * One numbered section: its first paragraph, then the rest.
   *
   * The first paragraph is NOT force-bolded and NOT enlarged: in the lawyer's
   * files it is the same 12pt as the body, and several of them ("NINE: If my
   * ____ does not survive me…") are ordinary sentences with only the ordinal in
   * bold. It only gets extra space above it, to separate the sections.
   */
  const clause = (sink: Paragraph[], paragraphs: WillPara[], lang: "en" | "ar") => {
    const lines = paragraphs.filter((p) => !paraIsEmpty(p));
    if (lines.length === 0) return;
    if (lang === "ar") {
      sink.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          children: toRuns(lines[0], { ar: true }),
        })
      );
      for (const body of lines.slice(1)) paragraphAr(sink, body);
    } else {
      sink.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: toRuns(lines[0]),
        })
      );
      for (const body of lines.slice(1)) paragraph(sink, body);
    }
  };

  // ---------- Cover page ----------
  if (model.cover) {
    // Abu Dhabi: the source has its own 1x2 cover table (English | Arabic).
    const coverEn: Paragraph[] = [];
    const coverAr: Paragraph[] = [];
    coverEn.push(new Paragraph({ children: [], spacing: { after: 1200 } }));
    coverAr.push(new Paragraph({ children: [], spacing: { after: 1200 } }));
    const centeredPara = (sink: Paragraph[], para: WillPara, size: number, color: string, ar: boolean) =>
      sink.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: size * 10 },
          ...(ar ? { bidirectional: true } : {}),
          children: toRuns(para, { size, color, ar }),
        })
      );
    model.cover.en.forEach((line, i) =>
      centeredPara(coverEn, line, i >= 2 && i <= 4 ? 18 : 11, i >= 2 && i <= 3 ? GREEN : GREY, false)
    );
    model.cover.ar.forEach((line, i) =>
      centeredPara(coverAr, line, i === 0 ? 18 : 12, i === 0 ? GREEN : INK, true)
    );
    children.push(bilingualTable(coverEn, coverAr));
  } else {
    // Dubai: the source template has no cover page, so keep the branded one.
    const coverEn: Paragraph[] = [];
    coverEn.push(new Paragraph({ children: [], spacing: { after: 800 } }));
    centered(coverEn, "LAST WILL AND", 20, true, GREEN);
    centered(coverEn, "TESTAMENT OF", 20, true, GREEN);
    coverEn.push(new Paragraph({ children: [], spacing: { after: 400 } }));
    centered(coverEn, val(clientName, "Client's Full Name").toUpperCase(), 18, true);
    coverEn.push(new Paragraph({ children: [], spacing: { after: 800 } }));
    centered(coverEn, companyDetails.legalName, 13, true);
    centered(coverEn, cityLine, 11, false, GREY);
    coverEn.push(new Paragraph({ children: [], spacing: { after: 100 } }));
    centered(coverEn, companyDetails.invoicePhone, 10, false, GREY);
    centered(coverEn, companyDetails.invoiceEmail.toLowerCase(), 10, false, GREY);
    children.push(...coverEn);
  }

  children.push(new Paragraph({ children: [], pageBreakBefore: true }));

  // ---------- English column ----------
  for (const line of model.preamble.en) paragraph(enCol, line);
  for (const section of model.sections) clause(enCol, section.en, "en");

  enCol.push(
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({ text: "EXECUTION AND ATTESTATION", bold: true, size: 22, color: GREEN, font: "Times New Roman" }),
      ],
    })
  );
  paragraph(enCol, [{ t: `${model.execution.en.nameLabel} ${model.execution.en.name}` }]);

  // Embed the captured signature when the will has been signed; otherwise
  // keep the ruled line for wet signing. Any decoding problem falls back to
  // the blank line rather than failing the whole document.
  let signatureRendered = false;
  if (signature) {
    try {
      const base64 = signature.includes(",") ? signature.split(",")[1] : signature;
      const imageData = Buffer.from(base64, "base64");
      if (imageData.length > 0) {
        enCol.push(
          new Paragraph({
            spacing: { before: 100, after: 0 },
            children: [
              new TextRun({ text: `${model.execution.en.signatureLabel} `, size: 22, font: "Times New Roman" }),
              new ImageRun({
                type: "png",
                data: imageData,
                // Half-width column, so the signature is scaled down from 180x60.
                transformation: { width: 140, height: 47 },
              }),
            ],
          })
        );
        if (signatureDate) {
          enCol.push(
            new Paragraph({
              spacing: { before: 0, after: 120 },
              children: [
                new TextRun({
                  text: `Signed electronically on ${new Date(signatureDate).toLocaleString("en-GB")}`,
                  size: 18,
                  color: "6E6E6E",
                  font: "Times New Roman",
                }),
              ],
            })
          );
        }
        signatureRendered = true;
      }
    } catch (err) {
      console.error("Failed to embed signature in will DOCX:", err);
    }
  }
  if (!signatureRendered) {
    paragraph(enCol, [{ t: `${model.execution.en.signatureLabel} ______________________________` }]);
  }

  // ---------- Arabic column ----------
  for (const line of model.preamble.ar) paragraphAr(arCol, line);
  for (const section of model.sections) clause(arCol, section.ar, "ar");

  paragraphAr(arCol, [{ t: `${model.execution.ar.nameLabel} ${model.execution.ar.name}` }]);
  paragraphAr(arCol, [{ t: `${model.execution.ar.signatureLabel} ______________________________` }]);

  // ---------- The document: one row, two cells (English | Arabic) ----------
  children.push(bilingualTable(enCol, arCol));

  // ---------- Court attestation (Abu Dhabi only) ----------
  // Its own table in the source; one row per line, English left / Arabic right.
  if (model.court) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 200 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "BEBEBE" } },
        children: [],
      })
    );
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [4500, 4680],
        borders: NO_BORDERS,
        rows: model.court.map((row, i) => {
          const isHeading = i === 0;
          return new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 0, bottom: 0, left: 0, right: 160 },
                children: [
                  new Paragraph({
                    spacing: { after: isHeading ? 160 : 100 },
                    children: [
                      ...toRuns(row.en, { size: 10.5, color: GREY }),
                      ...(isHeading
                        ? []
                        : plainRun(" ____________________", { size: 10.5, color: GREY })),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 0, bottom: 0, left: 160, right: 0 },
                children: [
                  new Paragraph({
                    spacing: { after: isHeading ? 160 : 100 },
                    bidirectional: true,
                    alignment: AlignmentType.RIGHT,
                    children: [
                      ...toRuns(row.ar, { size: 10.5, color: GREY, ar: true }),
                      ...(isHeading
                        ? []
                        : plainRun(" ____________________", { size: 10.5, color: GREY, ar: true })),
                    ],
                  }),
                ],
              }),
            ],
          });
        }),
      })
    );
  }

  const footerText = draft
    ? `DRAFT — This is the Last Will and Testament of ${val(clientName).toUpperCase()}`
    : `This is the Last Will and Testament of ${val(clientName).toUpperCase()}`;

  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: footerText, italics: true, size: 16, color: GREY, font: "Times New Roman" }),
                  new TextRun({ text: "   |   Page ", italics: true, size: 16, color: GREY, font: "Times New Roman" }),
                  new TextRun({ children: [PageNumber.CURRENT], italics: true, size: 16, color: GREY, font: "Times New Roman" }),
                  new TextRun({ text: " of ", italics: true, size: 16, color: GREY, font: "Times New Roman" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], italics: true, size: 16, color: GREY, font: "Times New Roman" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
