"use client";

// Salesperson lead detail was merged into the unified lead-management detail
// page. This route forwards bookmarks / emailed links to the canonical URL.

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SalespersonLeadDetailRedirect({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/lead-management/leads/${leadId}`);
  }, [router, leadId]);
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
