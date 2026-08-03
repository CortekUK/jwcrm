import type { Answers, WillJurisdiction } from "@/types/will-form";
import {
  COURT_TEMPLATE_TEXT,
  type CourtTemplateBlock,
  type WillPara,
  type WillRun,
} from "./courtTemplateText";

export type { WillPara, WillRun } from "./courtTemplateText";

/**
 * The single source of truth for the bilingual (English + Arabic) JW court will.
 *
 * All clause wording lives verbatim in ./courtTemplateText.ts, extracted from the
 * lawyer's authoritative Word templates. This module does exactly two things:
 *
 *   1. substitutes the client's form data into the drafter's underscore blanks
 *      (leaving the original underscores in place wherever we have no data), and
 *   2. exposes the result as a render-agnostic document model.
 *
 * Paragraphs are RUN LISTS, not strings: every span carries the lawyer's own
 * bold / underline. Substitution therefore edits run text in place and keeps
 * each run's formatting — a blank that is bold in the template stays bold once
 * the client's name is written into it. Renderers must take bold/underline from
 * these runs and must never synthesise formatting of their own.
 *
 * Every renderer — the jsPDF PDF, the Word .docx, and the on-screen print
 * preview — consumes this one model, so their wording cannot drift apart.
 *
 * Layout follows the lawyer's own files and is SEQUENTIAL, not side-by-side:
 * the complete English document, then the complete Arabic document. Abu Dhabi
 * additionally opens with a cover page (Arabic block, then English block) and
 * closes with a bilingual court attestation block.
 */

export type Lang = "en" | "ar";

/**
 * A block of document text in both languages, split into paragraphs.
 * Each paragraph is a list of formatting runs (see WillRun).
 */
export type WillClause = { en: WillPara[]; ar: WillPara[] };

/** Plain text of a paragraph — for measuring, filtering and search only. */
export const paraText = (p: WillPara): string => p.map((r) => r.t).join("");

/** True when a paragraph carries no visible text. */
export const paraIsEmpty = (p: WillPara): boolean => paraText(p).trim().length === 0;

export type WillExecutionBlock = {
  nameLabel: string;
  /** "MR. <client>" / "السيد/ <client>" — the lawyer's sample name is replaced. */
  name: string;
  signatureLabel: string;
};

export type WillDocumentModel = {
  jurisdiction: WillJurisdiction;
  /** Abu Dhabi only. Arabic cover block first, then the English cover block. */
  cover: WillClause | null;
  /** The "I, ____, ____ National, born on ____ …" identification line. */
  preamble: WillClause;
  /** The 14 numbered sections in order: [0] = ONE / أولاً … [13] = FOURTEEN / رابع عشر. */
  sections: WillClause[];
  /** NAME / SIGNATURE block that closes each language's document. */
  execution: { en: WillExecutionBlock; ar: WillExecutionBlock };
  /** Abu Dhabi only: "To be completed by the Court", as bilingual rows. */
  court: { en: WillPara; ar: WillPara }[] | null;
};

// ---------------------------------------------------------------------------
// Editing text that is spread across formatting runs
// ---------------------------------------------------------------------------

/** A replacement over a span of a paragraph's concatenated text. */
type Edit = { start: number; end: number; text: string };

/**
 * Apply text-span replacements to a run list.
 *
 * The lawyer's blanks and stock phrases do not respect run boundaries — a blank
 * can be one bold run, or a bold run followed by a plain one. So matching is
 * done on the paragraph's concatenated text, and the replacement is written
 * into the run where the match STARTS, inheriting that run's formatting; the
 * remainder of the span is deleted from the runs it covers. Nothing is
 * flattened, so every other run keeps its own bold/underline exactly.
 */
