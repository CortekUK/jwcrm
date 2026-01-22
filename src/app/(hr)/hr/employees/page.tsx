"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeTable, DeactivateModal } from "@/components/hr";

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_role: { name: string } | null;
  department: { name: string } | null;
  employment_status: string;
  start_date: string;
}

interface Department {
  id: string;
  name: string;
}

export default function EmployeesPage() {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deactivateEmployee, setDeactivateEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [empResult, deptResult] = await Promise.all([
        supabase
          .from("employees")
          .select(`
            id,
            full_name,
            email,
            phone,
            employment_status,
            start_date,
            job_role:job_roles(name),
            department:departments(name)
          `)
          .order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);

      if (empResult.data) setEmployees(empResult.data as Employee[]);
      if (deptResult.data) setDepartments(deptResult.data);
    } catch (error) {
      console.error("Error fetching data:", error);
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#222222]">{t("hr:employees")}</h1>
        <p className="text-[#6B6B6B]">{t("hr:employeesDescription")}</p>
      </div>

      <EmployeeTable
        employees={employees}
        departments={departments}
        onAddNew={() => router.push("/admin/hr/employees/new")}
        onEdit={(id) => router.push(`/admin/hr/employees/${id}/edit`)}
        onDeactivate={setDeactivateEmployee}
      />

      <DeactivateModal
        open={!!deactivateEmployee}
        onOpenChange={(open) => !open && setDeactivateEmployee(null)}
        employee={deactivateEmployee}
        onSuccess={fetchData}
      />
    </div>
  );
}
