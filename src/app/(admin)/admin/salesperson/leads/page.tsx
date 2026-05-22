"use client";

// Salesperson leads were merged into the unified lead-management pipeline.
// This route now just forwards to /admin/lead-management/leads, where RLS
// scopes the salesperson to leads assigned to them.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SalespersonLeadsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/lead-management/leads");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
