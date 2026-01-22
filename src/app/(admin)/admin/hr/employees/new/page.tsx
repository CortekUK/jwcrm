"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ArrowLeft, UserPlus } from "lucide-react";
import { AddEmployeeForm } from "@/components/hr";

export default function NewEmployeePage() {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();

  const handleSuccess = (employeeId?: string) => {
    // Redirect to employee profile or list
    if (employeeId) {
      router.push(`/admin/hr/employees/${employeeId}`);
    } else {
      router.push("/admin/hr/employees");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4 text-[#6B6B6B] hover:text-[#222222] hover:bg-transparent"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t("hr:back")}
      </Button>

      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:addNewEmployee")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddEmployeeForm
            onSuccess={handleSuccess}
            onCancel={() => router.back()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
