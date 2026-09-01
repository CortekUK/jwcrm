"use client";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
  formatCurrencyDisplay,
  formatDocumentDate,
} from "@/lib/format-utils";
import { companyDetails } from "@/config/company";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { lineItemCostLabel, type InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";
import { FEE_TABLE_TOKEN } from "@/lib/proposal-content";

export type ProposalPDFData = {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientCompany?: string | null;
  amount: number;
  currency: string;
  proposalContent: string;
  createdAt: string | Date;
  validUntil?: string | Date;
  lineItems?: InvoiceLineItem[]; // itemised charges (drafting, court fee, MOJ stamps, etc.)
  vatRate?: number | null; // per-proposal VAT override (percent); null/undefined = company default
  vatAmount?: number | null; // absolute VAT override; wins over vatRate
};

type ProposalPDFTemplateProps = {
  data: ProposalPDFData;
};

// Function to inject inline styles into HTML content for proper PDF rendering
const getStyledProposalContent = (content: string | null | undefined): string => {
  if (!content) return "";
  return content
    .replace(/<ul>/g, '<ul style="list-style-type: disc; padding-left: 24px; margin: 12px 0;">')
    .replace(/<ol>/g, '<ol style="list-style-type: decimal; padding-left: 24px; margin: 12px 0;">')
    .replace(/<li>/g, '<li style="margin: 6px 0; padding-left: 4px;">')
    .replace(/<p>/g, '<p style="margin: 10px 0;">')
    .replace(/<p style="text-align: center/g, '<p style="text-align: center; margin: 10px 0')
    .replace(/<p style="text-align: right/g, '<p style="text-align: right; margin: 10px 0')
    .replace(/<p style="text-align: justify/g, '<p style="text-align: justify; margin: 10px 0');
};

export const ProposalPDFTemplate = forwardRef<HTMLDivElement, ProposalPDFTemplateProps>(
  ({ data }, ref) => {
    const { t, i18n } = useTranslation(["pdf", "common"]);
    const isRtl = i18n.language === "ar";
    const locale = i18n.language as "en" | "ar";

    const {
      invoiceNumber,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      amount,
      currency,
      proposalContent,
      createdAt,
      validUntil,
      lineItems,
      vatRate,
      vatAmount,
    } = data;

    // One source of truth for the money — the same helper the emailed PDF and
    // the payment link use, so a per-proposal VAT override can never make the
    // downloaded copy disagree with what is charged.
    const amounts = computeInvoiceAmounts(
      {
        amount,
        line_items: lineItems,
        vat_rate: vatRate,
        vat_amount: vatAmount,
      },
      companyDetails.vatRate
    );

    const money = (value: number) => formatCurrencyDisplay(value, locale, currency);
    const formattedDate = formatDocumentDate(createdAt, locale);
    const formattedValidUntil = validUntil
      ? formatDocumentDate(validUntil, locale)
      : formatDocumentDate(new Date(new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000), locale);

    // Alignment follows the document's direction rather than being pinned to
    // LTR: this is the only proposal renderer that runs in Arabic.
    const startAlign = isRtl ? "right" : "left";
    const endAlign = isRtl ? "left" : "right";

    const cell = {
      padding: "8px 12px",
      borderBottom: "1px solid #E6E6E4",
      fontSize: "13px",
      color: "#222222",
    } as const;

    const feeTable = (
      <div style={{ margin: "20px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: startAlign, padding: "8px 12px", borderBottom: "2px solid #0C5536", fontSize: "12px", color: "#0C5536" }}>
                {t("pdf:invoice.description", { defaultValue: "Description" })}
              </th>
              <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "2px solid #0C5536", fontSize: "12px", color: "#0C5536", width: "60px" }}>
                {t("pdf:invoice.cost", { defaultValue: "Cost" })}
              </th>
              <th style={{ textAlign: endAlign, padding: "8px 12px", borderBottom: "2px solid #0C5536", fontSize: "12px", color: "#0C5536", width: "120px" }}>
                {t("pdf:invoice.amount", { defaultValue: "Amount" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {amounts.items.map((item, index) => (
              <tr key={index}>
                {/* Descriptions may carry hard line breaks, so newlines must
                    survive rather than collapsing into one run of text. */}
                <td style={{ ...cell, textAlign: startAlign, whiteSpace: "pre-line" }}>
                  {item.description}
                  {/* When the invoice is split, say when each charge falls due —
                      otherwise the client only sees one total and cannot tell
                      which part actually starts the work. */}
                  {amounts.staged && (
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "11px",
                        fontStyle: "italic",
                        color: item.stage === "upfront" ? "#0C5536" : "#8a8a8a",
                      }}
                    >
                      {item.stage === "upfront"
                        ? t("pdf:invoice.payableUpfront", { defaultValue: "Payable upfront" })
                        : t("pdf:invoice.payableAtCourt", {
                            defaultValue: "At court appointment stage",
                          })}
                    </div>
                  )}
                </td>
                <td style={{ ...cell, textAlign: "center" }}>{lineItemCostLabel(item)}</td>
                <td style={{ ...cell, textAlign: endAlign }}>{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 12px", color: "#666666", fontSize: "13px", textAlign: startAlign }}>
                {t("pdf:invoice.subTotal", { defaultValue: "Sub-Total" })}
              </td>
              <td style={{ padding: "4px 12px", color: "#222222", fontSize: "13px", textAlign: endAlign }}>
                {money(amounts.subtotal)}
              </td>
            </tr>
            <tr>
              {/* vatLabel already reads "5% VAT" or plain "VAT" for an absolute
                  override — render it verbatim, never re-derive the rate. */}
              <td style={{ padding: "4px 12px", color: "#666666", fontSize: "13px", textAlign: startAlign }}>
                {amounts.vatLabel}
              </td>
              <td style={{ padding: "4px 12px", color: "#222222", fontSize: "13px", textAlign: endAlign }}>
                {money(amounts.vatAmount)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 12px", color: "#0C5536", fontWeight: "bold", fontSize: "15px", borderTop: "1px solid #E6E6E4", textAlign: startAlign }}>
                {t("pdf:proposal.totalAmount")}
              </td>
              <td style={{ padding: "8px 12px", color: "#0C5536", fontWeight: "bold", fontSize: "15px", borderTop: "1px solid #E6E6E4", textAlign: endAlign }}>
                {money(amounts.invoiceTotal)}
              </td>
            </tr>
          </tbody>
        </table>
        {amounts.staged && amounts.laterTotal > 0 && (
          <div
            style={{
              marginTop: "14px",
              backgroundColor: "#F4F8F5",
              [isRtl ? "borderRight" : "borderLeft"]: "3px solid #0C5536",
              borderRadius: "4px",
              padding: "12px 14px",
              textAlign: startAlign,
            }}
          >
            <div style={{ color: "#0C5536", fontWeight: "bold", fontSize: "14px" }}>
              {t("pdf:invoice.payableNow", {
                defaultValue: "Payable now to begin drafting: {{amount}}",
                amount: money(amounts.upfrontTotal),
              })}
            </div>
            <div style={{ color: "#6B6B6B", fontSize: "12px", marginTop: "4px" }}>
              {t("pdf:invoice.payableLater", {
                defaultValue:
                  "The remaining {{amount}} is payable at the court appointment stage.",
                amount: money(amounts.laterTotal),
              })}
            </div>
          </div>
        )}
      </div>
    );

    // The body cannot hold a real table (the TipTap editor has no table
    // extension), so it carries a placeholder token instead and each renderer
    // draws its own table there. The body is injected with
    // dangerouslySetInnerHTML, so the split has to happen on the HTML string
    // BEFORE injection — there is no DOM to splice into afterwards.
    const styledContent = getStyledProposalContent(proposalContent);
    const tokenIndex = styledContent.indexOf(FEE_TABLE_TOKEN);
    const bodyBefore =
      tokenIndex === -1 ? styledContent : styledContent.slice(0, tokenIndex);
    // Proposals saved before the token existed have none; they render whole and
    // the table follows, which is the same order the jsPDF renderer falls back to.
    const bodyAfter =
      tokenIndex === -1
        ? ""
        : styledContent.slice(tokenIndex + FEE_TABLE_TOKEN.length);

    return (
      <div
        ref={ref}
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          fontFamily: isRtl ? "'Noto Sans Arabic', Arial, sans-serif" : "Arial, sans-serif",
          maxWidth: "650px",
          margin: "0 auto",
          backgroundColor: "white",
          direction: isRtl ? "rtl" : "ltr",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#0C5536",
            padding: "25px 30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                color: "#C6A03B",
                margin: 0,
                fontSize: "28px",
                fontWeight: "bold",
              }}
            >
              {t("pdf:proposal.companyName")}
            </h1>
            <p
              style={{
                color: "#E6E6E4",
                margin: "5px 0 0 0",
                fontSize: "12px",
              }}
            >
              {t("pdf:proposal.companyTagline")}
            </p>
          </div>
          <div style={{ textAlign: isRtl ? "left" : "right" }}>
            <h2
              style={{
                color: "white",
                margin: 0,
                fontSize: "20px",
                fontWeight: "bold",
              }}
            >
              {t("pdf:proposal.title")}
            </h2>
            <p
              style={{
                color: "#C6A03B",
                margin: "5px 0 0 0",
                fontSize: "14px",
              }}
            >
              {t("pdf:proposal.proposalNumber")}{invoiceNumber}
            </p>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            border: "1px solid #E6E6E4",
            borderTop: "none",
          }}
        >
          {/* Date and Client Info Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "30px",
              gap: "20px",
            }}
          >
            {/* Date */}
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#666666" }}>
                {t("pdf:proposal.date")}
              </p>
              <p style={{ margin: "5px 0 0 0", fontSize: "14px", fontWeight: "bold" }}>
                {formattedDate}
              </p>
              <p style={{ margin: "10px 0 0 0", fontSize: "12px", color: "#666666" }}>
                {t("pdf:proposal.validUntil")}
              </p>
              <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>
                {formattedValidUntil}
              </p>
            </div>

            {/* Client Info */}
            <div
              style={{
                backgroundColor: "#FAFAF8",
                padding: "15px 20px",
                borderRadius: "8px",
                border: "1px solid #E6E6E4",
                minWidth: "250px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#0C5536",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                {t("pdf:proposal.preparedFor")}
              </p>
              <p style={{ margin: "10px 0 5px 0", fontSize: "16px", fontWeight: "bold" }}>
                {clientName}
              </p>
              <p style={{ margin: "3px 0", fontSize: "13px", color: "#444444" }}>
                {clientEmail}
              </p>
              {clientPhone && (
                <p style={{ margin: "3px 0", fontSize: "13px", color: "#444444" }}>
                  {clientPhone}
                </p>
              )}
              {clientCompany && (
                <p style={{ margin: "3px 0", fontSize: "13px", color: "#444444" }}>
                  {clientCompany}
                </p>
              )}
            </div>
          </div>

          {/* The standalone "Total Amount" box was removed: the fee table below
              now states the total (and it was showing the pre-VAT amount, so
              the two would have contradicted each other). */}

          {/* Service Agreement */}
          <div style={{ marginBottom: "25px" }}>
            <h3
              style={{
                color: "#0C5536",
                fontSize: "16px",
                fontWeight: "bold",
                marginBottom: "15px",
                paddingBottom: "10px",
                borderBottom: "2px solid #C6A03B",
              }}
            >
              {t("pdf:proposal.serviceAgreement")}
            </h3>
            <div
              style={{
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#222222",
              }}
              dangerouslySetInnerHTML={{ __html: bodyBefore }}
            />
            {feeTable}
            {bodyAfter && (
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: "1.6",
                  color: "#222222",
                }}
                dangerouslySetInnerHTML={{ __html: bodyAfter }}
              />
            )}
          </div>

          {/* Payment Terms */}
          <div
            style={{
              backgroundColor: "#FAFAF8",
              padding: "20px",
              borderRadius: "8px",
              border: "1px solid #E6E6E4",
              marginBottom: "25px",
            }}
          >
            <h4
              style={{
                color: "#0C5536",
                fontSize: "14px",
                fontWeight: "bold",
                margin: "0 0 10px 0",
              }}
            >
              {t("pdf:proposal.paymentTerms")}
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#444444",
                lineHeight: "1.5",
              }}
            >
              {t("pdf:proposal.paymentTermsText")}
            </p>
          </div>

          {/* Acceptance Note */}
          <div
            style={{
              textAlign: "center",
              padding: "15px",
              backgroundColor: "#FFF8E7",
              borderRadius: "8px",
              border: "1px solid #C6A03B",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#8B6914",
              }}
            >
              {t("pdf:proposal.acceptanceNote")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: "#222222",
            padding: "20px 30px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#C6A03B",
              fontSize: "14px",
              margin: "0 0 5px 0",
            }}
          >
            {t("pdf:proposal.footer")}
          </p>
          <p
            style={{
              color: "#E6E6E4",
              fontSize: "11px",
              margin: 0,
            }}
          >
            &copy; {new Date().getFullYear()} {t("pdf:proposal.companyName")}
          </p>
        </div>
      </div>
    );
  }
);

ProposalPDFTemplate.displayName = "ProposalPDFTemplate";
