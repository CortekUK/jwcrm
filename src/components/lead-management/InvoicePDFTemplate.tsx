"use client";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import justWillsLogo from "@/assets/justwills.png";
import { companyDetails } from "@/config/company";
import { formatDocumentDate } from "@/lib/format-utils";
import { normalizeLineItems, lineItemsSubtotal, type InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";

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
  lineItems?: InvoiceLineItem[];
};

type InvoicePDFTemplateProps = {
  data: InvoicePDFData;
};

// Grayscale palette to match the official JW Legal Consultants tax invoice
const BORDER = "1px solid #000000";
const HEADER_FILL = "#ECECEC";
const LABEL_FILL = "#DEDEDE";
const TRN_FILL = "#BEBEBE";
const TEXT = "#141414";
const GRAY = "#5A5A5A";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const InvoicePDFTemplate = forwardRef<HTMLDivElement, InvoicePDFTemplateProps>(
  ({ data }, ref) => {
    const { t, i18n } = useTranslation(["pdf", "common"]);
    const locale = i18n.language as "en" | "ar";

    const {
      invoiceNumber,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      amount,
      status,
      createdAt,
      paymentLink,
    } = data;

    const items = normalizeLineItems(data.lineItems, amount);
    const subtotal = lineItemsSubtotal(items);
    const vat = subtotal * (companyDetails.vatRate / 100);
    const total = subtotal + vat;

    const formattedDate = formatDocumentDate(createdAt, locale);
    const isPaid = status === "paid";

    const logoSrc = (justWillsLogo as unknown as { src: string }).src;

    const cellPad: React.CSSProperties = { padding: "6px 8px", verticalAlign: "top" };

    return (
      <div
        ref={ref}
        dir="ltr"
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          maxWidth: "720px",
          margin: "0 auto",
          backgroundColor: "white",
          color: TEXT,
          position: "relative",
          padding: "18px",
          boxSizing: "border-box",
        }}
      >
        {/* Paid watermark */}
        {isPaid && (
          <div
            style={{
              position: "absolute",
              top: "45%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-28deg)",
              fontSize: "110px",
              fontWeight: "bold",
              color: "rgba(0,0,0,0.06)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {t("pdf:invoice.paidStamp")}
          </div>
        )}

        {/* Title */}
        <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", marginBottom: "10px" }}>
          INVOICE
        </div>

        {/* Header: logo + company address */}
        <div
          style={{
            border: BORDER,
            backgroundColor: HEADER_FILL,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
          }}
        >
          <img src={logoSrc} alt="JW Legal Consultants" style={{ height: "54px", width: "auto" }} />
          <div style={{ textAlign: "right", fontSize: "9px", lineHeight: 1.5, color: TEXT }}>
            {companyDetails.invoiceAddressLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <div>PHONE: {companyDetails.invoicePhone}</div>
            <div>EMAIL: {companyDetails.invoiceEmail}</div>
          </div>
        </div>

        {/* Bill To / Invoice details grid */}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <tbody>
            <tr>
              <td rowSpan={3} style={{ ...cellPad, border: BORDER, width: "52%" }}>
                <div style={{ fontWeight: "bold", marginBottom: "8px" }}>BILL TO:</div>
                <div style={{ fontWeight: "bold", fontSize: "13px" }}>{clientName}</div>
                <div style={{ fontSize: "11px", color: GRAY, marginTop: "4px" }}>{clientEmail}</div>
                {clientCompany && <div style={{ fontSize: "11px", color: GRAY }}>{clientCompany}</div>}
                {clientPhone && <div style={{ fontSize: "11px", color: GRAY }}>{clientPhone}</div>}
              </td>
              <td style={{ ...cellPad, border: BORDER, backgroundColor: LABEL_FILL, width: "18%", fontWeight: "bold" }}>
                Invoice No.
              </td>
              <td style={{ ...cellPad, border: BORDER, fontWeight: "bold" }}>{invoiceNumber}</td>
            </tr>
            <tr>
              <td style={{ ...cellPad, border: BORDER, backgroundColor: LABEL_FILL, fontWeight: "bold" }}>Date</td>
              <td style={{ ...cellPad, border: BORDER }}>{formattedDate}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...cellPad, border: BORDER, fontWeight: "bold" }}>
                Reference:&nbsp;&nbsp;{clientName}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: "-1px" }}>
          <thead>
            <tr style={{ backgroundColor: LABEL_FILL, textAlign: "center", fontWeight: "bold" }}>
              <th style={{ ...cellPad, border: BORDER, width: "62%", textAlign: "center" }}>DESCRIPTION</th>
              <th style={{ ...cellPad, border: BORDER, width: "16%" }}>COST</th>
              <th style={{ ...cellPad, border: BORDER, width: "22%" }}>NET PRICE AED</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ ...cellPad, border: BORDER, fontWeight: "bold" }}>{item.description}</td>
                <td style={{ ...cellPad, border: BORDER, textAlign: "center", fontWeight: "bold" }}>X</td>
                <td style={{ ...cellPad, border: BORDER, textAlign: "center" }}>{fmt(item.amount)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...cellPad, border: BORDER, height: "56px" }}>
                <span style={{ fontWeight: "bold" }}>Notarization Fee </span>
                <span style={{ fontStyle: "italic", color: GRAY, fontSize: "11px" }}>
                  (Includes legalization, PRO Services)
                </span>
                <div style={{ marginTop: "6px", fontSize: "11px" }}>
                  {companyDetails.notarizationNote.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </td>
              <td style={{ ...cellPad, border: BORDER, textAlign: "center", fontWeight: "bold" }}>X</td>
              <td style={{ ...cellPad, border: BORDER }} />
            </tr>
          </tbody>
        </table>

        {/* Bank details + totals */}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: "-1px" }}>
          <tbody>
            <tr>
              <td rowSpan={5} style={{ ...cellPad, border: BORDER, width: "62%" }}>
                <div>Please draw your cheque payable to:</div>
                <div style={{ fontWeight: "bold" }}>{companyDetails.bank.payee}</div>
                <div style={{ marginTop: "8px", fontSize: "11px", lineHeight: 1.6 }}>
                  <div>Bank: {companyDetails.bank.name}</div>
                  <div>Payee: {companyDetails.bank.payee}</div>
                  <div>Account : {companyDetails.bank.account}</div>
                  <div>Swift Code: {companyDetails.bank.swift}</div>
                  <div>IBAN# {companyDetails.bank.iban}</div>
                </div>
              </td>
              <td style={{ ...cellPad, border: BORDER, backgroundColor: LABEL_FILL, width: "16%", textAlign: "center", fontWeight: "bold" }}>
                SUB-TOTAL
              </td>
              <td style={{ ...cellPad, border: BORDER, width: "22%", textAlign: "center", fontWeight: "bold" }}>
                {fmt(subtotal)}
              </td>
            </tr>
            <tr>
              <td style={{ ...cellPad, border: BORDER, backgroundColor: LABEL_FILL, textAlign: "center", fontWeight: "bold" }}>
                {companyDetails.vatRate}% VAT
              </td>
              <td style={{ ...cellPad, border: BORDER, textAlign: "center", fontWeight: "bold" }}>{fmt(vat)}</td>
            </tr>
            <tr>
              <td style={{ ...cellPad, border: BORDER, backgroundColor: LABEL_FILL, textAlign: "center", fontWeight: "bold" }}>
                TOTAL
              </td>
              <td style={{ ...cellPad, border: BORDER, textAlign: "center", fontWeight: "bold" }}>{fmt(total)} AED</td>
            </tr>
            <tr>
              <td style={{ ...cellPad, border: BORDER, backgroundColor: LABEL_FILL, textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>
                PAYMENT REQUIRED INCL VAT
              </td>
              <td style={{ ...cellPad, border: BORDER, textAlign: "center", fontWeight: "bold" }}>{fmt(total)} AED</td>
            </tr>
            <tr>
              <td style={{ ...cellPad, border: BORDER, backgroundColor: LABEL_FILL, textAlign: "center", fontWeight: "bold" }}>
                BALANCE AMOUNT
              </td>
              <td style={{ ...cellPad, border: BORDER, textAlign: "center", fontWeight: "bold" }}>{fmt(total)} AED</td>
            </tr>
          </tbody>
        </table>

        {/* TRN box */}
        <div
          style={{
            border: BORDER,
            backgroundColor: TRN_FILL,
            textAlign: "center",
            padding: "10px",
            width: "62%",
            boxSizing: "border-box",
            marginTop: "-1px",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>رقم التسجيل الضريبي / TRN#</div>
          <div style={{ fontWeight: "bold", fontSize: "15px", marginTop: "4px" }}>{companyDetails.trn}</div>
        </div>

        {/* Payment link (in-app, only when unpaid) */}
        {!isPaid && paymentLink && (
          <div style={{ textAlign: "center", margin: "18px 0 6px" }}>
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

        {/* Footer */}
        <div style={{ borderTop: BORDER, marginTop: "16px", paddingTop: "8px", textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>{companyDetails.legalName}</div>
          <div style={{ fontSize: "10px", color: GRAY }}>{companyDetails.invoiceCity}</div>
        </div>
      </div>
    );
  }
);

InvoicePDFTemplate.displayName = "InvoicePDFTemplate";
