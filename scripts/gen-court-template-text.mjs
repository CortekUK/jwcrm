#!/usr/bin/env node
/**
 * Regenerates src/lib/will/courtTemplateText.ts from the rich (run-level)
 * extraction of the lawyer's Word templates.
 *
 *   node scripts/gen-court-template-text.mjs <path-to-rich.json>
 *
 * rich.json is produced by unzipping WILL_AUH_TR.docx / WILL_DXB_TR.docx and
 * walking word/document.xml, keeping every <w:r> with its <w:b/> and <w:u> run
 * properties. Shape:
 *
 *   { "<jurisdiction>": {
 *       "en":    [ paragraph, ... ],       // body table, English cell
 *       "ar":    [ paragraph, ... ],       // body table, Arabic cell
 *       "cover": { "en": [...], "ar": [...], "bidiVisual": true },
 *       "court": [ [cell, cell, ...], ... ]
 *   } }
 *
 * where paragraph = run[] and run = { t, b?, u? }.
 *
 * NOTHING in this script rewords, translates or tidies text. It only:
 *   - trims trailing whitespace off each paragraph (Word padding),
 *   - drops the stray "\" paragraph in the Dubai English section TWO,
 *   - splits the flat paragraph list into preamble / 14 sections / execution
 *     at the drafter's own numbered headings, and
 *   - pairs the court-table cells English-with-Arabic.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "lib", "will", "courtTemplateText.ts");

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/gen-court-template-text.mjs <rich.json>");
  process.exit(1);
}
const rich = JSON.parse(readFileSync(src, "utf8"));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const text = (para) => para.map((r) => r.t).join("");

/** Trailing whitespace is Word padding, never legal wording. */
function rtrimPara(para) {
  const out = para.map((r) => ({ ...r }));
  for (let i = out.length - 1; i >= 0; i--) {
    out[i].t = out[i].t.replace(/\s+$/u, "");
    if (out[i].t.length > 0) break;
  }
  return out.filter((r) => r.t.length > 0);
}

const EN_ORDINALS = [
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN",
  "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN",
];

// The drafter is not consistent about the tanween ("تاسعا" / "تاسعاً"), so the
// ordinals are matched with an optional trailing diacritic.
const AR_ORDINALS = [
  "أولا", "ثانيا", "ثالثا", "رابعا", "خامسا", "سادسا", "سابعا",
  "ثامنا", "تاسعا", "عاشرا", "حادي عشر", "ثاني عشر", "ثالث عشر", "رابع عشر",
];

function headingMatcher(lang, ordinal) {
  if (lang === "en") return (t) => new RegExp(`^${ordinal}\\s*:`).test(t);
  return (t) => new RegExp(`^${ordinal}ً?\\s*:`).test(t);
}

/** Where each language's document stops and the NAME/SIGNATURE block begins. */
const EXECUTION_START = {
  en: (t) => /^NAME\s*:/.test(t),
  ar: (t) => /^الإسم\s*:/.test(t),
};

function splitDocument(paras, lang) {
  const cleaned = paras
    .map(rtrimPara)
    .filter((p) => {
      const t = text(p);
      // A typographical artifact in the lawyer's Dubai file, not wording.
      return t.length > 0 && t !== "\\";
    });

  const ordinals = lang === "en" ? EN_ORDINALS : AR_ORDINALS;
  const headings = [];
  let from = 0;
  for (const ord of ordinals) {
    const match = headingMatcher(lang, ord);
    let idx = -1;
    for (let i = from; i < cleaned.length; i++) {
      if (match(text(cleaned[i]))) { idx = i; break; }
    }
    if (idx < 0) throw new Error(`heading "${ord}" not found (${lang})`);
    headings.push(idx);
    from = idx + 1;
  }

  let end = cleaned.length;
  for (let i = headings[headings.length - 1]; i < cleaned.length; i++) {
    if (EXECUTION_START[lang](text(cleaned[i]))) { end = i; break; }
  }

  const preamble = cleaned.slice(0, headings[0]);
  const sections = headings.map((start, n) =>
    cleaned.slice(start, n + 1 < headings.length ? headings[n + 1] : end)
  );
  return { preamble, sections };
}

