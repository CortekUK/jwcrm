"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Loader2, Users } from "lucide-react";
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
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
          <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {t("hr:employees")}
          </h1>
        </div>
        <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
          {t("hr:employeesDescription")}
        </p>
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
