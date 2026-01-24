"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
      router.push(`/hr/employees/${employeeId}`);
    } else {
      router.push("/hr/employees");
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 -ml-2 text-[#6B6B6B] hover:text-[#222222] hover:bg-[hsl(var(--jw-gold-accent))]/10"
        >
          <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("hr:back")}
        </Button>
        <div className="flex items-center gap-3 mb-2">
          <UserPlus className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
          <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {t("hr:addNewEmployee")}
          </h1>
        </div>
        <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
          {t("hr:addNewEmployeeDescription")}
        </p>
      </div>

      {/* Form Card */}
      <div className="max-w-4xl mx-auto px-2">
        <Card className="border-[#E6E6E4] shadow-sm">
          <CardContent className="p-6">
            <AddEmployeeForm
              onSuccess={handleSuccess}
              onCancel={() => router.back()}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
