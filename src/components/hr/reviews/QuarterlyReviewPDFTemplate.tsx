"use client";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

type TemplateSection = {
  id: string;
  title: string;
  type: "textarea" | "readonly" | "list";
  required: boolean;
  order: number;
  isCustom?: boolean;
};

type QuarterlyReviewPDFTemplateProps = {
  employeeName: string;
  employeeJobTitle: string | null;
  departmentName: string | null;
  quarter: number;
  year: number;
  overallScore: number | null;
  performanceSummary: string | null;
  strengths: string | null;
  areasForImprovement: string | null;
  goalsNextQuarter: string | null;
  developmentPlan: string | null;
  managerComments: string | null;
  reviewerName: string | null;
  approvedBy: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  customFields?: Record<string, string> | null;
  templateSections?: TemplateSection[];
};

export const QuarterlyReviewPDFTemplate = forwardRef<HTMLDivElement, QuarterlyReviewPDFTemplateProps>(
  (
    {
      employeeName,
      employeeJobTitle,
      departmentName,
      quarter,
      year,
      overallScore,
      performanceSummary,
      strengths,
      areasForImprovement,
      goalsNextQuarter,
      developmentPlan,
      managerComments,
      reviewerName,
      approvedBy,
      submittedAt,
      approvedAt,
      customFields,
      templateSections,
    },
    ref
  ) => {
    const { t, i18n } = useTranslation(["hr", "common"]);
    const isRtl = i18n.language === "ar";

    const getScoreColor = (score: number | null): string => {
      if (!score) return "#666666";
      if (score >= 80) return "#0C5536";
      if (score >= 60) return "#C6A03B";
      return "#DC2626";
    };

    const getPerformanceLabel = (score: number | null): string => {
      if (score === null) return t("hr:reviews.notEvaluated");
      if (score >= 80) return t("hr:reviews.excellent");
      if (score >= 60) return t("hr:reviews.good");
      return t("hr:reviews.needsImprovement");
    };

    const formatDate = (dateString: string | null): string => {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return date.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formatTextToList = (text: string | null): string[] => {
      if (!text) return [];
      return text.split("\n").filter((line) => line.trim());
    };

    const overallColor = getScoreColor(overallScore);

    return (
      <div
        ref={ref}
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          fontFamily: "Arial, sans-serif",
          maxWidth: "700px",
          margin: "0 auto",
          backgroundColor: "white",
          direction: isRtl ? "rtl" : "ltr",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#0C5536",
            padding: "24px",
            textAlign: "center",
            borderRadius: "8px 8px 0 0",
          }}
        >
          <h1
            style={{
              color: "white",
              margin: 0,
              fontSize: "24px",
              fontWeight: "bold",
            }}
          >
            {t("hr:reviews.quarterlyPerformanceReview")}
          </h1>
          <p
            style={{
              color: "#C6A03B",
              margin: "10px 0 0 0",
              fontSize: "18px",
            }}
          >
            Q{quarter} {year}
          </p>
        </div>

        {/* Content */}
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            border: "1px solid #E6E6E4",
          }}
        >
          {/* Employee Info Section */}
          <div
            style={{
              backgroundColor: "#FAFAF8",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "24px",
              border: "1px solid #E6E6E4",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "8px 0", color: "#666666", width: "30%" }}>
                    {t("hr:employee")}:
                  </td>
                  <td style={{ padding: "8px 0", fontWeight: "bold", color: "#222222" }}>
                    {employeeName}
                  </td>
                </tr>
                {employeeJobTitle && (
                  <tr>
                    <td style={{ padding: "8px 0", color: "#666666" }}>
                      {t("hr:jobTitle")}:
                    </td>
                    <td style={{ padding: "8px 0", color: "#222222" }}>
                      {employeeJobTitle}
                    </td>
                  </tr>
                )}
                {departmentName && (
                  <tr>
                    <td style={{ padding: "8px 0", color: "#666666" }}>
                      {t("hr:department")}:
                    </td>
                    <td style={{ padding: "8px 0", color: "#222222" }}>
                      {departmentName}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "8px 0", color: "#666666" }}>
                    {t("hr:reviews.reviewPeriod")}:
                  </td>
                  <td style={{ padding: "8px 0", color: "#222222" }}>
                    Q{quarter} {year}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Overall Score */}
          <div
            style={{
              backgroundColor: "#f5f5f5",
              padding: "24px",
              borderRadius: "8px",
              margin: "24px 0",
              textAlign: "center",
              border: `2px solid ${overallColor}20`,
            }}
          >
            <p style={{ margin: 0, color: "#666666", fontSize: "14px" }}>
              {t("hr:reviews.overallPerformanceScore")}
            </p>
            <h2
              style={{
                margin: "12px 0 8px 0",
                color: overallColor,
                fontSize: "48px",
                fontWeight: "bold",
              }}
            >
              {overallScore !== null ? `${overallScore}%` : "-"}
            </h2>
            <p
              style={{
                margin: 0,
                color: overallColor,
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              {getPerformanceLabel(overallScore)}
            </p>
          </div>

          {/* Performance Summary */}
          {performanceSummary && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  color: "#0C5536",
                  fontSize: "16px",
                  marginBottom: "12px",
                  borderBottom: "2px solid #C6A03B",
                  paddingBottom: "8px",
                }}
              >
                {t("hr:reviews.performanceSummary")}
              </h3>
              <p
                style={{
                  color: "#222222",
                  lineHeight: 1.6,
                  margin: 0,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {performanceSummary}
              </p>
            </div>
          )}

          {/* Strengths */}
          {strengths && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  color: "#0C5536",
                  fontSize: "16px",
                  marginBottom: "12px",
                  borderBottom: "2px solid #C6A03B",
                  paddingBottom: "8px",
                }}
              >
                {t("hr:reviews.strengths")}
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingInlineStart: "20px",
                  color: "#222222",
                  lineHeight: 1.8,
                }}
              >
                {formatTextToList(strengths).map((item, index) => (
                  <li key={index} style={{ marginBottom: "8px" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {areasForImprovement && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  color: "#C6A03B",
                  fontSize: "16px",
                  marginBottom: "12px",
                  borderBottom: "2px solid #C6A03B",
                  paddingBottom: "8px",
                }}
              >
                {t("hr:reviews.areasForImprovement")}
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingInlineStart: "20px",
                  color: "#222222",
                  lineHeight: 1.8,
                }}
              >
                {formatTextToList(areasForImprovement).map((item, index) => (
                  <li key={index} style={{ marginBottom: "8px" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Goals for Next Quarter */}
          {goalsNextQuarter && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  color: "#0C5536",
                  fontSize: "16px",
                  marginBottom: "12px",
                  borderBottom: "2px solid #C6A03B",
                  paddingBottom: "8px",
                }}
              >
                {t("hr:reviews.goalsNextQuarter")}
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingInlineStart: "20px",
                  color: "#222222",
                  lineHeight: 1.8,
                }}
              >
                {formatTextToList(goalsNextQuarter).map((item, index) => (
                  <li key={index} style={{ marginBottom: "8px" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Development Plan */}
          {developmentPlan && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  color: "#0C5536",
                  fontSize: "16px",
                  marginBottom: "12px",
                  borderBottom: "2px solid #C6A03B",
                  paddingBottom: "8px",
                }}
              >
                {t("hr:reviews.developmentPlan")}
              </h3>
              <p
                style={{
                  color: "#222222",
                  lineHeight: 1.6,
                  margin: 0,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {developmentPlan}
              </p>
            </div>
          )}

          {/* Manager Comments */}
          {managerComments && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  color: "#0C5536",
                  fontSize: "16px",
                  marginBottom: "12px",
                  borderBottom: "2px solid #C6A03B",
                  paddingBottom: "8px",
                }}
              >
                {t("hr:reviews.managerComments")}
              </h3>
              <p
                style={{
                  color: "#222222",
                  lineHeight: 1.6,
                  margin: 0,
                  fontStyle: "italic",
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {managerComments}
              </p>
            </div>
          )}

          {/* Custom Fields */}
          {customFields && templateSections && templateSections
            .filter((s) => s.isCustom && customFields[s.id])
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <div key={section.id} style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    color: "#7C3AED",
                    fontSize: "16px",
                    marginBottom: "12px",
                    borderBottom: "2px solid #C6A03B",
                    paddingBottom: "8px",
                  }}
                >
                  {section.title}
                </h3>
                <p
                  style={{
                    color: "#222222",
                    lineHeight: 1.6,
                    margin: 0,
                    textAlign: isRtl ? "right" : "left",
                  }}
                >
                  {customFields[section.id]}
                </p>
              </div>
            ))}

          {/* Signatures Section */}
          <div
            style={{
              marginTop: "40px",
              paddingTop: "24px",
              borderTop: "2px solid #E6E6E4",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {/* Reviewer */}
                <tr>
                  <td style={{ width: "50%", padding: "16px 0", verticalAlign: "top" }}>
                    <p style={{ margin: "0 0 8px 0", color: "#666666", fontSize: "12px" }}>
                      {t("hr:reviews.reviewedBy")}
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontWeight: "bold", color: "#222222" }}>
                      {reviewerName || "-"}
                    </p>
                    {submittedAt && (
                      <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
                        {formatDate(submittedAt)}
                      </p>
                    )}
                  </td>
                  
                  {/* Approver */}
                  <td style={{ width: "50%", padding: "16px 0", verticalAlign: "top" }}>
                    <p style={{ margin: "0 0 8px 0", color: "#666666", fontSize: "12px" }}>
                      {t("hr:reviews.approvedByHR")}
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontWeight: "bold", color: "#222222" }}>
                      {approvedBy || "-"}
                    </p>
                    {approvedAt && (
                      <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
                        {formatDate(approvedAt)}
                      </p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "16px",
            textAlign: "center",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <p
            style={{
              color: "#999999",
              fontSize: "11px",
              margin: 0,
            }}
          >
            {t("hr:reviews.confidentialDocument")} • {t("hr:reviews.generatedOn")}{" "}
            {new Date().toLocaleDateString(isRtl ? "ar-EG" : "en-US")}
          </p>
        </div>
      </div>
    );
  }
);

QuarterlyReviewPDFTemplate.displayName = "QuarterlyReviewPDFTemplate";
