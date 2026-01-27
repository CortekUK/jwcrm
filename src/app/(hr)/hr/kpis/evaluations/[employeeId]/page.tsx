"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentMonth, getCurrentYear } from "@/lib/kpi-validation";
import { EmployeeKPIEvaluationForm, EmployeeKPIHistory, SendKPIReportButton, DownloadKPIReportButton } from "@/components/hr/kpis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ClipboardCheck, User } from "lucide-react";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  job_role_id: string | null;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

export default function EmployeeEvaluationPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const employeeId = params?.employeeId as string;
  const initialYear = searchParams?.get("year") ? Number(searchParams?.get("year")) : getCurrentYear();
  const initialMonth = searchParams?.get("month") ? Number(searchParams?.get("month")) : getCurrentMonth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  const handlePeriodChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("id, full_name, email, job_role_id, job_role:job_roles(id, name)")
          .eq("id", employeeId)
          .single();

        if (error) throw error;

        if (data) {
          setEmployee(data);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error("Error fetching employee:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId]);

  const handleSuccess = () => {
    // Refresh or show success message
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-24" />
        <Card className="border-[#E6E6E4]">
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound || !employee) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-colors"
        >
          <ArrowLeft className={`h-4 w-4 text-[#555555] ${isRtl ? "rotate-180" : ""}`} />
        </button>
        <Card className="border-[#E6E6E4]">
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
            <p className="text-[#6B6B6B]">{t("hr:employeeNotFound")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-colors"
      >
        <ArrowLeft className={`h-4 w-4 text-[#555555] ${isRtl ? "rotate-180" : ""}`} />
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evaluation Card - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card className="border-[#E6E6E4]">
            <CardHeader>
              <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                <div className={isRtl ? "text-right" : ""}>
                  <CardTitle className={`text-xl font-semibold text-[#0C5536] flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`} style={{ fontFamily: 'Playfair Display, serif' }}>
                    <ClipboardCheck className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    {t("hr:evaluateKPIs")}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <span className="font-medium text-[#222222]">{employee.full_name}</span>
                    {employee.job_role?.name && (
                      <span className="text-[#6B6B6B]"> - {employee.job_role.name}</span>
                    )}
                  </CardDescription>
                </div>

                {/* Report Buttons */}
                <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <DownloadKPIReportButton
                    employeeId={employee.id}
                    employeeName={employee.full_name}
                    jobRoleName={employee.job_role?.name || null}
                    year={currentYear}
                    month={currentMonth}
                  />
                  <SendKPIReportButton
                    employeeId={employee.id}
                    employeeName={employee.full_name}
                    employeeEmail={employee.email}
                    year={currentYear}
                    month={currentMonth}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <EmployeeKPIEvaluationForm
                employee={employee}
                initialYear={initialYear}
                initialMonth={initialMonth}
                onPeriodChange={handlePeriodChange}
                onSuccess={handleSuccess}
              />
            </CardContent>
          </Card>
        </div>

        {/* Performance History - Takes 1 column */}
        <div className="lg:col-span-1">
          <EmployeeKPIHistory
            employeeId={employee.id}
            employeeName={employee.full_name}
            jobRoleId={employee.job_role_id}
            onPeriodSelect={(year, month) => {
              setCurrentYear(year);
              setCurrentMonth(month);
              // Update URL params
              const url = new URL(window.location.href);
              url.searchParams.set("year", year.toString());
              url.searchParams.set("month", month.toString());
              router.replace(url.pathname + url.search);
            }}
          />
        </div>
      </div>
    </div>
  );
}
