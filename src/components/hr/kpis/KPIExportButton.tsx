"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Target } from "lucide-react";
import { BulkDownloadKPIReportsButton } from "./BulkDownloadKPIReportsButton";

type Employee = {
  id: string;
  full_name: string;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

/**
 * Standalone KPI Export Button for use in Reports page
 * Fetches employees and provides year/month selection before showing bulk download dialog
 */
export function KPIExportButton() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Period selection
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);

  // Generate year options (current year and 2 previous years)
  const yearOptions = [
    currentDate.getFullYear(),
    currentDate.getFullYear() - 1,
    currentDate.getFullYear() - 2,
  ];

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1).toLocaleString(
      i18n.language === "ar" ? "ar-EG" : "en-US",
      { month: "long" }
    ),
  }));

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          job_role_id,
          job_roles (
            id,
            name
          )
        `)
        .eq("employment_status", "active")
        .order("full_name");

      if (error) throw error;

      // Transform the data to match the expected Employee type
      const transformedEmployees: Employee[] = (data || []).map((emp: any) => ({
        id: emp.id,
        full_name: emp.full_name,
        job_role: emp.job_roles ? {
          id: emp.job_roles.id,
          name: emp.job_roles.name,
        } : null,
      }));

      setEmployees(transformedEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const employeesWithJobRoles = employees.filter((e) => e.job_role?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
        >
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("hr:reports.exportKPIs", "Export KPI Reports")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Target className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:reports.kpiReport", "KPI Reports")}
          </DialogTitle>
          <DialogDescription className={isRtl ? "text-right" : ""}>
            {t("hr:reports.kpiExportDesc", "Select a period and generate KPI reports for employees")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--jw-gold-accent))]" />
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Period Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("hr:year", "Year")}</Label>
                <Select
                  value={year.toString()}
                  onValueChange={(v) => setYear(parseInt(v))}
                >
                  <SelectTrigger className="border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("hr:month", "Month")}</Label>
                <Select
                  value={month.toString()}
                  onValueChange={(v) => setMonth(parseInt(v))}
                >
                  <SelectTrigger className="border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E6E6E4]">
              <p className="text-sm text-[#555555]">
                {t("hr:reports.kpiExportInfo", "{{count}} employees with assigned job roles available for KPI export.", {
                  count: employeesWithJobRoles.length,
                })}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className={`gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-[#E6E6E4]"
          >
            {t("common:cancel", "Cancel")}
          </Button>
          {!loading && employeesWithJobRoles.length > 0 && (
            <BulkDownloadKPIReportsButton
              employees={employees}
              year={year}
              month={month}
            />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
