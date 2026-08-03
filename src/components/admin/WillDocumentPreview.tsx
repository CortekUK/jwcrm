import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildCourtWillDocument, paraIsEmpty } from "@/lib/will/courtTemplate";
import type { WillPara } from "@/lib/will/courtTemplate";
import type { Answers, WillJurisdiction } from "@/types/will-form";
// CSS lives in src/styles/globals.css (Next.js global stylesheet)

/**
 * On-screen / print rendering of the JW court will — BILINGUAL.
 *
 * This is the component behind admin → will → "Print" (and the print modal),
 * which html2pdf turns into a PDF. It reproduces the lawyer's own TWO-COLUMN
 * layout: in word/document.xml of WILL_DXB_TR.docx / WILL_AUH_TR.docx the whole
 * document body is a single table with one row and two cells — cell 0 English,
 * cell 1 Arabic, no <w:bidiVisual>, i.e. English LEFT and Arabic RIGHT. Each
 * cell holds that language's complete document, so the two columns flow
 * independently; they are NOT paired clause by clause.
 *
 *   [Abu Dhabi only] bilingual cover page      (English left | Arabic right)
 *   English title block (full width)
 *   THE DOCUMENT, two columns:
 *     left  = complete ENGLISH document (preamble, ONE..FOURTEEN, execution)
 *     right = complete ARABIC document  (preamble, أولاً..رابع عشر, execution)
 *   [Abu Dhabi only] bilingual court attestation block
 *
 * The column pair is an HTML <table> with two <td>s — deliberately, not
 * flex/grid: browsers fragment a tall table row across printed pages, whereas
 * a tall flex/grid item is not fragmentable and gets clipped or forced onto one
 * enormous page by html2canvas.
 *
 * All wording comes from the shared court template model
 * (@/lib/will/courtTemplate) — the same model the PDF and Word generators
 * consume, so the three outputs cannot drift apart. No legal wording is
 * written or translated in this file.
 *
 * NOTE: this replaces the previous free-form structure (Roman-numeral
 * PERSONAL INFORMATION / DISINHERITANCE / FAMILY EXCLUSION / SPECIAL REQUESTS
 * sections). Those are superseded by the court format — the exclusion concepts
 * now live in section FOURTEEN and its Declaration clause.
 */

/**
 * Render one paragraph's formatting runs.
 *
 * Bold and underline come from the lawyer's own runs (courtTemplateText.ts) and
 * from nowhere else — no CSS uppercasing, no heading rules, no blanket bolding
 * of heading lines. Several of the lawyer's "headings" (NINE, TEN, ELEVEN,
 * FOURTEEN) are in fact full sentences with only the ordinal in bold, so the
 * data is the only thing that gets this right.
 */
function Runs({ para }: { para: WillPara }) {
  return (
    <>
      {para.map((run, i) => {
        const body = run.b ? <strong>{run.t}</strong> : run.t;
        return <Fragment key={i}>{run.u ? <u>{body}</u> : body}</Fragment>;
      })}
    </>
  );
}

interface WillDocumentPreviewProps {
  answers: any;
  clientName: string;
  willId: string;
  /**
   * @deprecated The court document is bilingual and always renders both
   * languages, so this no longer selects the document language. Retained for
   * call-site compatibility.
   */
  locale?: string;
  status?: string;
  includeSignature?: boolean;
}

