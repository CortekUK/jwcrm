"use client";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
  formatCurrencyDisplay,
  formatDocumentDate,
} from "@/lib/format-utils";

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
};

type ProposalPDFTemplateProps = {
  data: ProposalPDFData;
};

// Function to inject inline styles into HTML content for proper PDF rendering
const getStyledProposalContent = (content: string): string => {
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
    } = data;

    const formattedAmount = formatCurrencyDisplay(amount, locale, currency);
    const formattedDate = formatDocumentDate(createdAt, locale);
    const formattedValidUntil = validUntil
      ? formatDocumentDate(validUntil, locale)
      : formatDocumentDate(new Date(new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000), locale);

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

          {/* Amount Box */}
          <div
            style={{
              backgroundColor: "#0C5536",
              padding: "20px 25px",
              borderRadius: "8px",
              marginBottom: "25px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#E6E6E4",
                fontSize: "14px",
              }}
            >
              {t("pdf:proposal.totalAmount")}
            </p>
            <p
              style={{
                margin: 0,
                color: "#C6A03B",
                fontSize: "28px",
                fontWeight: "bold",
              }}
            >
              {formattedAmount}
            </p>
          </div>

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
              dangerouslySetInnerHTML={{ __html: getStyledProposalContent(proposalContent) }}
            />
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