function applyEdits(para: WillPara, edits: Edit[]): WillPara {
  if (edits.length === 0) return para;
  const out: WillRun[] = [];
  let pos = 0;
  let consumed = 0; // chars already emitted or deleted, in paragraph coords
  let ei = 0;

  for (const run of para) {
    const rStart = pos;
    const rEnd = pos + run.t.length;
    let cursor = Math.max(rStart, consumed);
    let buf = "";

    while (ei < edits.length && edits[ei].start < rEnd) {
      const e = edits[ei];
      if (e.start > cursor) buf += run.t.slice(cursor - rStart, e.start - rStart);
      if (e.start >= rStart) buf += e.text; // insert once, in the run it starts in
      cursor = Math.max(cursor, e.end);
      if (e.end > rEnd) break; // the span continues into the next run
      ei++;
    }

    if (cursor < rEnd) buf += run.t.slice(cursor - rStart);
    consumed = Math.max(consumed, cursor);
    pos = rEnd;
    if (buf.length > 0) out.push({ ...run, t: buf });
  }

  return out.length > 0 ? out : [{ t: "" }];
}

// ---------------------------------------------------------------------------
// Blank substitution
// ---------------------------------------------------------------------------

type Token =
  | "T_NAME" | "T_NAT" | "T_DOB" | "T_PASS" | "T_EID" | "T_ADDR"
  | "E1_REL" | "E1_NAME" | "E1_NAT" | "E1_DOB" | "E1_PASS" | "E1_EID"
  | "E2_REL" | "E2_NAME" | "E2_NAT" | "E2_DOB" | "E2_PASS" | "E2_EID"
  | "E3_NAME"
  | "RELIGION"
  | "B_REL" | "B_NAME"
  | "C_REL" | "C_NAME"
  | "ULT_NAME"
  | "PG1_REL" | "PG1_NAME" | "PG2_NAME"
  | "CHILD"
  | "IG1_NAME" | "IG1_EID" | "IG2_NAME" | "IG2_EID"
  | "DIV_REL" | "DIV_NAME"
  | "DIS_REL" | "DIS_NAME"
  | "CITIZEN";

type Values = Partial<Record<Token, string>>;

/**
 * Tokens whose value is a common noun that would have to be TRANSLATED to be
 * correct in the Arabic document (relationships, nationalities, religion,
 * country of citizenship). The form captures these in English only, and this
 * codebase must never machine-translate legal text, so in the Arabic document
 * these blanks are left as the drafter's underscores. Proper nouns (names),
 * dates, addresses and document numbers are filled in both languages.
 *
 * Remove a token from this set if the firm decides an English word in the
 * Arabic text is acceptable.
 */
const NOT_FILLED_IN_ARABIC: ReadonlySet<Token> = new Set<Token>([
  "T_NAT", "E1_REL", "E1_NAT", "E2_REL", "E2_NAT",
  "RELIGION", "B_REL", "C_REL", "PG1_REL", "DIV_REL", "DIS_REL", "CITIZEN",
]);

const BLANK_RE = /_+/g;

/**
 * Replace the Nth underscore run in `text` with the value of `tokens[N]`.
 * A blank with no value keeps its original underscores untouched, so an
 * unfilled document is byte-identical to the lawyer's template.
 */
function fillBlanks(para: WillPara, tokens: Token[], values: Values, lang: Lang): WillPara {
  const text = paraText(para);
  const edits: Edit[] = [];
  let i = 0;
  BLANK_RE.lastIndex = 0;
  for (let m = BLANK_RE.exec(text); m !== null; m = BLANK_RE.exec(text)) {
    const token = tokens[i++];
    if (!token) continue;
    if (lang === "ar" && NOT_FILLED_IN_ARABIC.has(token)) continue;
    const v = values[token];
    if (!v || v.trim().length === 0) continue;
    // Several blanks in the lawyer's files butt straight up against the
    // preceding word ("I appoint my__________,"). Keep the words apart.
    const prev = m.index > 0 ? text[m.index - 1] : " ";
    const needsSpace = /[\p{L}\p{N}]/u.test(prev);
    edits.push({
      start: m.index,
      end: m.index + m[0].length,
      text: (needsSpace ? " " : "") + v.trim(),
    });
  }
  return applyEdits(para, edits);
}

