"use client";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import type { DepartmentSummary } from "./DepartmentKPISummary";

type DepartmentSummaryPDFTemplateProps = {
  departmentSummaries: DepartmentSummary[];
  selectedDepartment?: DepartmentSummary | null;
  year: number;
  month: number;
  periodLabel: string;
};

export const DepartmentSummaryPDFTemplate = forwardRef<HTMLDivElement, DepartmentSummaryPDFTemplateProps>(
  ({ departmentSummaries, selectedDepartment, year, month, periodLabel }, ref) => {
    const { t, i18n } = useTranslation(["hr", "common"]);
    const isRtl = i18n.language === "ar";

    // Filter to selected department if provided
    const departments = selectedDepartment 
      ? [selectedDepartment] 
      : departmentSummaries;

    // Calculate overall stats
    const totalEmployees = departments.reduce((sum, d) => sum + d.employees_with_kpis, 0);
    const totalCompleted = departments.reduce((sum, d) => sum + d.completed_evaluations, 0);
    const totalPending = departments.reduce((sum, d) => sum + d.pending_evaluations, 0);
    const overallCompletionRate = totalEmployees > 0
      ? Math.round((totalCompleted / (totalCompleted + totalPending)) * 100) || 0
      : 0;
    const avgScores = departments.filter(d => d.average_score !== null).map(d => d.average_score!);
    const overallAvgScore = avgScores.length > 0
      ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length * 10) / 10
      : null;

    const getScoreColor = (score: number | null): string => {
      if (!score) return "#666666";
      if (score >= 80) return "#0C5536";
      if (score >= 60) return "#C6A03B";
      return "#DC2626";
    };

    return (
      <div
        ref={ref}
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          fontFamily: "Arial, sans-serif",
          maxWidth: "750px",
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
            {t("hr:departmentKPISummaryReport", "Department KPI Summary Report")}
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

        {/* Content */}
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            border: "1px solid #E6E6E4",
          }}
        >
          {/* Overall Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                backgroundColor: "#f5f5f5",
                padding: "16px",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
                {t("hr:departmentSummary.totalDepartments", "Total Departments")}
              </p>
              <h3 style={{ margin: "8px 0 0 0", color: "#222222", fontSize: "24px", fontWeight: "bold" }}>
                {departments.length}
              </h3>
            </div>

            <div
              style={{
                backgroundColor: "#f5f5f5",
                padding: "16px",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
                {t("hr:departmentSummary.employeesWithKPIs", "Employees with KPIs")}
              </p>
              <h3 style={{ margin: "8px 0 0 0", color: "#222222", fontSize: "24px", fontWeight: "bold" }}>
                {totalEmployees}
              </h3>
            </div>

            <div
              style={{
                backgroundColor: "#f5f5f5",
                padding: "16px",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
                {t("hr:departmentSummary.completionRate", "Completion Rate")}
              </p>
              <h3 style={{ margin: "8px 0 0 0", color: "#0C5536", fontSize: "24px", fontWeight: "bold" }}>
                {overallCompletionRate}%
              </h3>
            </div>

            <div
              style={{
                backgroundColor: "#f5f5f5",
                padding: "16px",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
                {t("hr:departmentSummary.averageScore", "Average Score")}
              </p>
              <h3 style={{ margin: "8px 0 0 0", color: getScoreColor(overallAvgScore), fontSize: "24px", fontWeight: "bold" }}>
                {overallAvgScore !== null ? `${overallAvgScore}%` : "-"}
              </h3>
            </div>
          </div>

          {/* Department Breakdown */}
          {departments.map((dept) => (
            <div
              key={dept.department_id}
              style={{
                marginBottom: "24px",
                border: "1px solid #E6E6E4",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              {/* Department Header */}
              <div
                style={{
                  backgroundColor: "#FAFAF8",
                  padding: "16px",
                  borderBottom: "1px solid #E6E6E4",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#0C5536", fontSize: "18px", fontWeight: "bold" }}>
                      {dept.department_name}
                    </h3>
                    <p style={{ margin: "4px 0 0 0", color: "#666666", fontSize: "12px" }}>
                      {dept.employees_with_kpis} {t("hr:departmentSummary.employees", "employees")} • {dept.job_roles.length} {t("hr:departmentSummary.roles", "roles")}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, color: "#666666", fontSize: "10px" }}>{t("hr:completed", "Completed")}</p>
                      <p style={{ margin: "2px 0 0 0", color: "#222222", fontSize: "14px", fontWeight: "bold" }}>
                        {dept.completion_rate}%
                      </p>
                    </div>
                    <div
                      style={{
                        backgroundColor: getScoreColor(dept.average_score) === "#0C5536" ? "#E6F7F1" :
                          getScoreColor(dept.average_score) === "#C6A03B" ? "#FFF9E6" : "#FDF2F2",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        textAlign: "center",
                      }}
                    >
                      <p style={{ margin: 0, color: getScoreColor(dept.average_score), fontSize: "16px", fontWeight: "bold" }}>
                        {dept.average_score !== null ? `${dept.average_score}%` : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Roles Table */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#F8F8F8" }}>
                    <th
                      style={{
                        padding: "10px 16px",
                        textAlign: isRtl ? "right" : "left",
                        borderBottom: "1px solid #E6E6E4",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#222222",
                      }}
                    >
                      {t("hr:jobRole", "Job Role")}
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        textAlign: "center",
                        borderBottom: "1px solid #E6E6E4",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#222222",
                      }}
                    >
                      {t("hr:employees", "Employees")}
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        textAlign: "center",
                        borderBottom: "1px solid #E6E6E4",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#222222",
                      }}
                    >
                      {t("hr:completed", "Completed")}
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        textAlign: "center",
                        borderBottom: "1px solid #E6E6E4",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#222222",
                      }}
                    >
                      {t("hr:pending", "Pending")}
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        textAlign: "center",
                        borderBottom: "1px solid #E6E6E4",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#222222",
                      }}
                    >
                      {t("hr:avgScore", "Avg Score")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dept.job_roles.map((role) => (
                    <tr key={role.job_role_id}>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #E6E6E4",
                          fontSize: "13px",
                          color: "#222222",
                        }}
                      >
                        {role.job_role_name}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #E6E6E4",
                          fontSize: "13px",
                          color: "#666666",
                          textAlign: "center",
                        }}
                      >
                        {role.employee_count}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #E6E6E4",
                          fontSize: "13px",
                          color: "#0C5536",
                          textAlign: "center",
                        }}
                      >
                        {role.completed_evaluations}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #E6E6E4",
                          fontSize: "13px",
                          color: role.pending_evaluations > 0 ? "#D97706" : "#666666",
                          textAlign: "center",
                        }}
                      >
                        {role.pending_evaluations}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #E6E6E4",
                          fontSize: "13px",
                          fontWeight: "bold",
                          color: getScoreColor(role.average_score),
                          textAlign: "center",
                        }}
                      >
                        {role.average_score !== null ? `${role.average_score}%` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Employee Details (optional - can be toggled) */}
              {dept.job_roles.map((role) => (
                role.employees.length > 0 && (
                  <div key={`emp-${role.job_role_id}`} style={{ padding: "12px 16px", backgroundColor: "#FAFAF8" }}>
                    <p style={{ margin: "0 0 8px 0", color: "#666666", fontSize: "11px", fontWeight: "bold" }}>
                      {role.job_role_name} - {t("hr:employees", "Employees")}:
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {role.employees.map((emp) => (
                        <span
                          key={emp.employee_id}
                          style={{
                            backgroundColor: "white",
                            padding: "4px 10px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            color: "#222222",
                            border: "1px solid #E6E6E4",
                          }}
                        >
                          {emp.employee_name}: <strong style={{ color: getScoreColor(emp.overall_score) }}>{emp.overall_score !== null ? `${emp.overall_score}%` : "-"}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          ))}

          {/* Footer Message */}
          <p
            style={{
              color: "#0C5536",
              marginTop: "30px",
              fontWeight: "bold",
              fontSize: "14px",
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t("hr:hrDepartment", "HR Department")}
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
            {t("hr:reportGeneratedAt", "Report generated at")} {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    );
  }
);

DepartmentSummaryPDFTemplate.displayName = "DepartmentSummaryPDFTemplate";
