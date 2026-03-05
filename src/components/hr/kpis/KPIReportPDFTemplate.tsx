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

type CustomKPIEvaluation = {
  customKpi: {
    id: string;
    name: string;
    description: string | null;
    target_value: number;
    unit: string;
    weighting: number;
    deadline: string | null;
  };
  achieved_value: number | null;
  score: number | null;
  status: string | null;
};

type KPIReportPDFTemplateProps = {
  employeeName: string;
  jobRoleName: string | null;
  year: number;
  month: number;
  evaluations: KPIEvaluation[];
  overallScore: number | null;
  periodLabel?: string;
  isQuarterly?: boolean;
  customEvaluations?: CustomKPIEvaluation[];
  customOverallScore?: number | null;
};

export const KPIReportPDFTemplate = forwardRef<HTMLDivElement, KPIReportPDFTemplateProps>(
  ({ employeeName, jobRoleName, year, month, evaluations, overallScore, periodLabel, isQuarterly = false, customEvaluations = [], customOverallScore }, ref) => {
    const { t, i18n } = useTranslation(["hr", "common"]);
    const isRtl = i18n.language === "ar";

    const monthName = new Date(year, month - 1, 1).toLocaleString(
      isRtl ? "ar-EG" : "en-US",
      { month: "long" }
    );

    // Use provided periodLabel or default to month year
    const displayPeriod = periodLabel || `${monthName} ${year}`;

    const getScoreColor = (score: number | null): string => {
      if (!score) return "#666666";
      if (score >= 80) return "#0C5536";
      if (score >= 60) return "#C6A03B";
      return "#DC2626";
    };

    const overallColor = getScoreColor(overallScore);

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
            {t("hr:kpiPerformanceReport")}
          </h1>
          <p
            style={{
              color: "#C6A03B",
              margin: "10px 0 0 0",
              fontSize: "16px",
            }}
          >
            {displayPeriod}
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
          {/* Greeting */}
          <p style={{ fontSize: "16px", textAlign: isRtl ? "right" : "left" }}>
            {t("hr:dear")} {employeeName},
          </p>

          <p
            style={{
              fontSize: "16px",
              lineHeight: 1.6,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {isQuarterly
              ? t("hr:hereIsYourQuarterlyKPIReport", { period: displayPeriod })
              : t("hr:hereIsYourKPIReport", { month: monthName, year })}
          </p>

          {/* Quarterly note */}
          {isQuarterly && (
            <p
              style={{
                fontSize: "12px",
                color: "#6B6B6B",
                fontStyle: "italic",
                textAlign: isRtl ? "right" : "left",
                marginTop: "4px",
              }}
            >
              {t("hr:quarterlyReportNote")}
            </p>
          )}

          {/* Employee Info */}
          {jobRoleName && (
            <div
              style={{
                backgroundColor: "#FAFAF8",
                padding: "12px 16px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #E6E6E4",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#666666",
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {t("hr:jobRole")}: <strong style={{ color: "#222222" }}>{jobRoleName}</strong>
              </p>
            </div>
          )}

          {/* Overall Score */}
          {overallScore !== null && (
            <div
              style={{
                backgroundColor: "#f5f5f5",
                padding: "20px",
                borderRadius: "8px",
                margin: "20px 0",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, color: "#666666", fontSize: "14px" }}>
                {t("hr:overallWeightedScore")}
              </p>
              <h2
                style={{
                  margin: "10px 0",
                  color: overallColor,
                  fontSize: "36px",
                  fontWeight: "bold",
                }}
              >
                {overallScore}%
              </h2>
            </div>
          )}

          {/* KPI Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              margin: "20px 0",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#FAFAF8" }}>
                {headers.map((header) => (
                  <th
                    key={header.key}
                    style={{
                      padding: "12px",
                      textAlign: header.key === "kpi" ? (isRtl ? "right" : "left") : "center",
                      borderBottom: "2px solid #E6E6E4",
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: "#222222",
                    }}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation) => (
                <tr key={evaluation.kpi.id}>
                  {headers.map((header) => (
                    <td
                      key={header.key}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #E6E6E4",
                        textAlign: header.key === "kpi" ? (isRtl ? "right" : "left") : "center",
                        fontSize: "14px",
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

          {/* Custom / Individual Goals Section */}
          {customEvaluations.length > 0 && (
            <>
              <div
                style={{
                  borderTop: "2px solid #E6E6E4",
                  marginTop: "30px",
                  paddingTop: "20px",
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#7C3AED",
                    margin: "0 0 15px 0",
                    textAlign: isRtl ? "right" : "left",
                  }}
                >
                  {t("hr:individualGoals")}
                </h3>
              </div>

              {/* Custom KPI Score */}
              {customOverallScore !== null && customOverallScore !== undefined && (
                <div
                  style={{
                    backgroundColor: "#F5F3FF",
                    padding: "15px",
                    borderRadius: "8px",
                    margin: "10px 0 20px 0",
                    textAlign: "center",
                    border: "1px solid #DDD6FE",
                  }}
                >
                  <p style={{ margin: 0, color: "#7C3AED", fontSize: "14px" }}>
                    {t("hr:customScore")}
                  </p>
                  <h3
                    style={{
                      margin: "8px 0",
                      color: getScoreColor(customOverallScore),
                      fontSize: "28px",
                      fontWeight: "bold",
                    }}
                  >
                    {customOverallScore}%
                  </h3>
                </div>
              )}

              {/* Custom KPI Table */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  margin: "10px 0 20px 0",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#F5F3FF" }}>
                    {(isRtl
                      ? [
                          { key: "deadline", label: t("hr:deadline") },
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
                          { key: "deadline", label: t("hr:deadline") },
                        ]
                    ).map((header) => (
                      <th
                        key={header.key}
                        style={{
                          padding: "12px",
                          textAlign: header.key === "kpi" ? (isRtl ? "right" : "left") : "center",
                          borderBottom: "2px solid #DDD6FE",
                          fontSize: "14px",
                          fontWeight: "bold",
                          color: "#222222",
                        }}
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customEvaluations.map((evaluation) => (
                    <tr key={evaluation.customKpi.id}>
                      {(isRtl
                        ? ["deadline", "score", "weight", "achieved", "target", "kpi"]
                        : ["kpi", "target", "achieved", "weight", "score", "deadline"]
                      ).map((key) => (
                        <td
                          key={key}
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #E6E6E4",
                            textAlign: key === "kpi" ? (isRtl ? "right" : "left") : "center",
                            fontSize: "14px",
                            color: key === "score" ? getScoreColor(evaluation.score) : "#222222",
                            fontWeight: key === "score" ? "bold" : "normal",
                          }}
                        >
                          {key === "kpi" && evaluation.customKpi.name}
                          {key === "target" && `${evaluation.customKpi.target_value} ${evaluation.customKpi.unit}`}
                          {key === "achieved" && (evaluation.achieved_value !== null ? `${evaluation.achieved_value} ${evaluation.customKpi.unit}` : "-")}
                          {key === "weight" && `${evaluation.customKpi.weighting}%`}
                          {key === "score" && (evaluation.score !== null ? `${evaluation.score}%` : "-")}
                          {key === "deadline" && (evaluation.customKpi.deadline
                            ? new Date(evaluation.customKpi.deadline).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Footer Message */}
          <p
            style={{
              color: "#666666",
              lineHeight: 1.6,
              fontSize: "14px",
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t("hr:kpiReportFooterMessage")}
          </p>

          <p
            style={{
              color: "#0C5536",
              marginTop: "30px",
              fontWeight: "bold",
              fontSize: "14px",
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t("hr:hrDepartment")}
          </p>
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
            {t("hr:automatedNotification")}
          </p>
        </div>
      </div>
    );
  }
);

KPIReportPDFTemplate.displayName = "KPIReportPDFTemplate";