const isArabic = (t) => /[؀-ۿ]/.test(t);

/**
 * The court table is a grid of mostly-empty layout cells. Reading it in
 * document order gives alternating English / Arabic label cells, which is
 * exactly the bilingual row model the renderers consume.
 */
function pairCourtCells(rows) {
  const cells = [];
  for (const row of rows) {
    for (const cell of row) {
      for (const para of cell) {
        const p = rtrimPara(para);
        if (text(p).length > 0) cells.push(p);
      }
    }
  }
  const pairs = [];
  for (let i = 0; i < cells.length; i++) {
    const en = cells[i];
    if (isArabic(text(en))) throw new Error(`unexpected Arabic-first court cell: ${text(en)}`);
    const next = cells[i + 1];
    if (next && isArabic(text(next))) {
      pairs.push({ en, ar: next });
      i++;
    } else {
      pairs.push({ en, ar: [] });
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

const model = {};
for (const j of ["abu_dhabi", "dubai"]) {
  const j_ = rich[j];
  const en = splitDocument(j_.en, "en");
  const ar = splitDocument(j_.ar, "ar");
  if (en.sections.length !== ar.sections.length) {
    throw new Error(`${j}: section count mismatch`);
  }

  model[j] = {
    cover: j_.cover
      ? {
          en: j_.cover.en.map(rtrimPara).filter((p) => text(p).length > 0),
          ar: j_.cover.ar.map(rtrimPara).filter((p) => text(p).length > 0),
        }
      : null,
    preamble: { en: en.preamble, ar: ar.preamble },
    sections: en.sections.map((s, i) => ({ en: s, ar: ar.sections[i] })),
    court: j_.court ? pairCourtCells(j_.court) : null,
  };
}

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------

const q = (s) => JSON.stringify(s);
const run = (r) =>
  `{ t: ${q(r.t)}${r.b ? ", b: 1" : ""}${r.u ? ", u: 1" : ""} }`;
const para = (p, indent) => `[${p.map(run).join(", ")}]`;
const paraList = (ps, ind) =>
  ps.length === 0 ? "[]" : `[\n${ps.map((p) => `${ind}  ${para(p)},`).join("\n")}\n${ind}]`;

const HEADER = `/**
 * VERBATIM court-template text supplied by JW Legal Consultants' lawyer.
 *
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * Produced by scripts/gen-court-template-text.mjs from a run-level extraction
 * of the authoritative Word templates (WILL_AUH_TR.docx / WILL_DXB_TR.docx).
 * To change anything here, change the templates and re-run the generator.
 *
 * This is a legal instrument filed with UAE courts, so the text is carried
 * character-for-character INCLUDING each run's bold / underline formatting:
 * the lawyer's headings are bold with an underlined title, and body paragraphs
 * carry bold emphasis (e.g. "UNITED ARAB EMIRATES"). Renderers must take that
 * formatting from this data and must never fake it with CSS (no uppercasing,
 * no heading rules).
 *
 * The only deviations from the source files are:
 *   - the XML escape "&amp;" is decoded to "&";
 *   - trailing whitespace is trimmed off each paragraph (Word padding);
 *   - a stray "\\\\" paragraph in the Dubai English section TWO was dropped
 *     (a typographical artifact in the lawyer's file, not legal wording).
 *
 * The underscore runs ("________") are the drafter's blanks and are preserved
 * exactly, with their own formatting. buildCourtWillDocument() in
 * ./courtTemplate.ts substitutes form data into them positionally, preserving
 * the formatting of the run each blank sits in; any blank with no data keeps
 * its original underscores.
 *
 * Structure per jurisdiction:
 *   cover      - Abu Dhabi only: the cover page (English block | Arabic block).
 *                In the source the cover table carries <w:bidiVisual/> with the
 *                Arabic cell first, which Word displays English-left — so it is
 *                stored here English-first like everything else.
 *   preamble   - the "I, ____ ..." identification line
 *   sections   - the 14 numbered sections, index 0 = ONE/أولاً .. 13 = FOURTEEN/رابع عشر.
 *                Each section's first paragraph is its own heading.
 *                Section 13 stops after FINALLY / أخيرا; the NAME/SIGNATURE block and
 *                the court attestation block that follow it in the source are held
 *                separately (see \`court\` below and the execution block in
 *                courtTemplate.ts) because the renderers must inject a
 *                signature image there.
 *   court      - Abu Dhabi only: the "To be completed by the Court" block, as
 *                English/Arabic label pairs in source order.
 */

/** One formatting run: a span of text with optional bold / underline. */
export type WillRun = { t: string; b?: 1; u?: 1 };

/** One paragraph: an ordered list of runs. Concatenating \`t\` gives the text. */
export type WillPara = WillRun[];

export type CourtTemplateBlock = { en: WillPara[]; ar: WillPara[] };

export type CourtTemplateText = {
  cover: CourtTemplateBlock | null;
  preamble: CourtTemplateBlock;
  sections: CourtTemplateBlock[];
  court: { en: WillPara; ar: WillPara }[] | null;
};
`;

const lines = [HEADER];
lines.push(
  `\nexport const COURT_TEMPLATE_TEXT: Record<"abu_dhabi" | "dubai", CourtTemplateText> = {`
);
for (const j of ["abu_dhabi", "dubai"]) {
  const m = model[j];
  lines.push(`  ${q(j)}: {`);
  if (m.cover) {
    lines.push(`    cover: {`);
    lines.push(`      en: ${paraList(m.cover.en, "      ")},`);
    lines.push(`      ar: ${paraList(m.cover.ar, "      ")},`);
    lines.push(`    },`);
  } else {
    lines.push(`    cover: null,`);
  }
  lines.push(`    preamble: {`);
  lines.push(`      en: ${paraList(m.preamble.en, "      ")},`);
  lines.push(`      ar: ${paraList(m.preamble.ar, "      ")},`);
  lines.push(`    },`);
  if (m.court) {
    lines.push(`    court: [`);
    for (const row of m.court) {
      lines.push(`      { en: ${para(row.en)}, ar: ${para(row.ar)} },`);
    }
    lines.push(`    ],`);
  } else {
    lines.push(`    court: null,`);
  }
  lines.push(`    sections: [`);
  for (const sec of m.sections) {
    lines.push(`      {`);
    lines.push(`        en: ${paraList(sec.en, "        ")},`);
    lines.push(`        ar: ${paraList(sec.ar, "        ")},`);
    lines.push(`      },`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
}
lines.push(`};\n`);

writeFileSync(OUT, lines.join("\n"), "utf8");

// ---------------------------------------------------------------------------
// self-check
// ---------------------------------------------------------------------------
let bold = 0;
let und = 0;
let runs = 0;
const walk = (ps) => ps.forEach((p) => p.forEach((r) => { runs++; if (r.b) bold++; if (r.u) und++; }));
for (const j of ["abu_dhabi", "dubai"]) {
  const m = model[j];
  let b = 0, u = 0, n = 0, sec = 0;
  const count = (ps) => ps.forEach((p) => p.forEach((r) => { n++; if (r.b) b++; if (r.u) u++; }));
  count(m.preamble.en); count(m.preamble.ar);
  m.sections.forEach((s) => { count(s.en); count(s.ar); sec++; });
  console.log(
    `${j}: sections=${sec} runs=${n} bold=${b} underlined=${u}` +
      ` cover=${m.cover ? m.cover.en.length + "/" + m.cover.ar.length : "none"}` +
      ` court=${m.court ? m.court.length : "none"}`
  );
  walk(m.preamble.en); walk(m.preamble.ar);
  m.sections.forEach((s) => { walk(s.en); walk(s.ar); });
}
console.log(`total: runs=${runs} bold=${bold} underlined=${und}`);
console.log(`wrote ${OUT}`);
