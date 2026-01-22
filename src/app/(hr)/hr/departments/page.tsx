"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Building, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Department {
  id: string;
  name: string;
  created_at: string;
  employee_count?: number;
}

export default function DepartmentsPage() {
  const { t } = useTranslation(["hr", "toast"]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-[#222222] mb-6">{t("hr:manageDepartments")}</h1>

      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:departments")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Department */}
          <div className="space-y-2">
            <Label className="text-[#555555]">{t("hr:addNewDepartment")}</Label>
            <div className="flex gap-2">
              <Input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder={t("hr:enterDepartmentName")}
                className="border-[#E6E6E4]"
                onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
              />
              <Button
                onClick={handleAddDepartment}
                disabled={adding || !newDeptName.trim()}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Department List */}
          <div className="space-y-2">
            <Label className="text-[#555555]">{t("hr:existingDepartments")}</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--jw-primary-green))]" />
              </div>
            ) : departments.length === 0 ? (
              <p className="text-[#6B6B6B] text-center py-4">{t("hr:noDepartments")}</p>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]"
                  >
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-[#6B6B6B]" />
                      <div>
                        <p className="font-medium text-[#222222]">{dept.name}</p>
                        <p className="text-xs text-[#6B6B6B]">
                          {dept.employee_count || 0} {t("hr:employeesCount")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDepartment(dept)}
                      disabled={deletingId === dept.id || (dept.employee_count && dept.employee_count > 0)}
                      className={`${
                        dept.employee_count && dept.employee_count > 0
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-red-500 hover:text-red-600 hover:bg-red-50"
                      }`}
                    >
                      {deletingId === dept.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              {t("hr:departmentDeleteNote")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
