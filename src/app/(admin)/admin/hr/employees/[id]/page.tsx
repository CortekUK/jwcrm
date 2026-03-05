"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Edit, UserX, ClipboardList, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeProfile } from "@/components/hr";
import { DeactivateModal } from "@/components/hr/DeactivateModal";

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  job_role: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  start_date: string;
  salary: number | null;
  employment_status: string;
  termination_reason: string | null;
  last_working_day: string | null;
  created_at: string;
}

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  document_path: string;
  expiry_date: string | null;
  uploaded_at: string;
  is_active?: boolean;
  archived_at?: string | null;
}

export default function EmployeeProfilePage() {
  const { t } = useTranslation(["hr"]);
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [archivedDocuments, setArchivedDocuments] = useState<Document[]>([]);

  // Check if we should open documents tab (after creating employee)
  const tabParam = searchParams.get("tab");
  const defaultTab = tabParam === "documents" ? "documents" : tabParam === "custom-kpis" ? "custom-kpis" : "details";
  const [showDeactivate, setShowDeactivate] = useState(false);

  const employeeId = params.id as string;

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId]);

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      active: "bg-[#E6F7F1] text-[#0C5536] border-[#0C5536]/20",
      inactive: "bg-gray-100 text-gray-600 border-gray-300",
      on_leave: "bg-[#FFF9E6] text-[#C6A03B] border-[#C6A03B]/20",
      terminated: "bg-red-50 text-red-600 border-red-200",
    };

    const statusLabels: Record<string, string> = {
      active: t("hr:status.active"),
      inactive: t("hr:status.inactive"),
      on_leave: t("hr:status.on_leave"),
      terminated: t("hr:status.terminated"),
    };

    return (
      <Badge variant="outline" className={statusStyles[status] || statusStyles.inactive}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const fetchData = async (retryCount = 0) => {
    setLoading(true);
    try {
      // Fetch employee data
      const empResult = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          email,
          phone,
          date_of_birth,
          start_date,
          salary,
          employment_status,
          termination_reason,
          last_working_day,
          created_at,
          job_role:job_roles(id, name),
          department:departments(id, name)
        `)
        .eq("id", employeeId)
        .single();

      // If not found and we have retries left (handles race condition after create)
      if (empResult.error && retryCount < 3) {
        console.log(`Employee fetch retry ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return fetchData(retryCount + 1);
      }

      if (empResult.error) {
        console.error("Error fetching employee:", empResult.error);
        setEmployee(null);
        return;
      }

      setEmployee(empResult.data as Employee);

      // Fetch all documents (active and archived)
      const docsResult = await supabase
        .from("employee_documents")
        .select("id, document_type, document_name, document_path, expiry_date, uploaded_at, is_active, archived_at")
        .eq("employee_id", employeeId)
        .order("uploaded_at", { ascending: false });

      if (docsResult.data) {
        // Separate active and archived documents
        const active = docsResult.data.filter(d => d.is_active === true);
        const archived = docsResult.data.filter(d => d.is_active === false);
        setDocuments(active);
        setArchivedDocuments(archived);
      }
    } catch (error) {
      console.error("Error fetching employee:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#6B6B6B]">{t("hr:employeeNotFound")}</p>
        <Button
          variant="outline"
          onClick={() => router.push("/admin/hr/employees")}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("hr:backToEmployees")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Back Link */}
      <div className="-mb-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => router.push("/admin/hr/employees")}
          className="text-[#777777] hover:text-[#222222] hover:bg-transparent px-0"
        >
          <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("hr:backToEmployees")}
        </Button>
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border border-[#E6E6E4] rounded-xl px-6 py-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Left: Avatar + Info */}
          <div className="flex items-center gap-4">
            {/* Polished Avatar with Ring */}
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-[hsl(var(--jw-primary-green))] flex items-center justify-center text-white text-2xl font-semibold ring-4 ring-[hsl(var(--jw-gold-accent))]/20 shadow-md">
                {employee.full_name.charAt(0).toUpperCase()}
              </div>
              {/* Status Indicator Dot */}
              {employee.employment_status === "active" && (
                <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
              )}
            </div>
            
            {/* Name, Role, Badge */}
            <div>
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {employee.full_name}
              </h1>
              <p className="text-sm text-[#777777] mt-0.5">
                {employee.job_role?.name || t("hr:noJobRole")}
                {employee.department?.name && (
                  <span className="text-[#C6A03B]"> · {employee.department.name}</span>
                )}
              </p>
              <div className="mt-2">
                {getStatusBadge(employee.employment_status)}
              </div>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/hr/attendance/employee/${employee.id}`)}
              className="border-[#E6E6E4] text-[#222222] hover:border-[hsl(var(--jw-primary-green))] hover:text-[hsl(var(--jw-primary-green))]"
            >
              <ClipboardList className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:viewAttendance")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/hr/kpis/evaluations/${employee.id}`)}
              className="border-[#E6E6E4] text-[#222222] hover:border-[hsl(var(--jw-gold-accent))] hover:text-[hsl(var(--jw-gold-accent))]"
            >
              <Target className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:viewKPIs")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/hr/employees/${employee.id}/edit`)}
              className="border-[#E6E6E4] text-[#222222] hover:border-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/5"
            >
              <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:edit")}
            </Button>
            {employee.employment_status === "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeactivate(true)}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <UserX className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("hr:deactivate")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <EmployeeProfile
        employee={employee}
        documents={documents}
        archivedDocuments={archivedDocuments}
        onRefresh={fetchData}
        defaultTab={defaultTab}
      />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>

      {/* Deactivate Modal */}
      <DeactivateModal
        open={showDeactivate}
        onOpenChange={setShowDeactivate}
        employee={employee}
        onSuccess={fetchData}
      />
    </div>
  );
}