/**
 * The templates hard-code the share as "(100%) one hundred percentage share" /
 * "(50%) fifty percentage shares" (and their Arabic equivalents). When the form
 * supplies a different percentage we replace that whole span with the actual
 * figure and DROP the spelled-out words, because leaving a spelled-out number
 * that contradicts the figure would be a defect in a court document.
 * When the form's figure matches the template, the wording is left verbatim.
 */
const SHARE_REWRITES: { lang: Lang; template: number; find: RegExp; make: (pct: string) => string }[] = [
  { lang: "en", template: 100, find: /\(100%\)\s*one[- ]hundred percentage share/, make: (p) => `(${p}%) percentage share` },
  { lang: "en", template: 50, find: /\(50%\)\s*fifty percentage shares/, make: (p) => `(${p}%) percentage shares` },
  { lang: "ar", template: 100, find: /\(100%\)\s*مائة\s+بالمائة من الحصص/, make: (p) => `(${p}%) من الحصص` },
  { lang: "ar", template: 50, find: /\(50%\)\s*خمسين بالمائة من حصص/, make: (p) => `(${p}%) من حصص` },
];

function applyShare(para: WillPara, lang: Lang, pct: number | null | undefined): WillPara {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return para;
  const text = paraText(para);
  for (const r of SHARE_REWRITES) {
    if (r.lang !== lang) continue;
    const m = r.find.exec(text);
    if (!m) continue;
    if (r.template === pct) return para; // already correct — keep verbatim
    return applyEdits(para, [
      { start: m.index, end: m.index + m[0].length, text: r.make(String(pct)) },
    ]);
  }
  return para;
}

// ---------------------------------------------------------------------------
// Which blank, in which paragraph, holds which value.
//
// The two languages do NOT have the same blanks — the lawyer's English Abu
// Dhabi preamble has no nationality blank while the Arabic one does, the
// English clauses often split "my <relation> <name>" over two blanks where the
// Arabic uses one, and so on. So the map is per jurisdiction AND per language.
// Keys are "<sectionIndex>:<paragraphIndex>", plus "preamble:<n>".
// ---------------------------------------------------------------------------

type BlankMap = Record<string, Token[]>;

