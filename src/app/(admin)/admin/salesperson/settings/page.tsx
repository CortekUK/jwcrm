"use client";

import { OutlookConnectionCard } from "@/components/integrations/OutlookConnectionCard";

export default function SalespersonSettings() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#222222]">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal integrations and preferences.
        </p>
      </div>
      <OutlookConnectionCard />
    </div>
  );
}
