"use client";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
  formatCurrencyDisplay,
  formatDocumentDate,
  formatInvoiceNumber,
} from "@/lib/format-utils";

export type InvoicePDFData = {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientCompany?: string | null;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  createdAt: string | Date;
  paidAt?: string | Date | null;
  paymentLink?: string | null;
};

type InvoicePDFTemplateProps = {
  data: InvoicePDFData;
};

export const InvoicePDFTemplate = forwardRef<HTMLDivElement, InvoicePDFTemplateProps>(
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
      status,
      createdAt,
      paidAt,
      paymentLink,
    } = data;

    const formattedAmount = formatCurrencyDisplay(amount, locale, currency);
    const formattedDate = formatDocumentDate(createdAt, locale);
    const formattedInvoiceNumber = formatInvoiceNumber(invoiceNumber, locale);
    const formattedDueDate = formatDocumentDate(
      new Date(new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000),
      locale
    );
    const formattedPaidDate = paidAt ? formatDocumentDate(paidAt, locale) : null;

    const isPaid = status === "paid";

    const getStatusColor = () => {
      switch (status) {
        case "paid":
          return "#0C5536";
        case "sent":
          return "#C6A03B";
        case "draft":
          return "#666666";
        case "cancelled":
          return "#DC2626";
        default:
          return "#666666";
      }
    };

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
          position: "relative",
        }}
      >
        {/* Paid Watermark */}
        {isPaid && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-30deg)",
              fontSize: "100px",
              fontWeight: "bold",
              color: "rgba(12, 85, 54, 0.1)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {t("pdf:invoice.paidStamp")}
          </div>
        )}

        {/* Header */}
        <div
          style={{
            backgroundColor: "#0C5536",
            padding: "25px 30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
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
              {t("pdf:invoice.companyName")}
            </h1>
            <p
              style={{
                color: "#E6E6E4",
                margin: "8px 0 0 0",
                fontSize: "12px",
              }}
            >
              {t("pdf:invoice.companyAddress")}
            </p>
            <p
              style={{
                color: "#E6E6E4",
                margin: "3px 0 0 0",
                fontSize: "12px",
              }}
            >
              {t("pdf:invoice.companyEmail")}
            </p>
          </div>
          <div style={{ textAlign: isRtl ? "left" : "right" }}>
            <h2
              style={{
                color: "white",
                margin: 0,
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              {t("pdf:invoice.title")}
            </h2>
            <p
              style={{
                color: "#C6A03B",
                margin: "8px 0 0 0",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              {formattedInvoiceNumber}
            </p>
            <div
              style={{
                marginTop: "10px",
                padding: "5px 15px",
                backgroundColor: getStatusColor(),
                borderRadius: "20px",
                display: "inline-block",
              }}
            >
              <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>
                {t(`pdf:invoice.status.${status}`)}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            border: "1px solid #E6E6E4",
            borderTop: "none",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Dates and Client Info Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "30px",
              gap: "20px",
            }}
          >
            {/* Dates */}
            <div>
              <div style={{ marginBottom: "15px" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#666666" }}>
                  {t("pdf:invoice.invoiceDate")}
                </p>
                <p style={{ margin: "5px 0 0 0", fontSize: "14px", fontWeight: "bold" }}>
                  {formattedDate}
                </p>
              </div>
              {!isPaid && (
                <div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666666" }}>
                    {t("pdf:invoice.dueDate")}
                  </p>
                  <p style={{ margin: "5px 0 0 0", fontSize: "14px", fontWeight: "bold", color: "#C6A03B" }}>
                    {formattedDueDate}
                  </p>
                </div>
              )}
              {isPaid && formattedPaidDate && (
                <div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666666" }}>
                    {t("pdf:invoice.paidDate")}
                  </p>
                  <p style={{ margin: "5px 0 0 0", fontSize: "14px", fontWeight: "bold", color: "#0C5536" }}>
                    {formattedPaidDate}
                  </p>
                </div>
              )}
            </div>

            {/* Bill To */}
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
                {t("pdf:invoice.billTo")}
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

          {/* Invoice Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "25px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#FAFAF8" }}>
                <th
                  style={{
                    padding: "12px 15px",
                    textAlign: isRtl ? "right" : "left",
                    borderBottom: "2px solid #E6E6E4",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#222222",
                    textTransform: "uppercase",
                  }}
                >
                  {t("pdf:invoice.description")}
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    textAlign: "center",
                    borderBottom: "2px solid #E6E6E4",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#222222",
                    textTransform: "uppercase",
                    width: "80px",
                  }}
                >
                  {t("pdf:invoice.quantity")}
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    textAlign: isRtl ? "left" : "right",
                    borderBottom: "2px solid #E6E6E4",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#222222",
                    textTransform: "uppercase",
                    width: "120px",
                  }}
                >
                  {t("pdf:invoice.amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: "15px",
                    borderBottom: "1px solid #E6E6E4",
                    fontSize: "14px",
                    color: "#222222",
                  }}
                >
                  {t("pdf:invoice.serviceDescription")}
                </td>
                <td
                  style={{
                    padding: "15px",
                    borderBottom: "1px solid #E6E6E4",
                    fontSize: "14px",
                    color: "#222222",
                    textAlign: "center",
                  }}
                >
                  1
                </td>
                <td
                  style={{
                    padding: "15px",
                    borderBottom: "1px solid #E6E6E4",
                    fontSize: "14px",
                    color: "#222222",
                    textAlign: isRtl ? "left" : "right",
                    fontWeight: "bold",
                  }}
                >
                  {formattedAmount}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}
                  style={{
                    padding: "15px",
                    textAlign: isRtl ? "left" : "right",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#222222",
                  }}
                >
                  {t("pdf:invoice.subtotal")}
                </td>
                <td
                  style={{
                    padding: "15px",
                    textAlign: isRtl ? "left" : "right",
                    fontSize: "14px",
                    color: "#222222",
                  }}
                >
                  {formattedAmount}
                </td>
              </tr>
              <tr style={{ backgroundColor: "#0C5536" }}>
                <td colSpan={2}
                  style={{
                    padding: "15px",
                    textAlign: isRtl ? "left" : "right",
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "white",
                  }}
                >
                  {t("pdf:invoice.total")}
                </td>
                <td
                  style={{
                    padding: "15px",
                    textAlign: isRtl ? "left" : "right",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#C6A03B",
                  }}
                >
                  {formattedAmount}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Payment Instructions (only if not paid) */}
          {!isPaid && paymentLink && (
            <div
              style={{
                backgroundColor: "#FFF8E7",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #C6A03B",
                textAlign: "center",
              }}
            >
              <h4
                style={{
                  color: "#8B6914",
                  fontSize: "14px",
                  fontWeight: "bold",
                  margin: "0 0 10px 0",
                }}
              >
                {t("pdf:invoice.paymentInstructions")}
              </h4>
              <p
                style={{
                  margin: "0 0 15px 0",
                  fontSize: "13px",
                  color: "#8B6914",
                }}
              >
                {t("pdf:invoice.paymentInstructionsText")}
              </p>
              <a
                href={paymentLink}
                style={{
                  display: "inline-block",
                  backgroundColor: "#0C5536",
                  color: "white",
                  padding: "12px 30px",
                  borderRadius: "5px",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                {t("pdf:invoice.payNow")}
              </a>
            </div>
          )}

          {/* Paid Confirmation */}
          {isPaid && (
            <div
              style={{
                backgroundColor: "#E8F5E9",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #0C5536",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "16px",
                  color: "#0C5536",
                  fontWeight: "bold",
                }}
              >
                {t("pdf:invoice.thankYou")}
              </p>
            </div>
          )}
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
              color: "#E6E6E4",
              fontSize: "12px",
              margin: "0 0 5px 0",
            }}
          >
            {t("pdf:invoice.footer")}
          </p>
          <p
            style={{
              color: "#666666",
              fontSize: "11px",
              margin: 0,
            }}
          >
            &copy; {new Date().getFullYear()} {t("pdf:invoice.companyName")}
          </p>
        </div>
      </div>
    );
  }
);

InvoicePDFTemplate.displayName = "InvoicePDFTemplate";