export function WillDocumentPreview({
  answers,
  clientName,
  status,
  includeSignature = true,
}: WillDocumentPreviewProps) {
  const { i18n } = useTranslation("pdf");
  const isFinalized = status === "finalized";
  const t = i18n.getFixedT("en", "pdf");

  const jurisdiction: WillJurisdiction =
    answers?.jurisdiction === "dubai" ? "dubai" : "abu_dhabi";

  const model = useMemo(
    () =>
      buildCourtWillDocument({
        answers: (answers || {}) as Answers,
        jurisdiction,
        clientName,
      }),
    [answers, jurisdiction, clientName]
  );

  const signature = includeSignature ? answers?.family_exclusion?.signature : null;

  const signatureImage = (alt: string) =>
    signature ? (
      <div className="signature-space">
        <img
          src={signature}
          alt={alt}
          style={{ maxWidth: "100%", height: "auto", maxHeight: "80px" }}
        />
      </div>
    ) : (
      <div className="signature-space" />
    );

  const renderSections = (lang: "en" | "ar") =>
    model.sections.map((section, index) => {
      const lines = section[lang].filter((p) => !paraIsEmpty(p));
      if (lines.length === 0) return null;
      return (
        <section className="will-section" key={`${lang}-${index}`}>
          <h2>
            <Runs para={lines[0]} />
          </h2>
          {lines.slice(1).map((body, i) => (
            <p className="will-paragraph" key={i}>
              <Runs para={body} />
            </p>
          ))}
        </section>
      );
    });

  return (
    <div className="will-document will-document-preview" dir="ltr">
      {/* Just Wills Branding Header - Hidden for finalized PDFs */}
      {!isFinalized && (
        <div className="just-wills-brand">
          <div className="brand-logo">
            <div className="logo-icon">JW</div>
            <div className="brand-text">
              <h2 className="brand-name">JUST WILLS</h2>
              <p className="brand-tagline">{t("professionalWillDrafting")}</p>
            </div>
          </div>
          <div className="brand-contact">
            <p>www.justwills.com</p>
            <p>Email: info@justwills.com</p>
          </div>
        </div>
      )}

      {/* Cover page — Abu Dhabi template only. In the source this is its own
          one-row/two-cell table, so it gets its own column pair here. */}
      {model.cover && (
        <table className="will-bilingual will-bilingual-cover">
          <tbody>
            <tr>
              <td className="will-col will-col-en" dir="ltr" lang="en">
                {model.cover.en.map((line, i) => (
                  <p className={i === 2 ? "will-cover-title" : "will-cover-line"} key={`cov-en-${i}`}>
                    <Runs para={line} />
                  </p>
                ))}
              </td>
              <td className="will-col will-col-ar will-rtl-block" dir="rtl" lang="ar">
                {model.cover.ar.map((line, i) => (
                  <p className={i === 0 ? "will-cover-title" : "will-cover-line"} key={`cov-ar-${i}`}>
                    <Runs para={line} />
                  </p>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* English title block */}
      <div className="will-header">
        <h1 className="will-title">LAST WILL AND TESTAMENT</h1>
        <div className="will-subtitle">
          <p>OF</p>
          <p className="testator-name">
            {clientName || answers?.personal?.full_name || "_______________"}
          </p>
        </div>
      </div>

      {/* --------- The document: English column | Arabic column --------- */}
      <table className="will-bilingual will-bilingual-body">
        <tbody>
          <tr>
            {/* ---------------- English column (left) ---------------- */}
            <td className="will-col will-col-en" dir="ltr" lang="en">
              <div className="will-content">
                {model.preamble.en.map((line, i) => (
                  <p className="will-paragraph" key={`pre-en-${i}`}>
                    <Runs para={line} />
                  </p>
                ))}
                {renderSections("en")}
              </div>

              <div className="signature-section">
                <h2>EXECUTION AND ATTESTATION</h2>
                <p className="execution-text">
                  {model.execution.en.nameLabel} {model.execution.en.name}
                </p>
                <div className="signature-block">
                  <div className="signature-line">
                    {signatureImage("Testator's Signature")}
                    <p className="signature-label">{model.execution.en.signatureLabel}</p>
                  </div>
                </div>
              </div>
            </td>

            {/* ---------------- Arabic column (right) ---------------- */}
            <td className="will-col will-col-ar will-rtl-block" dir="rtl" lang="ar">
              <div className="will-content">
                {model.preamble.ar.map((line, i) => (
                  <p className="will-paragraph" key={`pre-ar-${i}`}>
                    <Runs para={line} />
                  </p>
                ))}
                {renderSections("ar")}
              </div>

              <div className="signature-section">
                <p className="execution-text">
                  {model.execution.ar.nameLabel} {model.execution.ar.name}
                </p>
                <div className="signature-block">
                  <div className="signature-line">
                    {signatureImage("Testator's Signature")}
                    <p className="signature-label">{model.execution.ar.signatureLabel}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ------- Court attestation block — Abu Dhabi template only ------- */}
      {model.court && (
        <table className="will-bilingual will-bilingual-court will-court-block">
          <tbody>
            {model.court.map((row, i) => (
              <tr className="will-court-row" key={i}>
                <td className="will-col will-col-en" dir="ltr" lang="en">
                  <p className={i === 0 ? "will-court-heading" : "will-court-label"}>
                    <Runs para={row.en} />
                    {i === 0 ? null : " ____________________"}
                  </p>
                </td>
                <td className="will-col will-col-ar will-rtl-block" dir="rtl" lang="ar">
                  <p className={i === 0 ? "will-court-heading" : "will-court-label"}>
                    <Runs para={row.ar} />
                    {i === 0 ? null : " ____________________"}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
