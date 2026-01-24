"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  Plane,
  Thermometer,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type LeaveType = Database["public"]["Enums"]["leave_type"];

interface PendingRequest {
  id: string;
  employee_name: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  created_at: string;
}

const getLeaveTypeConfig = (t: (key: string) => string): Record<LeaveType, { icon: any; color: string; label: string }> => ({
  annual: { icon: Plane, color: "text-blue-600", label: t("leaveBalances.annual") },
  sick: { icon: Thermometer, color: "text-yellow-600", label: t("leaveBalances.sick") },
  emergency: { icon: AlertCircle, color: "text-orange-600", label: t("leaveType.emergency") },
  unpaid: { icon: CalendarDays, color: "text-gray-600", label: t("leaveType.unpaid") },
});

interface LeaveSummaryWidgetProps {
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

export function LeaveSummaryWidget({ onApprove, onDeny }: LeaveSummaryWidgetProps) {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const leaveTypeConfig = getLeaveTypeConfig(t);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const { data } = await supabase
        .from("leave_requests")
        .select(`
          id,
          leave_type,
          start_date,
          end_date,
          total_days,
          created_at,
          employees!inner(full_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      const formatted: PendingRequest[] = (data || []).map((req: any) => ({
        id: req.id,
        employee_name: req.employees.full_name,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        created_at: req.created_at,
      }));

      setRequests(formatted);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: PendingRequest) => {
    setApprovingId(request.id);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      onApprove?.(request.id);
    } catch (error) {
      console.error("Error approving request:", error);
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg border border-[#E6E6E4]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-7 w-7 rounded" />
                  <Skeleton className="h-7 w-7 rounded" />
                </div>
              </div>
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
          <span className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-gold-accent))]/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
            </div>
            {t("leaveWidget.leaveRequests")}
          </span>
          {requests.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
              {requests.length} {t("leaveWidget.pending")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="text-center py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-[#222222] font-medium mb-1">{t("leaveWidget.noPendingRequests")}</p>
            <p className="text-sm text-[#6B6B6B]">{t("leaveWidget.allCaughtUp")}</p>
          </div>
        ) : (
          <>
            {requests.slice(0, 3).map((request) => {
              const config = leaveTypeConfig[request.leave_type];
              const Icon = config.icon;
              const isToday =
                request.start_date === format(new Date(), "yyyy-MM-dd") ||
                differenceInDays(new Date(request.start_date), new Date()) <= 1;

              return (
                <div
                  key={request.id}
                  className={`p-3 rounded-lg border ${isToday ? "border-orange-200 bg-orange-50" : "border-[#E6E6E4] bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-[#6B6B6B]" />
                        <span className="font-medium text-[#222222] truncate">{request.employee_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
                        <Icon className={`h-3 w-3 ${config.color}`} />
                        <span>{config.label}</span>
                        <span>|</span>
                        <span>
                          {format(new Date(request.start_date), "MMM d")} -{" "}
                          {format(new Date(request.end_date), "MMM d")}
                        </span>
                        <span className="font-medium">({request.total_days}d)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => router.push("/admin/hr/leave")}
                            disabled={approvingId === request.id}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("leaveWidget.deny")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(request)}
                            disabled={approvingId !== null}
                          >
                            {approvingId === request.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("leaveWidget.approve")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}

            {requests.length > 3 && (
              <p className="text-xs text-center text-[#6B6B6B]">+{requests.length - 3} {t("leaveWidget.moreRequests")}</p>
            )}
          </>
        )}

        <Button
          variant="outline"
          className="w-full border-[#E6E6E4] hover:bg-[#FAFAF8]"
          onClick={() => router.push("/admin/hr/leave")}
        >
          <CalendarDays className="h-4 w-4 mr-2 text-[hsl(var(--jw-primary-green))]" />
          {requests.length > 0 ? t("leaveWidget.viewAllRequests") : t("leaveWidget.manageLeave")}
        </Button>
      </CardContent>
    </Card>
  );
}
