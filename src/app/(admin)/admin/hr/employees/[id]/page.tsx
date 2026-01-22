"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeProfile } from "@/components/hr";

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
  const defaultTab = searchParams.get("tab") === "documents" ? "documents" : "details";

  const employeeId = params.id as string;

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId]);

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
    <div className="p-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push("/admin/hr/employees")}
        className="mb-4 text-[#6B6B6B] hover:text-[#222222] hover:bg-transparent"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t("hr:backToEmployees")}
      </Button>

      <EmployeeProfile
        employee={employee}
        documents={documents}
        archivedDocuments={archivedDocuments}
        onRefresh={fetchData}
        defaultTab={defaultTab}
      />
    </div>
  );
}
