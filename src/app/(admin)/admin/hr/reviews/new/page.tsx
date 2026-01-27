"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { QuarterlyReviewForm } from "@/components/hr/reviews";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

export default function AdminNewQuarterlyReviewPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch employees
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
        setEmployees((data || []) as Employee[]);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(searchLower) ||
      emp.job_title?.toLowerCase().includes(searchLower) ||
      emp.department?.name?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/hr/reviews")}
          className="text-[#6B6B6B]"
        >
          <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
        </Button>
        <div className={isRtl ? "text-right" : ""}>
          <h1 className="text-2xl font-bold text-[#222222] dark:text-gray-100">
            {t("hr:reviews.createReview")}
          </h1>
          <p className="text-[#6B6B6B] dark:text-gray-400 mt-1">
            {t("hr:reviews.selectEmployeeToReview")}
          </p>
        </div>
      </div>

      {/* Employee Selection */}
      {!selectedEmployee ? (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <User className="h-5 w-5 text-[#C6A03B]" />
              {t("hr:reviews.selectEmployee")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B] ${isRtl ? "right-3" : "left-3"}`} />
              <Input
                placeholder={t("hr:reviews.searchEmployees")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`border-[#E6E6E4] dark:border-gray-600 ${isRtl ? "pr-10 text-right" : "pl-10"}`}
              />
            </div>

            {/* Employee List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  onClick={() => setSelectedEmployee(employee)}
                  className="p-4 border border-[#E6E6E4] dark:border-gray-700 rounded-lg cursor-pointer hover:bg-[#FAFAF8] dark:hover:bg-gray-800 transition-colors"
                >
                  <div className={`flex items-start gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <div className="w-10 h-10 bg-[#0C5536] rounded-full flex items-center justify-center text-white font-medium">
                      {employee.full_name.charAt(0)}
                    </div>
                    <div className={`flex-1 min-w-0 ${isRtl ? "text-right" : ""}`}>
                      <p className="font-medium text-[#222222] dark:text-gray-200 truncate">
                        {employee.full_name}
                      </p>
                      {employee.job_title && (
                        <p className="text-sm text-[#6B6B6B] dark:text-gray-400 truncate">
                          {employee.job_title}
                        </p>
                      )}
                      {employee.department?.name && (
                        <p className="text-xs text-[#6B6B6B] dark:text-gray-500">
                          {employee.department.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredEmployees.length === 0 && (
              <div className="text-center py-8 text-[#6B6B6B] dark:text-gray-400">
                {t("hr:reviews.noEmployeesFound")}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Selected Employee Indicator */}
          <div className={`flex items-center gap-4 p-4 bg-[#E6F7F1] dark:bg-green-900/30 rounded-lg ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="w-10 h-10 bg-[#0C5536] rounded-full flex items-center justify-center text-white font-medium">
              {selectedEmployee.full_name.charAt(0)}
            </div>
            <div className={`flex-1 ${isRtl ? "text-right" : ""}`}>
              <p className="font-medium text-[#0C5536] dark:text-green-400">
                {t("hr:reviews.reviewingEmployee")}
              </p>
              <p className="text-[#222222] dark:text-gray-200">
                {selectedEmployee.full_name}
                {selectedEmployee.job_title && ` - ${selectedEmployee.job_title}`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployee(null)}
              className="border-[#0C5536] text-[#0C5536]"
            >
              {t("common:change")}
            </Button>
          </div>

          {/* Review Form */}
          <QuarterlyReviewForm
            employee={selectedEmployee}
            onSuccess={() => router.push("/admin/hr/reviews")}
          />
        </>
      )}
    </div>
  );
}