const BLANKS: Record<WillJurisdiction, Record<Lang, BlankMap>> = {
  abu_dhabi: {
    en: {
      "preamble:0": ["T_NAME", "T_DOB", "T_PASS", "T_EID", "T_ADDR"],
      "1:1": ["E1_NAME", "E1_DOB", "E1_PASS", "E1_EID"],
      "1:2": ["E2_REL", "E2_NAME", "E2_DOB", "E2_PASS", "E2_EID"],
      "1:4": ["E3_NAME"],
      "5:1": ["RELIGION"],
      "7:1": ["B_REL", "B_NAME"],
      "8:0": ["B_NAME"],
      "8:1": ["C_NAME"],
      "8:2": ["C_NAME"],
      "9:0": ["ULT_NAME"],
      "12:1": ["PG1_NAME"],
      "12:2": ["CHILD"],
      "12:3": ["CHILD"],
      "12:4": ["PG2_NAME"],
      "12:5": ["IG1_NAME", "IG1_EID", "IG2_NAME", "IG2_EID"],
      "13:0": ["DIV_NAME"],
      "13:2": ["DIS_NAME"],
      "13:3": ["CITIZEN"],
    },
    ar: {
      "preamble:0": ["T_NAME", "T_NAT", "T_DOB", "T_PASS", "T_EID", "T_ADDR"],
      "1:1": ["E1_NAME", "E1_NAT", "E1_DOB", "E1_PASS", "E1_EID"],
      "1:2": ["E2_NAME", "E2_NAT", "E2_DOB", "E2_PASS", "E2_EID"],
      "1:4": ["E3_NAME"],
      "5:1": ["RELIGION"],
      "7:1": ["B_NAME"],
      "8:0": ["B_NAME"],
      "8:1": ["C_NAME"],
      "8:2": ["C_NAME"],
      "9:0": ["ULT_NAME"],
      "12:1": ["PG1_NAME"],
      "12:2": ["CHILD"],
      "12:3": ["CHILD"],
      "12:4": ["PG2_NAME"],
      "12:5": ["IG1_NAME", "IG1_EID", "IG2_NAME", "IG2_EID"],
      "13:0": ["DIV_NAME"],
      "13:2": ["DIS_REL"],
      "13:3": ["CITIZEN"],
    },
  },
  dubai: {
    en: {
      "preamble:0": ["T_NAME", "T_NAT", "T_DOB", "T_PASS", "T_EID", "T_ADDR"],
      "1:1": ["E1_REL", "E1_NAME", "E1_NAT", "E1_DOB", "E1_PASS", "E1_EID"],
      "1:2": ["E2_REL", "E2_NAME", "E2_NAT", "E2_DOB", "E2_PASS", "E2_EID"],
      "5:1": ["RELIGION"],
      "7:1": ["B_REL", "B_NAME"],
      "8:0": ["B_REL", "B_NAME"],
      "8:1": ["C_REL", "C_NAME"],
      "8:2": ["C_REL", "C_NAME"],
      "9:0": ["ULT_NAME"],
      "12:1": ["PG1_REL", "PG1_NAME"],
      "12:2": ["CHILD"],
      "12:3": ["CHILD"],
      "12:4": ["PG2_NAME"],
      "12:5": ["IG1_NAME", "IG1_EID", "IG2_NAME", "IG2_EID"],
      "13:0": ["DIV_REL", "DIV_NAME"],
      "13:2": ["DIS_REL"],
      "13:3": ["CITIZEN"],
    },
    ar: {
      "preamble:0": ["T_NAME", "T_NAT", "T_DOB", "T_PASS", "T_EID", "T_ADDR"],
      "1:1": ["E1_NAME", "E1_NAT", "E1_DOB", "E1_PASS", "E1_EID"],
      "1:2": ["E2_NAME", "E2_NAT", "E2_DOB", "E2_PASS", "E2_EID"],
      "5:1": ["RELIGION"],
      "7:1": ["B_REL", "B_NAME"],
      "8:0": ["B_REL", "B_NAME"],
      "8:1": ["C_REL", "C_NAME"],
      "8:2": ["C_REL", "C_NAME"],
      "9:0": ["ULT_NAME"],
      "12:1": ["PG1_REL", "PG1_NAME"],
      "12:2": ["CHILD"],
      "12:3": ["CHILD"],
      "12:4": ["PG2_NAME"],
      "12:5": ["IG1_NAME", "IG1_EID", "IG2_NAME", "IG2_EID"],
      "13:0": ["DIV_NAME"],
      "13:2": ["DIS_REL"],
      "13:3": ["CITIZEN"],
    },
  },
};

/** Paragraph indices that are repeated once per beneficiary / child. */
const PRIMARY_BENEFICIARY_PARA = { section: 7, para: 1 };
const CONTINGENT_BENEFICIARY_PARAS = { section: 8, paras: [1, 2] };
const CHILD_PARAS = { section: 12, paras: [2, 3] };

// ---------------------------------------------------------------------------
// Reading the form
// ---------------------------------------------------------------------------

const s = (v: unknown): string => (v ?? "").toString().trim();

type PersonLike = {
  name?: string;
  relation?: string;
  passport_number?: string;
  emirates_id_number?: string;
};

function byLevel<T extends { level: number }>(list: T[] | undefined | null): T[] {
  return [...(list || [])].sort((a, b) => a.level - b.level);
}

export type CourtWillInput = {
  answers: Answers;
  jurisdiction: WillJurisdiction;
  /** Falls back to answers.personal.full_name for the identification line. */
  clientName: string;
};

