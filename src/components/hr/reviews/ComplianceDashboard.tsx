"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileText,
  Users,
  TrendingUp,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, isPast, differenceInDays } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type DepartmentStats = {
  department_id: string;
  department_name: string;
  total: number;
  completed: number;
  approved: number;
  submitted: number;
  draft: number;
  overdue: number;
};

type OverdueReview = {
  id: string;
  quarter: number;
  year: number;
  deadline_date: string;
  status: string;
  employee: {
    full_name: string;
    department: {
      name: string;
    } | null;
  };
  reviewer: {
    email: string;
  } | null;
};

const getCurrentQuarter = (): number => Math.ceil((new Date().getMonth() + 1) / 3);
const getCurrentYear = (): number => new Date().getFullYear();

const COLORS = {
  complete: "#0C5536",
  approved: "#22c55e",
  submitted: "#3b82f6",
  draft: "#9ca3af",
  overdue: "#ef4444",
};

export function ComplianceDashboard() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();

  const [selectedQuarter, setSelectedQuarter] = useState(String(getCurrentQuarter()));
  const [selectedYear, setSelectedYear] = useState(String(getCurrentYear()));
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    complete: 0,
    approved: 0,
    submitted: 0,
    draft: 0,
    overdue: 0,
  });
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [overdueReviews, setOverdueReviews] = useState<OverdueReview[]>([]);

  const quarterOptions = [
    { value: "1", label: "Q1" },
    { value: "2", label: "Q2" },
    { value: "3", label: "Q3" },
    { value: "4", label: "Q4" },
  ];

  const yearOptions = [
    { value: String(getCurrentYear() - 1), label: String(getCurrentYear() - 1) },
    { value: String(getCurrentYear()), label: String(getCurrentYear()) },
  ];

  // Fetch compliance data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all reviews for the selected period
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("quarterly_reviews")
          .select(`
            id,
            status,
            deadline_date,
            quarter,
            year,
            employee:employees(
              id,
              full_name,
              department:departments(id, name)
            ),
            reviewer:auth.users(email)
          `)
          .eq("quarter", Number(selectedQuarter))
          .eq("year", Number(selectedYear));

        if (reviewsError) throw reviewsError;

        const reviews = reviewsData || [];

        // Calculate overall stats
        const now = new Date();
        const overdueList: OverdueReview[] = [];

        const statsCalc = {
          total: reviews.length,
          complete: 0,
          approved: 0,
          submitted: 0,
          draft: 0,
          overdue: 0,
        };

        reviews.forEach((review) => {
          switch (review.status) {
            case "complete":
              statsCalc.complete++;
              break;
            case "approved":
              statsCalc.approved++;
              break;
            case "submitted":
              statsCalc.submitted++;
              break;
            case "draft":
              statsCalc.draft++;
              break;
          }

          // Check for overdue
          if (
            review.deadline_date &&
            review.status !== "complete" &&
            review.status !== "approved" &&
            isPast(parseISO(review.deadline_date))
          ) {
            statsCalc.overdue++;
            overdueList.push(review as OverdueReview);
          }
        });

        setStats(statsCalc);
        setOverdueReviews(overdueList);

        // Calculate department stats
        const deptMap = new Map<string, DepartmentStats>();

        reviews.forEach((review) => {
          const deptId = review.employee?.department?.id || "unassigned";
          const deptName = review.employee?.department?.name || t("hr:reviews.unassigned");

          if (!deptMap.has(deptId)) {
            deptMap.set(deptId, {
              department_id: deptId,
              department_name: deptName,
              total: 0,
              completed: 0,
              approved: 0,
              submitted: 0,
              draft: 0,
              overdue: 0,
            });
          }

          const dept = deptMap.get(deptId)!;
          dept.total++;

          switch (review.status) {
            case "complete":
              dept.completed++;
              break;
            case "approved":
              dept.approved++;
              break;
            case "submitted":
              dept.submitted++;
              break;
            case "draft":
              dept.draft++;
              break;
          }

          if (
            review.deadline_date &&
            review.status !== "complete" &&
            review.status !== "approved" &&
            isPast(parseISO(review.deadline_date))
          ) {
            dept.overdue++;
          }
        });

        setDepartmentStats(Array.from(deptMap.values()).sort((a, b) => b.total - a.total));
      } catch (error) {
        console.error("Error fetching compliance data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedQuarter, selectedYear, t]);

  const completionRate = stats.total > 0 
    ? Math.round(((stats.complete + stats.approved) / stats.total) * 100) 
    : 0;

  const pieData = [
    { name: t("hr:reviews.status_complete"), value: stats.complete, color: COLORS.complete },
    { name: t("hr:reviews.status_approved"), value: stats.approved, color: COLORS.approved },
    { name: t("hr:reviews.status_submitted"), value: stats.submitted, color: COLORS.submitted },
    { name: t("hr:reviews.status_draft"), value: stats.draft, color: COLORS.draft },
  ].filter(d => d.value > 0);

  const barData = departmentStats.map((dept) => ({
    name: dept.department_name.length > 15 
      ? dept.department_name.substring(0, 15) + "..." 
      : dept.department_name,
    fullName: dept.department_name,
    completed: dept.completed + dept.approved,
    pending: dept.submitted + dept.draft,
    overdue: dept.overdue,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-[#E6E6E4] dark:border-gray-700">
              <CardContent className="p-6">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <SelectTrigger className="w-[100px] border-[#E6E6E4] dark:border-gray-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quarterOptions.map((q) => (
              <SelectItem key={q.value} value={q.value}>
                {q.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px] border-[#E6E6E4] dark:border-gray-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y.value} value={y.value}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Period Selection Badge */}
        <Badge 
          className="bg-[rgba(198,160,59,0.15)] text-[#0C5536] font-medium px-3 py-1.5 text-sm"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Q{selectedQuarter} {selectedYear}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reviews */}
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all">
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.totalReviews")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <FileText className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-[#222222]">{stats.total}</p>
            <p className="text-xs text-[#777777] mt-1">Q{selectedQuarter} {selectedYear}</p>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all">
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.completionRate")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-[#0C5536]">{completionRate}%</p>
            <p className="text-xs text-[#777777] mt-1">{stats.complete + stats.approved} {t("hr:reviews.completed").toLowerCase()}</p>
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card className={`border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all ${stats.submitted > 0 ? "bg-blue-50 border-blue-200" : ""}`}>
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.pendingApproval")}</p>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.submitted > 0 ? "bg-blue-100" : "bg-[rgba(198,160,59,0.15)]"}`}>
                <Clock className={`h-5 w-5 ${stats.submitted > 0 ? "text-blue-600" : "text-[#0C5536]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.submitted > 0 ? "text-blue-600" : "text-[#222222]"}`}>{stats.submitted}</p>
            <p className="text-xs text-[#777777] mt-1">{t("hr:reviews.awaitingApproval", "Awaiting approval")}</p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className={`border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all ${stats.overdue > 0 ? "bg-red-50 border-red-200" : ""}`}>
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.overdueReviews")}</p>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.overdue > 0 ? "bg-red-100" : "bg-[rgba(198,160,59,0.15)]"}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.overdue > 0 ? "text-red-600" : "text-[#0C5536]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.overdue > 0 ? "text-red-600" : "text-[#222222]"}`}>{stats.overdue}</p>
            <p className="text-xs text-[#777777] mt-1">{t("hr:reviews.needsAttention", "Needs attention")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all">
          <CardHeader className="pb-3">
            <CardTitle 
              className={`flex items-center gap-2 text-lg font-semibold text-[#0C5536] ${isRtl ? "flex-row-reverse" : ""}`}
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              <BarChart3 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:reviews.statusDistribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-[#6B6B6B]">
                {t("hr:reviews.noDataAvailable")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Performance Bar Chart */}
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all">
          <CardHeader className="pb-3">
            <CardTitle 
              className={`flex items-center gap-2 text-lg font-semibold text-[#0C5536] ${isRtl ? "flex-row-reverse" : ""}`}
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:reviews.byDepartment")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip 
                    formatter={(value, name) => [value, name === "completed" ? t("hr:reviews.completed") : name === "pending" ? t("hr:reviews.pending") : t("hr:reviews.overdue")]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill={COLORS.complete} name={t("hr:reviews.completed")} />
                  <Bar dataKey="pending" stackId="a" fill={COLORS.submitted} name={t("hr:reviews.pending")} />
                  <Bar dataKey="overdue" stackId="a" fill={COLORS.overdue} name={t("hr:reviews.overdue")} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-[#6B6B6B]">
                {t("hr:reviews.noDataAvailable")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Reviews Table */}
      {overdueReviews.length > 0 && (
        <Card className="border-red-200 bg-red-50/30 hover:shadow-[0_2px_8px_rgba(239,68,68,0.08)] transition-all">
          <CardHeader className="pb-3">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <CardTitle 
                className={`flex items-center gap-2 text-lg font-semibold text-red-600 ${isRtl ? "flex-row-reverse" : ""}`}
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                <AlertTriangle className="h-5 w-5" />
                {t("hr:reviews.overdueReviews")} ({overdueReviews.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/admin/hr/reviews?status=overdue")}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                {t("hr:viewAll", "View All")}
                <ChevronRight className={`h-4 w-4 ${isRtl ? "mr-1 rotate-180" : "ml-1"}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[#E6E6E4] dark:border-gray-700">
                  <TableHead className={isRtl ? "text-right" : ""}>{t("hr:employee")}</TableHead>
                  <TableHead className={isRtl ? "text-right" : ""}>{t("hr:department")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.period")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.deadline")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.daysOverdue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueReviews.slice(0, 5).map((review) => {
                  const daysOverdue = differenceInDays(new Date(), parseISO(review.deadline_date));
                  return (
                    <TableRow 
                      key={review.id} 
                      className="border-[#E6E6E4] dark:border-gray-700 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10"
                      onClick={() => router.push(`/hr/reviews/${review.id}`)}
                    >
                      <TableCell className={isRtl ? "text-right" : ""}>
                        {review.employee?.full_name}
                      </TableCell>
                      <TableCell className={isRtl ? "text-right" : ""}>
                        {review.employee?.department?.name || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">Q{review.quarter} {review.year}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-red-600">
                        {format(parseISO(review.deadline_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-100 text-red-700">
                          {daysOverdue} {t("hr:reviews.days")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Department Compliance Table */}
      <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all">
        <CardHeader className="pb-3">
          <CardTitle 
            className={`flex items-center gap-2 text-lg font-semibold text-[#0C5536] ${isRtl ? "flex-row-reverse" : ""}`}
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:reviews.departmentCompliance")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {departmentStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-[#E6E6E4] dark:border-gray-700">
                  <TableHead className={isRtl ? "text-right" : ""}>{t("hr:department")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.total")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.completed")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.pending")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.overdue")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.completionRate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departmentStats.map((dept) => {
                  const deptCompletionRate = dept.total > 0 
                    ? Math.round(((dept.completed + dept.approved) / dept.total) * 100) 
                    : 0;
                  return (
                    <TableRow key={dept.department_id} className="border-[#E6E6E4] dark:border-gray-700">
                      <TableCell className={`font-medium ${isRtl ? "text-right" : ""}`}>
                        {dept.department_name}
                      </TableCell>
                      <TableCell className="text-center">{dept.total}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-[#E6F7F1] text-[#0C5536]">
                          {dept.completed + dept.approved}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-100 text-blue-700">
                          {dept.submitted + dept.draft}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.overdue > 0 ? (
                          <Badge className="bg-red-100 text-red-700">{dept.overdue}</Badge>
                        ) : (
                          <span className="text-[#6B6B6B]">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={deptCompletionRate} className="w-16 h-2" />
                          <span className={`text-sm font-medium ${
                            deptCompletionRate >= 80 ? "text-[#0C5536]" :
                            deptCompletionRate >= 50 ? "text-[#C6A03B]" :
                            "text-red-600"
                          }`}>
                            {deptCompletionRate}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-[#6B6B6B]">
              {t("hr:reviews.noDataAvailable")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
