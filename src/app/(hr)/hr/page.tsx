"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Users, Building, FileText, ClipboardList, CalendarCheck, LayoutDashboard } from "lucide-react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ExpiryAlertCard, AlertSummaryCards, AttendanceSummaryCard, LeaveSummaryWidget, DashboardSkeleton, KPIEvaluationAlertCard } from "@/components/hr";
import { LeaveAnalyticsWidget } from "@/components/hr/leave-analytics";
import { BatchDocumentExportButton } from "@/components/hr/documents/BatchDocumentExportButton";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  departments: number;
  expiringDocuments: number;
  pendingMonthlyReviews: number;
  pendingQuarterlyReviews: number;
}

interface PendingReviewDetail {
  employee_id: string;
  employee_name: string;
  pending_count: number;
}

interface MonthlyGroup {
  month: number;
  year: number;
  employees: PendingReviewDetail[];
}

interface QuarterlyGroup {
  quarter: number;
  year: number;
  employees: PendingReviewDetail[];
}

interface ExpiringDocument {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  document_type: string;
  expiry_date: string;
  renewal_status?: string | null;
  renewal_submitted_at?: string | null;
  renewal_expected_at?: string | null;
  last_reminder_at?: string | null;
  reminder_count?: number | null;
}

export default function HRDashboard() {
  const { t } = useTranslation(["hr"]);
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/admin") ? "/admin/hr" : "/hr";
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
    expiringDocuments: 0,
    pendingMonthlyReviews: 0,
    pendingQuarterlyReviews: 0,
  });
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDocument[]>([]);
  const [monthlyGroups, setMonthlyGroups] = useState<MonthlyGroup[]>([]);
  const [quarterlyGroups, setQuarterlyGroups] = useState<QuarterlyGroup[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchPendingReviewsCounts = async () => {
    try {
      // Get pending evaluations with employee names
      const { data: pendingEvaluations, error } = await supabase
        .from("kpi_evaluations")
        .select(`
          employee_id,
          month,
          year,
          employees(full_name)
        `)
        .or("achieved_value.is.null,status.eq.pending");

      if (error || !pendingEvaluations || pendingEvaluations.length === 0) {
        setMonthlyGroups([]);
        setQuarterlyGroups([]);
        return { pendingMonthly: 0, pendingQuarterly: 0 };
      }

      // Group by month-year for monthly view
      const monthMap = new Map<string, { month: number; year: number; employees: Map<string, PendingReviewDetail> }>();

      // Group by quarter-year for quarterly view
      const quarterMap = new Map<string, { quarter: number; year: number; employees: Map<string, PendingReviewDetail> }>();

      pendingEvaluations.forEach((eval_: any) => {
        const employeeName = eval_.employees?.full_name || "Unknown";
        const monthKey = `${eval_.year}-${eval_.month}`;
        const quarter = Math.ceil(eval_.month / 3);
        const quarterKey = `${eval_.year}-Q${quarter}`;

        // Add to monthly groups
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: eval_.month,
            year: eval_.year,
            employees: new Map()
          });
        }
        const monthGroup = monthMap.get(monthKey)!;
        if (!monthGroup.employees.has(eval_.employee_id)) {
          monthGroup.employees.set(eval_.employee_id, {
            employee_id: eval_.employee_id,
            employee_name: employeeName,
            pending_count: 1
          });
        } else {
          monthGroup.employees.get(eval_.employee_id)!.pending_count++;
        }

        // Add to quarterly groups
        if (!quarterMap.has(quarterKey)) {
          quarterMap.set(quarterKey, {
            quarter,
            year: eval_.year,
            employees: new Map()
          });
        }
        const quarterGroup = quarterMap.get(quarterKey)!;
        if (!quarterGroup.employees.has(eval_.employee_id)) {
          quarterGroup.employees.set(eval_.employee_id, {
            employee_id: eval_.employee_id,
            employee_name: employeeName,
            pending_count: 1
          });
        } else {
          quarterGroup.employees.get(eval_.employee_id)!.pending_count++;
        }
      });

      // Convert to arrays and sort by date (newest first)
      const monthlyGroupsArray: MonthlyGroup[] = Array.from(monthMap.values())
        .map(g => ({
          month: g.month,
          year: g.year,
          employees: Array.from(g.employees.values())
        }))
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });

      const quarterlyGroupsArray: QuarterlyGroup[] = Array.from(quarterMap.values())
        .map(g => ({
          quarter: g.quarter,
          year: g.year,
          employees: Array.from(g.employees.values())
        }))
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.quarter - a.quarter;
        });

      setMonthlyGroups(monthlyGroupsArray);
      setQuarterlyGroups(quarterlyGroupsArray);

      // Count total pending (sum of all employees across all months/quarters)
      const totalMonthlyPending = monthlyGroupsArray.reduce((sum, g) => sum + g.employees.length, 0);
      const totalQuarterlyPending = quarterlyGroupsArray.reduce((sum, g) => sum + g.employees.length, 0);

      return {
        pendingMonthly: totalMonthlyPending,
        pendingQuarterly: totalQuarterlyPending
      };
    } catch (error) {
      console.error("Error fetching pending reviews:", error);
      setMonthlyGroups([]);
      setQuarterlyGroups([]);
      return { pendingMonthly: 0, pendingQuarterly: 0 };
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch employee counts
      const { data: employees } = await supabase
        .from("employees")
        .select("id, employment_status");

      // Fetch departments count
      const { count: deptCount } = await supabase
        .from("departments")
        .select("*", { count: "exact", head: true });

      // Fetch expiring documents (next 90 days) + expired + in renewal progress
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const { data: documents } = await supabase
        .from("employee_documents")
        .select(`
          id,
          employee_id,
          document_type,
          expiry_date,
          renewal_status,
          renewal_submitted_at,
          renewal_expected_at,
          last_reminder_at,
          reminder_count,
          employees!inner(full_name, email)
        `)
        .eq("is_active", true) // Only show active documents (not archived versions)
        .not("expiry_date", "is", null)
        .lte("expiry_date", ninetyDaysFromNow.toISOString().split("T")[0])
        .order("expiry_date", { ascending: true });

      const totalEmployees = employees?.length || 0;
      const activeEmployees = employees?.filter((e) => e.employment_status === "active").length || 0;

      const formattedDocs: ExpiringDocument[] = (documents || []).map((doc: any) => ({
        id: doc.id,
        employee_id: doc.employee_id,
        employee_name: doc.employees.full_name,
        employee_email: doc.employees.email,
        document_type: doc.document_type,
        expiry_date: doc.expiry_date,
        renewal_status: doc.renewal_status,
        renewal_submitted_at: doc.renewal_submitted_at,
        renewal_expected_at: doc.renewal_expected_at,
        last_reminder_at: doc.last_reminder_at,
        reminder_count: doc.reminder_count,
      }));

      // Fetch pending KPI reviews counts
      const { pendingMonthly, pendingQuarterly } = await fetchPendingReviewsCounts();

      setStats({
        totalEmployees,
        activeEmployees,
        departments: deptCount || 0,
        expiringDocuments: formattedDocs.length,
        pendingMonthlyReviews: pendingMonthly,
        pendingQuarterlyReviews: pendingQuarterly,
      });

      setExpiringDocs(formattedDocs);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 mb-6 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <LayoutDashboard className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:dashboard")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("hr:dashboardDescription")}
            </p>
          </div>

          {stats.expiringDocuments > 0 && (
            <Link href={`${basePath}/documents`}>
              <div className="flex items-center gap-3 px-3 py-2 bg-white border border-[#E6E6E4] rounded-md hover:border-[#C6A03B] transition-all cursor-pointer">
                <FileText className="h-4 w-4 text-[#777777]" />
                <span className="text-[#DC2626] font-medium text-sm">
                  {stats.expiringDocuments} {t("hr:Expiring")}
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-lg border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("hr:totalEmployees")}
              </CardTitle>
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198, 160, 59, 0.15)' }}>
                <Users className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[#222222]">
              {stats.totalEmployees}
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("hr:registeredEmployees")}
            </p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3"></div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("hr:activeEmployees")}
              </CardTitle>
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198, 160, 59, 0.15)' }}>
                <Users className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[hsl(var(--jw-primary-green))]">
              {stats.activeEmployees}
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("hr:currentlyActive")}
            </p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3"></div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("hr:departments")}
              </CardTitle>
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198, 160, 59, 0.15)' }}>
                <Building className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[#222222]">
              {stats.departments}
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("hr:activeDepartments")}
            </p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3"></div>
          </CardContent>
        </Card>

        <Card className={`rounded-lg hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group ${
          stats.expiringDocuments > 0 
            ? "bg-red-50 border-red-200" 
            : "border border-[#E6E6E4]"
        }`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("hr:expiringDocs")}
              </CardTitle>
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                stats.expiringDocuments > 0 ? "bg-red-100" : ""
              }`} style={stats.expiringDocuments === 0 ? { backgroundColor: 'rgba(198, 160, 59, 0.15)' } : {}}>
                <FileText className={`h-5 w-5 ${stats.expiringDocuments > 0 ? "text-red-500" : "text-[#0C5536]"}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tracking-tight ${stats.expiringDocuments > 0 ? "text-red-600" : "text-[#222222]"}`}>
              {stats.expiringDocuments}
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("hr:documentsExpiring")}
            </p>
            <div className={`h-0.5 w-0 group-hover:w-full transition-all duration-300 mt-3 ${
              stats.expiringDocuments > 0 ? "bg-red-400" : "bg-[#C6A03B]"
            }`}></div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Review Stats Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className={`rounded-lg transition-all duration-100 group ${
            monthlyGroups.length > 0
              ? "bg-amber-50 border-amber-200 hover:shadow-[0_2px_8px_rgba(245,158,11,0.12)]"
              : "border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)]"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("hr:pendingMonthlyReviews")}
              </CardTitle>
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                monthlyGroups.length > 0 ? "bg-amber-100" : ""
              }`} style={monthlyGroups.length === 0 ? { backgroundColor: 'rgba(198, 160, 59, 0.15)' } : {}}>
                <ClipboardList className={`h-5 w-5 ${
                  monthlyGroups.length > 0 ? "text-amber-600" : "text-[#0C5536]"
                }`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tracking-tight ${
              monthlyGroups.length > 0 ? "text-amber-600" : "text-[hsl(var(--jw-primary-green))]"
            }`}>
              {stats.pendingMonthlyReviews}
            </div>
            {monthlyGroups.length > 0 ? (
              <p className="text-xs text-amber-500 mt-2">{monthlyGroups.length} {t("hr:monthsPending")}</p>
            ) : (
              <p className="text-xs text-[#777777] mt-2">{t("hr:allReviewsComplete")}</p>
            )}

            {monthlyGroups.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="relative">
                  <div className="max-h-[200px] overflow-y-auto space-y-3 pr-1">
                    {monthlyGroups.map((group) => (
                      <div key={`${group.year}-${group.month}`} className="space-y-1.5">
                        <div className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-md sticky top-0">
                          {t(`hr:month.${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][group.month - 1]}`)} {group.year}
                        </div>
                        {group.employees.map((emp) => (
                          <Link
                            key={`${emp.employee_id}-${group.month}-${group.year}`}
                            href={`/admin/hr/kpis/evaluations/${emp.employee_id}?month=${group.month}&year=${group.year}`}
                            className="flex items-center justify-between p-2 rounded-md bg-white/70 hover:bg-white border border-amber-100 hover:border-amber-300 transition-colors text-sm ml-2"
                          >
                            <span className="font-medium text-[#222222] truncate">
                              {emp.employee_name}
                            </span>
                            <span className="text-amber-500 text-xs">
                              {emp.pending_count} KPI{emp.pending_count > 1 ? 's' : ''}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                  {monthlyGroups.length > 2 && (
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-amber-50 to-transparent pointer-events-none" />
                  )}
                </div>
              </div>
            )}
            <div className={`h-0.5 w-0 group-hover:w-full transition-all duration-300 mt-3 ${
              monthlyGroups.length > 0 ? "bg-amber-400" : "bg-[#C6A03B]"
            }`}></div>
          </CardContent>
        </Card>

        <Card
          className={`rounded-lg transition-all duration-100 group ${
            quarterlyGroups.length > 0
              ? "bg-orange-50 border-orange-200 hover:shadow-[0_2px_8px_rgba(249,115,22,0.12)]"
              : "border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)]"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("hr:pendingQuarterlyReviews")}
              </CardTitle>
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                quarterlyGroups.length > 0 ? "bg-orange-100" : ""
              }`} style={quarterlyGroups.length === 0 ? { backgroundColor: 'rgba(198, 160, 59, 0.15)' } : {}}>
                <CalendarCheck className={`h-5 w-5 ${
                  quarterlyGroups.length > 0 ? "text-orange-600" : "text-[#0C5536]"
                }`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tracking-tight ${
              quarterlyGroups.length > 0 ? "text-orange-600" : "text-[hsl(var(--jw-primary-green))]"
            }`}>
              {stats.pendingQuarterlyReviews}
            </div>
            {quarterlyGroups.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="relative">
                  <div className="max-h-[200px] overflow-y-auto space-y-3 pr-1">
                    {quarterlyGroups.map((group) => (
                      <div key={`${group.year}-Q${group.quarter}`} className="space-y-1.5">
                        <div className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded-md sticky top-0">
                          Q{group.quarter} {group.year}
                        </div>
                        {group.employees.map((emp) => (
                          <Link
                            key={`${emp.employee_id}-Q${group.quarter}-${group.year}`}
                            href={`/admin/hr/kpis/evaluations/${emp.employee_id}`}
                            className="flex items-center justify-between p-2 rounded-md bg-white/70 hover:bg-white border border-orange-100 hover:border-orange-300 transition-colors text-sm ml-2"
                          >
                            <span className="font-medium text-[#222222] truncate">
                              {emp.employee_name}
                            </span>
                            <span className="text-orange-500 text-xs">
                              {emp.pending_count} KPI{emp.pending_count > 1 ? 's' : ''}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                  {quarterlyGroups.length > 2 && (
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-orange-50 to-transparent pointer-events-none" />
                  )}
                </div>
              </div>
            )}
            <div className={`h-0.5 w-0 group-hover:w-full transition-all duration-300 mt-3 ${
              quarterlyGroups.length > 0 ? "bg-orange-400" : "bg-[#C6A03B]"
            }`}></div>
          </CardContent>
        </Card>
      </div>

      {/* Expiry Alert Summary */}
      <AlertSummaryCards documents={expiringDocs} />

      {/* KPI Evaluation Alert */}
      <KPIEvaluationAlertCard />

      {/* Dashboard Widgets - 2 column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance */}
        <AttendanceSummaryCard />

        {/* Leave Requests */}
        <LeaveSummaryWidget />
      </div>

      {/* AI-Powered Leave Analytics */}
      <LeaveAnalyticsWidget />

      {/* Document Expiry Alerts - Full Width */}
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <Link href={`${basePath}/documents`}>
            <Button variant="outline" size="sm" className="border-[#E6E6E4]">
              <FileText className="h-4 w-4 mr-2" />
              {t("hr:documents")}
            </Button>
          </Link>
          <BatchDocumentExportButton />
        </div>
        <ExpiryAlertCard documents={expiringDocs} onRefresh={fetchDashboardData} />
      </div>
    </div>
  );
}
