"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileWarning, CalendarDays, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface NotificationItem {
  type: "document" | "leave" | "review";
  title: string;
  description: string;
  link?: string;
  createdAt: string;
  urgency: "critical" | "warning";
}

interface HRNotificationsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NotificationItem[];
  isLoading: boolean;
}

function NotificationItemCard({ item }: { item: NotificationItem }) {
  const icons = {
    document: FileWarning,
    leave: CalendarDays,
    review: ClipboardCheck,
  };

  const Icon = icons[item.type];

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        item.urgency === "critical"
          ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30",
        item.link && "hover:bg-opacity-80 cursor-pointer"
      )}
    >
      <div
        className={cn(
          "mt-0.5 rounded-md p-1.5",
          item.urgency === "critical"
            ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
            : "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {new Date(item.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  if (item.link) {
    return <Link href={item.link}>{content}</Link>;
  }

  return content;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function HRNotificationsPanel({
  open,
  onOpenChange,
  items,
  isLoading,
}: HRNotificationsPanelProps) {
  const [activeTab, setActiveTab] = useState("all");

  const documentItems = items.filter((i) => i.type === "document");
  const leaveItems = items.filter((i) => i.type === "leave");
  const reviewItems = items.filter((i) => i.type === "review");

  const renderItems = (filteredItems: NotificationItem[], emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filteredItems.length === 0) {
      return <EmptyState message={emptyMessage} />;
    }

    return (
      <div className="space-y-2">
        {filteredItems.map((item, idx) => (
          <NotificationItemCard key={`${item.type}-${idx}`} item={item} />
        ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>HR Notifications</SheetTitle>
          <SheetDescription>
            Expiring documents, pending leave requests, and overdue reviews
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="relative text-xs">
                All
                {items.length > 0 && (
                  <span className="ltr:ml-1 rtl:mr-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {items.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="documents" className="relative text-xs">
                Docs
                {documentItems.length > 0 && (
                  <span className="ltr:ml-1 rtl:mr-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {documentItems.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="leave" className="relative text-xs">
                Leave
                {leaveItems.length > 0 && (
                  <span className="ltr:ml-1 rtl:mr-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                    {leaveItems.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="reviews" className="relative text-xs">
                Reviews
                {reviewItems.length > 0 && (
                  <span className="ltr:ml-1 rtl:mr-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {reviewItems.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {renderItems(items, "No notifications")}
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              {renderItems(documentItems, "No expiring documents")}
            </TabsContent>

            <TabsContent value="leave" className="mt-4">
              {renderItems(leaveItems, "No pending leave requests")}
            </TabsContent>

            <TabsContent value="reviews" className="mt-4">
              {renderItems(reviewItems, "No overdue reviews")}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
