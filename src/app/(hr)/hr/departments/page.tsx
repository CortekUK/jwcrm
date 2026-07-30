"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Building2, Plus, Trash2, Loader2, AlertCircle, Users, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";

interface Department {
  id: string;
  name: string;
  created_at: string;
  employee_count?: number;
}

interface DepartmentEmployee {
  id: string;
  full_name: string;
  email: string | null;
  employment_status: string;
  job_role: { name: string } | null;
}

export default function DepartmentsPage() {
  const { t } = useTranslation(["hr", "toast"]);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { canPerform } = usePermissions();
  // This page is also rendered by the admin wrapper at
  // /admin/hr/departments. Hardcoding /hr/... sent admins into the (hr) route
  // group, whose ProtectedRoute bounced them straight back out.
  const basePath = pathname?.startsWith("/admin") ? "/admin/hr" : "/hr";
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Dialog state for viewing employees
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentEmployees, setDepartmentEmployees] = useState<DepartmentEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Check if user can delete departments (head-only operation for HR)
  const canDeleteDepartment = canPerform("hr", "delete_department");

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data: depts, error: deptError } = await supabase
        .from("departments")
        .select("id, name, created_at")
        .order("name");

      if (deptError) throw deptError;

      const { data: counts, error: countError } = await supabase
        .from("employees")
        .select("department_id")
        .not("department_id", "is", null);

      if (countError) throw countError;

      const countMap: Record<string, number> = {};
      counts?.forEach((emp) => {
        if (emp.department_id) {
          countMap[emp.department_id] = (countMap[emp.department_id] || 0) + 1;
        }
      });

      const deptsWithCounts = depts?.map((d) => ({
        ...d,
        employee_count: countMap[d.id] || 0,
      })) || [];

      setDepartments(deptsWithCounts);
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentEmployees = async (departmentId: string) => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, email, employment_status, job_role:job_roles(name)")
        .eq("department_id", departmentId)
        .order("full_name");

      if (error) throw error;
      setDepartmentEmployees(data || []);
    } catch (error) {
      console.error("Error fetching department employees:", error);
      setDepartmentEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleOpenDepartmentDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    fetchDepartmentEmployees(dept.id);
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from("departments")
        .insert({ name: newDeptName.trim() });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: t("toast:error"),
            description: t("hr:departmentExists"),
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: t("toast:success"),
        description: t("hr:departmentAdded"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      setNewDeptName("");
      fetchDepartments();
    } catch (error: any) {
      console.error("Error adding department:", error);
      toast({
        title: t("toast:error"),
        description: error.message || t("hr:errorAddingDepartment"),
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteDepartment = async (dept: Department) => {
    if (dept.employee_count && dept.employee_count > 0) {
      toast({
        title: t("toast:error"),
        description: t("hr:cannotDeleteDepartment"),
        variant: "destructive",
      });
      return;
    }

    setDeletingId(dept.id);
    try {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", dept.id);

      if (error) throw error;

      toast({
        title: t("toast:success"),
        description: t("hr:departmentDeleted"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      fetchDepartments();
    } catch (error: any) {
      console.error("Error deleting department:", error);
      toast({
        title: t("toast:error"),
        description: error.message || t("hr:errorDeletingDepartment"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Helper function for singular/plural employee text
  const getEmployeeText = (count: number) => {
    if (count === 1) {
      return `1 ${t("hr:employee")}`;
    }
    return `${count} ${t("hr:employeesCount")}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:departments")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("hr:manageDepartmentsDescription")}
            </p>
          </div>
          {!loading && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
              <Building2 className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
              <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
                {departments.length} {departments.length === 1 ? t("hr:department") : t("hr:departmentsCount")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-[#E6E6E4] shadow-sm">
          <CardContent className="p-6 space-y-6">
            {/* Add New Department */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E6E6E4]">
                <Plus className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <h3 className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:addNewDepartment")}
                </h3>
              </div>
              <div className="flex gap-3">
                <Input
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder={t("hr:enterDepartmentName")}
                  className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                  onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
                />
                <Button
                  onClick={handleAddDepartment}
                  disabled={adding || !newDeptName.trim()}
                  className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white px-5"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                      {t("hr:add")}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Department List */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E6E6E4]">
                <Building2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <h3 className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:existingDepartments")}
                </h3>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--jw-primary-green))]" />
                </div>
              ) : departments.length === 0 ? (
                <div className="text-center py-8 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
                  <Building2 className="h-8 w-8 text-[#C6A03B] mx-auto mb-2" />
                  <p className="text-[#6B6B6B]">{t("hr:noDepartments")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-4 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4] hover:border-[#C6A03B] transition-colors group"
                    >
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => handleOpenDepartmentDialog(dept)}
                      >
                        <p className="font-medium text-[#222222] group-hover:text-[hsl(var(--jw-primary-green))] transition-colors">{dept.name}</p>
                        <p className="text-xs text-[#6B6B6B]">
                          {getEmployeeText(dept.employee_count || 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {dept.employee_count && dept.employee_count > 0 && (
                          <ChevronRight 
                            className="h-4 w-4 text-[#6B6B6B] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            onClick={() => handleOpenDepartmentDialog(dept)}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDepartment(dept);
                          }}
                          disabled={deletingId === dept.id || (dept.employee_count && dept.employee_count > 0)}
                          className={`${
                            dept.employee_count && dept.employee_count > 0
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-[#6B6B6B] hover:text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {deletingId === dept.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                {t("hr:departmentDeleteNote")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>

      {/* Department Employees Dialog */}
      <Dialog 
        open={!!selectedDepartment} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDepartment(null);
            setDepartmentEmployees([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <span>{selectedDepartment?.name}</span>
            </DialogTitle>
            <p className="text-sm text-[#6B6B6B]">
              {selectedDepartment && getEmployeeText(selectedDepartment.employee_count || 0)}
            </p>
          </DialogHeader>
          
          <div className="mt-4">
            {loadingEmployees ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--jw-primary-green))]" />
              </div>
            ) : departmentEmployees.length === 0 ? (
              <div className="text-center py-8 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
                <Users className="h-8 w-8 text-[#C6A03B] mx-auto mb-2" />
                <p className="text-[#6B6B6B]">{t("hr:noEmployeesInDepartment")}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {departmentEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => router.push(`${basePath}/employees/${employee.id}`)}
                    className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#F5F5F3] transition-colors cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#222222] group-hover:text-[hsl(var(--jw-primary-green))] transition-colors truncate">
                        {employee.full_name}
                      </p>
                      <p className="text-xs text-[#6B6B6B] truncate">
                        {employee.job_role?.name || t("hr:noJobRole")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ltr:ml-3 rtl:mr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        employee.employment_status === "active" 
                          ? "bg-green-100 text-green-700"
                          : employee.employment_status === "on_leave"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {t(`hr:status.${employee.employment_status}`)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#6B6B6B] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