function baseValues(answers: Answers, clientName: string): Values {
  const p = answers.personal || ({} as Answers["personal"]);
  const executors = byLevel(answers.executors);
  const permGuardians = byLevel(answers.permanent_guardians);
  const interimGuardians = byLevel(answers.interim_guardians);
  const disinherited = answers.disinherit || [];

  const exec = (e: PersonLike | undefined) => ({
    rel: s(e?.relation),
    name: s(e?.name),
    pass: s(e?.passport_number),
    eid: s(e?.emirates_id_number),
  });
  const e1 = exec(executors[0]);
  const e2 = exec(executors[1]);

  const beneficiaries = byLevel(answers.beneficiaries);
  const primary = beneficiaries.filter((b) => b.level === 1);
  const ultimate = beneficiaries.filter((b) => b.level > 1).slice(-1)[0];

  const dis = disinherited[0];
  const spouseLike =
    (answers.beneficiaries || []).find((b) =>
      (b.relationship || "").toLowerCase().includes("spouse") ||
      (b.relationship || "").toLowerCase().includes("wife") ||
      (b.relationship || "").toLowerCase().includes("husband")
    ) || primary[0];

  return {
    T_NAME: s(p.full_name) || s(clientName),
    T_NAT: s(p.nationality),
    T_DOB: s(p.dob),
    T_PASS: s(answers.identity?.passport_number),
    // The intake form does not capture the testator's Emirates ID number, so
    // this blank is deliberately left for the drafter.
    T_EID: "",
    T_ADDR: s(p.address),

    E1_REL: e1.rel, E1_NAME: e1.name, E1_NAT: "", E1_DOB: "", E1_PASS: e1.pass, E1_EID: e1.eid,
    E2_REL: e2.rel, E2_NAME: e2.name, E2_NAT: "", E2_DOB: "", E2_PASS: e2.pass, E2_EID: e2.eid,
    E3_NAME: s(executors[2]?.name),

    RELIGION: s(p.religion),

    // Section EIGHT repeats per primary beneficiary and overrides these, but
    // section NINE's opening line ("If my wife ____ does not survive me…")
    // refers to the primary beneficiary and needs them at the base level.
    B_REL: s(primary[0]?.relationship),
    B_NAME: s(primary[0]?.name),

    ULT_NAME: s(ultimate?.name),

    PG1_REL: s(permGuardians[0]?.relation),
    PG1_NAME: s(permGuardians[0]?.name),
    PG2_NAME: s(permGuardians[1]?.name),

    IG1_NAME: s(interimGuardians[0]?.name),
    IG1_EID: s(interimGuardians[0]?.emirates_id_number),
    IG2_NAME: s(interimGuardians[1]?.name),
    IG2_EID: s(interimGuardians[1]?.emirates_id_number),

    DIV_REL: s(spouseLike?.relationship),
    DIV_NAME: s(spouseLike?.name),

    DIS_REL: s(dis?.relation),
    DIS_NAME: [s(dis?.relation), s(dis?.name)].filter(Boolean).join(" "),

    CITIZEN: s(p.nationality),
  };
}

// ---------------------------------------------------------------------------
// Building the model
// ---------------------------------------------------------------------------

function fillClause(
  raw: CourtTemplateBlock,
  key: string,
  jurisdiction: WillJurisdiction,
  values: Values
): WillClause {
  const build = (lang: Lang) =>
    raw[lang].map((para, i) =>
      fillBlanks(para, BLANKS[jurisdiction][lang][`${key}:${i}`] || [], values, lang)
    );
  return { en: build("en"), ar: build("ar") };
}

/**
 * Expand a slot paragraph into one paragraph per entry.
 * - Slot paragraphs with a matching entry are filled with that entry's data.
 * - Slot paragraphs with no entry keep their verbatim underscores (the
 *   templates mark these "– optional" / "اختياري").
 * - Any entries beyond the available slots repeat the LAST slot paragraph
 *   verbatim, which is exactly what a drafter does by hand.
 */
