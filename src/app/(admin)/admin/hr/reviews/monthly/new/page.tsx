"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ArrowLeft, 
  CalendarDays, 
  Search,
  User,
  Briefcase,
  Loader2
} from "lucide-react";
import { MonthlyReviewForm } from "@/components/hr/reviews";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  job_role: {
    id: string;
    name: string;
  } | null;
};

export default function AdminNewMonthlyReviewPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Fetch active employees
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("employees")
          .select(`
            id,
            full_name,
            email,
            job_title,
            department:departments(id, name),
            job_role:job_roles(id, name)
          `)
          .eq("employment_status", "active")
          .order("full_name");

        if (error) throw error;
        setEmployees(data as Employee[]);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Filter employees by search term
  const filteredEmployees = employees.filter((emp) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(search) ||
      emp.email?.toLowerCase().includes(search) ||
      emp.job_title?.toLowerCase().includes(search) ||
      emp.department?.name.toLowerCase().includes(search)
    );
  });

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedEmployee(null)}
            className="text-[#6B6B6B]"
          >
            <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
          <div className={isRtl ? "text-right" : ""}>
            <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("hr:reviews.createMonthlyReview", "Create Monthly Review")}
            </h1>
            <p className="text-sm text-[#777777]">
              {t("hr:reviews.reviewingEmployee", "Reviewing Employee")}: {selectedEmployee.full_name}
            </p>
          </div>
        </div>

        {/* Monthly Review Form */}
        <MonthlyReviewForm
          employee={selectedEmployee}
          onSuccess={() => router.push("/admin/hr/reviews/monthly")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/hr/reviews/monthly")}
            className="text-[#6B6B6B] hover:text-[#0C5536]"
          >
            <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
          <div className={isRtl ? "text-right" : ""}>
            <div className={`flex items-center gap-3 mb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <CalendarDays className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:reviews.createMonthlyReview", "Create Monthly Review")}
              </h1>
            </div>
            <p className={`text-sm text-[#777777] ${isRtl ? "mr-9" : "ml-9"}`}>
              {t("hr:reviews.selectEmployeeToReview")}
            </p>
          </div>
        </div>
      </div>

      {/* Employee Selection */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-lg">{t("hr:reviews.selectEmployee")}</CardTitle>
          <CardDescription>
            {t("hr:reviews.selectEmployeeMonthlyDesc", "Choose an employee to create their monthly performance review")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-6">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B] ${isRtl ? "right-3" : "left-3"}`} />
            <Input
              placeholder={t("hr:reviews.searchEmployees")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`border-[#E6E6E4] ${isRtl ? "pr-10 text-right" : "pl-10"}`}
            />
          </div>

          {/* Employee List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#0C5536]" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
              <p className="text-[#6B6B6B]">{t("hr:reviews.noEmployeesFound")}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => setSelectedEmployee(employee)}
                  className={`w-full p-4 rounded-lg border border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all text-left ${isRtl ? "text-right" : ""}`}
                >
                  <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-[#0C5536]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#222222] truncate">
                        {employee.full_name}
                      </p>
                      <div className={`flex items-center gap-2 text-sm text-[#6B6B6B] ${isRtl ? "flex-row-reverse" : ""}`}>
                        {employee.job_title && (
                          <span className="truncate">{employee.job_title}</span>
                        )}
                        {employee.job_title && employee.department?.name && (
                          <span>•</span>
                        )}
                        {employee.department?.name && (
                          <span className="truncate flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {employee.department.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowLeft className={`h-5 w-5 text-[#C6A03B] ${isRtl ? "" : "rotate-180"}`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
