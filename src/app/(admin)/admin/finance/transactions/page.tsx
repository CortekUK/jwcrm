"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinanceTransactionsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main finance dashboard with transactions tab
    router.replace("/admin/finance?tab=transactions");
  }, [router]);

  return (
    <div className="container mx-auto py-6 flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