function expandSlots(
  raw: CourtTemplateBlock,
  sectionIndex: number,
  slotParas: number[],
  jurisdiction: WillJurisdiction,
  base: Values,
  entries: Values[],
  shares: (number | null | undefined)[]
): WillClause {
  const first = slotParas[0];
  const last = slotParas[slotParas.length - 1];
  const count = Math.max(slotParas.length, entries.length);

  const build = (lang: Lang): WillPara[] => {
    const out: WillPara[] = [];
    for (let i = 0; i < raw[lang].length; i++) {
      if (i !== first) {
        out.push(
          fillBlanks(raw[lang][i], BLANKS[jurisdiction][lang][`${sectionIndex}:${i}`] || [], base, lang)
        );
        continue;
      }
      for (let k = 0; k < count; k++) {
        // Use the k-th slot's own wording when it exists, else repeat the last.
        const srcIdx = slotParas[Math.min(k, slotParas.length - 1)];
        const tokens = BLANKS[jurisdiction][lang][`${sectionIndex}:${srcIdx}`] || [];
        const vals = { ...base, ...(entries[k] || {}) };
        let para = fillBlanks(raw[lang][srcIdx], tokens, vals, lang);
        para = applyShare(para, lang, shares[k]);
        out.push(para);
      }
      i = last; // the remaining slot paragraphs were consumed above
    }
    return out;
  };
  return { en: build("en"), ar: build("ar") };
}

export function buildCourtWillDocument(input: CourtWillInput): WillDocumentModel {
  const { answers, jurisdiction, clientName } = input;
  const raw = COURT_TEMPLATE_TEXT[jurisdiction];
  const values = baseValues(answers, clientName);

  const beneficiaries = byLevel(answers.beneficiaries);
  const primary = beneficiaries.filter((b) => b.level === 1);
  const contingent = beneficiaries.filter((b) => b.level > 1);
  // A child can appear at several beneficiary levels (primary and contingent);
  // the guardianship clause must list each child once.
  const seenChild = new Set<string>();
  const children = beneficiaries.filter((b) => {
    if (!(b.relationship || "").toLowerCase().includes("child")) return false;
    const key = s(b.name).toLowerCase();
    if (!key || seenChild.has(key)) return false;
    seenChild.add(key);
    return true;
  });

  const sections: WillClause[] = raw.sections.map((sec, idx) => {
    if (idx === PRIMARY_BENEFICIARY_PARA.section && primary.length > 0) {
      return expandSlots(
        sec,
        idx,
        [PRIMARY_BENEFICIARY_PARA.para],
        jurisdiction,
        values,
        primary.map((b) => ({ B_REL: s(b.relationship), B_NAME: s(b.name) })),
        primary.map((b) => b.percentage)
      );
    }
    if (idx === CONTINGENT_BENEFICIARY_PARAS.section && contingent.length > 0) {
      return expandSlots(
        sec,
        idx,
        CONTINGENT_BENEFICIARY_PARAS.paras,
        jurisdiction,
        values,
        contingent.map((b) => ({ C_REL: s(b.relationship), C_NAME: s(b.name) })),
        contingent.map((b) => b.percentage)
      );
    }
    if (idx === CHILD_PARAS.section && children.length > 0) {
      return expandSlots(
        sec,
        idx,
        CHILD_PARAS.paras,
        jurisdiction,
        values,
        children.map((c) => ({ CHILD: s(c.name) })),
        children.map(() => null)
      );
    }
    return fillClause(sec, String(idx), jurisdiction, values);
  });

  const testatorName = values.T_NAME || s(clientName);

  const court = raw.court ? raw.court.map((row) => ({ en: row.en, ar: row.ar })) : null;

  return {
    jurisdiction,
    cover: raw.cover ? { en: [...raw.cover.en], ar: [...raw.cover.ar] } : null,
    preamble: fillClause(raw.preamble, "preamble", jurisdiction, values),
    sections,
    execution: {
      en: {
        nameLabel: "NAME:",
        name: testatorName ? `MR. ${testatorName}` : "MR.",
        signatureLabel: "SIGNATURE:",
      },
      ar: {
        nameLabel: "الإسم:",
        name: testatorName ? `السيد/ ${testatorName}` : "السيد/",
        signatureLabel: "التوقيع:",
      },
    },
    court,
  };
}
