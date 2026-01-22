"use client";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

type KPIEvaluation = {
  kpi: {
    id: string;
    name: string;
    description: string | null;
    target_value: number;
    unit: string;
    weighting: number;
  };
  achieved_value: number | null;
  score: number | null;
  status: string | null;
};

type EmployeeReport = {
  employeeName: string;
  jobRoleName: string | null;
  evaluations: KPIEvaluation[];
  overallScore: number | null;
};

type BulkKPIReportPDFTemplateProps = {
  employees: EmployeeReport[];
  periodLabel: string;
  isQuarterly: boolean;
  year: number;
};

export const BulkKPIReportPDFTemplate = forwardRef<HTMLDivElement, BulkKPIReportPDFTemplateProps>(
  ({ employees, periodLabel, isQuarterly, year }, ref) => {
    const { t, i18n } = useTranslation(["hr", "common"]);
    const isRtl = i18n.language === "ar";

    const getScoreColor = (score: number | null): string => {
      if (!score) return "#666666";
      if (score >= 80) return "#0C5536";
      if (score >= 60) return "#C6A03B";
      return "#DC2626";
    };

    // Table headers for RTL/LTR
    const headers = isRtl
      ? [
          { key: "score", label: t("hr:score") },
          { key: "weight", label: t("hr:weighting") },
          { key: "achieved", label: t("hr:achievedValue") },
          { key: "target", label: t("hr:targetValue") },
          { key: "kpi", label: t("hr:kpi") },
        ]
      : [
          { key: "kpi", label: t("hr:kpi") },
          { key: "target", label: t("hr:targetValue") },
          { key: "achieved", label: t("hr:achievedValue") },
          { key: "weight", label: t("hr:weighting") },
          { key: "score", label: t("hr:score") },
        ];

    const renderCellValue = (key: string, evaluation: KPIEvaluation) => {
      const { kpi, achieved_value, score } = evaluation;
      switch (key) {
        case "kpi":
          return kpi.name;
        case "target":
          return `${kpi.target_value} ${kpi.unit}`;
        case "achieved":
          return achieved_value !== null ? `${achieved_value} ${kpi.unit}` : "-";
        case "weight":
          return `${kpi.weighting}%`;
        case "score":
          return score !== null ? `${score}%` : "-";
        default:
          return "";
      }
    };

    return (
      <div
        ref={ref}
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          fontFamily: "Arial, sans-serif",
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
            padding: "20px",
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
            {t("hr:bulkKPIPerformanceReport")}
          </h1>
          <p
            style={{
              color: "#C6A03B",
              margin: "10px 0 0 0",
              fontSize: "16px",
            }}
          >
            {periodLabel}
          </p>
        </div>

        {/* Summary Section */}
        <div
          style={{
            backgroundColor: "#FAFAF8",
            padding: "15px 20px",
            borderLeft: "1px solid #E6E6E4",
            borderRight: "1px solid #E6E6E4",
          }}
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#666666", textAlign: isRtl ? "right" : "left" }}>
            {t("hr:totalEmployeesInReport")}: <strong style={{ color: "#222222" }}>{employees.length}</strong>
            {isQuarterly && (
              <span style={{ marginLeft: isRtl ? 0 : "20px", marginRight: isRtl ? "20px" : 0 }}>
                | {t("hr:quarterlyReportNote")}
              </span>
            )}
          </p>
        </div>

        {/* Content - Each Employee */}
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #E6E6E4",
            borderTop: "none",
          }}
        >
          {employees.map((employee, index) => (
            <div
              key={index}
              style={{
                padding: "20px",
                borderBottom: index < employees.length - 1 ? "2px solid #E6E6E4" : "none",
                pageBreakInside: "avoid",
              }}
            >
              {/* Employee Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                  flexDirection: isRtl ? "row-reverse" : "row",
                }}
              >
                <div style={{ textAlign: isRtl ? "right" : "left" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      color: "#222222",
                      fontWeight: "bold",
                    }}
                  >
                    {employee.employeeName}
                  </h2>
                  {employee.jobRoleName && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#666666" }}>
                      {employee.jobRoleName}
                    </p>
                  )}
                </div>
                {employee.overallScore !== null && (
                  <div
                    style={{
                      backgroundColor: employee.overallScore >= 80 ? "#E6F7F1" : employee.overallScore >= 60 ? "#FFF9E6" : "#FEE2E2",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: getScoreColor(employee.overallScore),
                      }}
                    >
                      {employee.overallScore}%
                    </span>
                  </div>
                )}
              </div>

              {/* KPI Table */}
              {employee.evaluations.length > 0 ? (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#FAFAF8" }}>
                      {headers.map((header) => (
                        <th
                          key={header.key}
                          style={{
                            padding: "8px 10px",
                            textAlign: header.key === "kpi" ? (isRtl ? "right" : "left") : "center",
                            borderBottom: "1px solid #E6E6E4",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#666666",
                          }}
                        >
                          {header.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employee.evaluations.map((evaluation, evalIndex) => (
                      <tr key={evalIndex}>
                        {headers.map((header) => (
                          <td
                            key={header.key}
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #E6E6E4",
                              textAlign: header.key === "kpi" ? (isRtl ? "right" : "left") : "center",
                              color: header.key === "score" ? getScoreColor(evaluation.score) : "#222222",
                              fontWeight: header.key === "score" ? "bold" : "normal",
                            }}
                          >
                            {renderCellValue(header.key, evaluation)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: "#666666", fontStyle: "italic", textAlign: isRtl ? "right" : "left" }}>
                  {t("hr:noKPIsAssignedForPeriod")}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "15px",
            textAlign: "center",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <p
            style={{
              color: "#999999",
              fontSize: "12px",
              margin: 0,
            }}
          >
            {t("hr:generatedOn")} {new Date().toLocaleDateString(isRtl ? "ar-EG" : "en-US")} | {t("hr:automatedNotification")}
          </p>
        </div>
      </div>
    );
  }
);

BulkKPIReportPDFTemplate.displayName = "BulkKPIReportPDFTemplate";
