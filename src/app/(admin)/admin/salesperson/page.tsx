"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SalespersonDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/salesperson/leads");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C5536]" />
    </div>
  );
}
