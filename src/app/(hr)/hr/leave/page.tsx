"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  AlertCircle,
  Wallet,
  User,
  Calendar,
  Search,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileText,
  Paperclip,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, isWeekend, eachDayOfInterval, isSaturday, isSunday } from "date-fns";
import { Database } from "@/integrations/supabase/types";
import { ExportLeaveModal } from "@/components/hr/leave/ExportLeaveModal";
import { useLeaveTypes } from "@/hooks/useLeaveTypes";
import { getLeaveTypeIcon } from "@/lib/leave-type-icons";
import {
  openLeaveCertificate,
  uploadLeaveCertificate,
} from "@/lib/hr/leaveAttachmentClient";
import {
  LEAVE_ATTACHMENT_ACCEPT,
  validateLeaveAttachment,
} from "@/lib/hr/leaveAttachments";
import {
  applyLeaveBalanceChange,
  fetchEmployeeLeaveBalances,
} from "@/lib/hr/leaveBalances";
import {
  APPROVER_ROLE_LABELS,
  ApprovalActorContext,
  ApproverRole,
  EMPTY_ACTOR_CONTEXT,
  LeaveApprovalRule,
  authorizeStep,
  buildApprovalActorContext,
  chainForRule,
  fetchActiveApprovalRules,
  initializeApprovalWorkflow,
  recordApprovalDecision,
} from "@/lib/hr/leaveApproval";

type LeaveRequestStatus = Database["public"]["Enums"]["leave_request_status"];

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  created_at: string;
  leave_balance?: number;
  // Multi-step approval. NULL rule id = created before multi-step approval
  // existed, so it is treated as a single step and behaves exactly as before.
  approval_rule_id: string | null;
  current_approval_step: number;
  total_approval_steps: number;
  /** Storage path of the medical/leave certificate, if one was attached. */
  attachment_path: string | null;
}

interface Employee {
  id: string;
  full_name: string;
}

interface AttendanceConflict {
  date: string;
  status: string;
}

// Calculate working days (excluding Fri-Sat)
function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) return 0;

  const days = eachDayOfInterval({ start, end });
  return days.filter((day) => !isSaturday(day) && !isSunday(day)).length;
}

// Send leave notification email
async function sendLeaveNotification(params: {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: "approved" | "denied";
  denialReason?: string;
  remainingBalance?: number;
  approverName?: string;
}) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      console.error("No auth token for email notification");
      return;
    }

    const response = await fetch("/api/hr/leave/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to send leave notification:", errorData);
    } else {
      console.log("Leave notification sent successfully");
    }
  } catch (error) {
    console.error("Error sending leave notification:", error);
  }
}

export default function LeavePage() {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { leaveTypes: leaveTypesList, getBySlug } = useLeaveTypes();

  const getConfig = (slug: string) => {
    const lt = getBySlug(slug);
    return lt ? {
      icon: getLeaveTypeIcon(lt.icon_name),
      color: lt.color_class,
      label: lt.name,
    } : {
      icon: Calendar,
      color: "text-gray-600",
      label: slug,
    };
  };

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("all");

  // Sorting state
  type SortColumn = "employee" | "type" | "dates" | "days" | "status" | "submitted";
  const [sortColumn, setSortColumn] = useState<SortColumn>("submitted");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 text-[#999999]" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 text-[#C6A03B]" /> 
      : <ArrowDown className="h-3 w-3 text-[#C6A03B]" />;
  };

  // New request dialog
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deny dialog
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [denialReason, setDenialReason] = useState("");

  // Conflict dialog
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictRequest, setConflictRequest] = useState<LeaveRequest | null>(null);
  const [conflicts, setConflicts] = useState<AttendanceConflict[]>([]);

  // Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Leave certificates. One hidden file input is shared by every row; the row
  // that opened it is remembered in certificateTargetId.
  const certificateInputRef = useRef<HTMLInputElement>(null);
  const [certificateTargetId, setCertificateTargetId] = useState<string | null>(null);
  const [uploadingCertificateId, setUploadingCertificateId] = useState<string | null>(null);

  // Multi-step approval: the active rules and everything needed to decide
  // whether the signed-in user may act at a request's current step.
  const [approvalRules, setApprovalRules] = useState<LeaveApprovalRule[]>([]);
  const [actorContext, setActorContext] = useState<ApprovalActorContext>(EMPTY_ACTOR_CONTEXT);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all leave requests with employee names (not just pending)
      const { data: requestsData } = await supabase
        .from("leave_requests")
        .select(`
          *,
          employees!inner(full_name)
        `)
        .order("created_at", { ascending: false });

      const formattedRequests: LeaveRequest[] = (requestsData || []).map((req: any) => ({
        id: req.id,
        employee_id: req.employee_id,
        employee_name: req.employees.full_name,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        approval_rule_id: req.approval_rule_id ?? null,
        current_approval_step: req.current_approval_step || 1,
        total_approval_steps: req.total_approval_steps || 1,
        attachment_path: req.attachment_path ?? null,
      }));

      setRequests(formattedRequests);

      // Approval chain configuration + who the current user may act as.
      const [rules, ctx] = await Promise.all([
        fetchActiveApprovalRules(),
        buildApprovalActorContext(),
      ]);
      setApprovalRules(rules);
      setActorContext(ctx);

      // Fetch employees for new request form
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("employment_status", "active")
        .order("full_name");

      setEmployees(employeesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToFetch"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  // Filter requests based on current filters
  const filteredRequests = requests.filter((request) => {
    // Status filter
    if (statusFilter !== "all" && request.status !== statusFilter) {
      return false;
    }

    // Leave type filter
    if (leaveTypeFilter !== "all" && request.leave_type !== leaveTypeFilter) {
      return false;
    }

    // Search filter (employee name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!request.employee_name.toLowerCase().includes(query)) {
        return false;
      }
    }

    return true;
  });

  // Sort requests
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    let comparison = 0;
    
    switch (sortColumn) {
      case "employee":
        comparison = a.employee_name.localeCompare(b.employee_name);
        break;
      case "type":
        comparison = a.leave_type.localeCompare(b.leave_type);
        break;
      case "dates":
        comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        break;
      case "days":
        comparison = a.total_days - b.total_days;
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      case "submitted":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Get pending count for badge
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // Which approver role is a request waiting on, and may the signed-in user act
  // at that step (in their own right, or as somebody's active delegate)?
  // Requests with no persisted rule predate multi-step approval and stay
  // single-step, so nothing already in flight changes behaviour.
  const getApprovalInfo = (request: LeaveRequest) => {
    const rule = request.approval_rule_id
      ? approvalRules.find((r) => r.id === request.approval_rule_id) ?? null
      : null;
    const chain = request.approval_rule_id ? chainForRule(rule) : [];
    const effectiveChain: ApproverRole[] = chain.length > 0 ? chain : ["hr"];
    const totalSteps = request.approval_rule_id
      ? Math.max(1, request.total_approval_steps || effectiveChain.length)
      : 1;
    const currentStep = Math.min(Math.max(1, request.current_approval_step), totalSteps);
    const currentRole: ApproverRole = effectiveChain[currentStep - 1] ?? "hr";

    const auth = authorizeStep(actorContext, {
      role: currentRole,
      employeeId: request.employee_id,
      leaveType: request.leave_type,
      totalDays: request.total_days,
    });

    const roleLabel = t(`leavePage.approver_${currentRole}`, APPROVER_ROLE_LABELS[currentRole]);
    const label =
      totalSteps > 1
        ? t("leavePage.awaitingStep", "Awaiting {{role}} — step {{step}} of {{total}}", {
            role: roleLabel,
            step: currentStep,
            total: totalSteps,
          })
        : t("leavePage.awaitingRole", "Awaiting {{role}}", { role: roleLabel });

    return { currentRole, currentStep, totalSteps, auth, label, chain: effectiveChain };
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open new request dialog if action=new in URL
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new") {
      setNewRequestOpen(true);
      // Clear the action parameter from URL without navigation
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams]);

  // Check for attendance conflicts before approving
  const checkAttendanceConflicts = async (request: LeaveRequest): Promise<AttendanceConflict[]> => {
    const days = eachDayOfInterval({
      start: new Date(request.start_date),
      end: new Date(request.end_date),
    }).filter((day) => !isSaturday(day) && !isSunday(day));

    const dateStrings = days.map((day) => format(day, "yyyy-MM-dd"));

    const { data: existingAttendance } = await supabase
      .from("attendance")
      .select("date, status")
      .eq("employee_id", request.employee_id)
      .in("date", dateStrings);

    // Filter to only conflicts (not already on_leave or sick_leave)
    const conflictingRecords = (existingAttendance || []).filter(
      (a) => a.status !== "on_leave" && a.status !== "sick_leave"
    );

    return conflictingRecords.map((a) => ({
      date: a.date,
      status: a.status,
    }));
  };

  // Execute the actual approval (called after conflict check).
  //
  // Multi-step: this records the caller's sign-off at the request's CURRENT
  // step. Everything below the `isFinal` guard — the balance deduction, the
  // attendance marking and the "approved" email — runs ONLY when that sign-off
  // was the last one required. An intermediate approval just advances the chain
  // and leaves the request pending.
  const executeApproval = async (request: LeaveRequest) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const decision = await recordApprovalDecision({
        request,
        action: "approved",
        preloadedRules: approvalRules,
      });

      if (decision.error) {
        toast({
          title: t("common.error"),
          description: decision.error.message,
          variant: "destructive",
        });
        fetchData();
        return;
      }

      if (!decision.isFinal) {
        const nextRole = decision.state?.chain[decision.nextStep - 1] ?? "hr";
        const nextLabel = t(`leavePage.approver_${nextRole}`, APPROVER_ROLE_LABELS[nextRole]);
        toast({
          title: t("leavePage.stepApproved", "Approval recorded"),
          description: t(
            "leavePage.stepApprovedDesc",
            "Sent to {{role}} for step {{step}} of {{total}}.",
            {
              role: nextLabel,
              step: decision.nextStep,
              total: decision.state?.totalSteps ?? request.total_approval_steps,
            },
          ),
        });
        fetchData();
        return;
      }

      // ---- Final approval only, from here down ----

      // Update leave balance.
      // Keyed by leave type SLUG via employee_leave_balances, so any leave type
      // can track a balance — not just the ones with hard-coded columns. The
      // helper dual-writes the legacy annual_*/sick_* columns.
      const year = new Date().getFullYear();
      const ltConfig = getBySlug(request.leave_type);

      if (ltConfig?.tracks_balance) {
        const { error: balanceError } = await applyLeaveBalanceChange({
          employeeId: request.employee_id,
          year,
          slug: request.leave_type,
          usedDelta: request.total_days,
          // Release the reservation this request was holding.
          pendingDelta: -request.total_days,
        });

        // Previously this failure was swallowed entirely. It is not a reason to
        // un-approve the request, but HR must be told the balance is stale.
        if (balanceError) {
          console.error("Error updating leave balance:", balanceError);
          toast({
            title: t("common.error"),
            description: t(
              "leavePage.balanceUpdateFailed",
              "Leave approved, but the balance could not be updated: {{message}}",
              { message: balanceError.message },
            ),
            variant: "destructive",
          });
        }
      }

      // Mark attendance as on_leave for those dates
      const days = eachDayOfInterval({
        start: new Date(request.start_date),
        end: new Date(request.end_date),
      }).filter((day) => !isSaturday(day) && !isSunday(day));

      const attendanceRecords = days.map((day) => ({
        employee_id: request.employee_id,
        date: format(day, "yyyy-MM-dd"),
        status: (request.leave_type === "sick" ? "sick_leave" : "on_leave") as Database["public"]["Enums"]["attendance_status"],
        marked_by: userData.user?.id,
      }));

      if (attendanceRecords.length > 0) {
        await supabase.from("attendance").upsert(attendanceRecords, {
          onConflict: "employee_id,date",
        });
      }

      toast({
        title: t("leavePage.leaveApproved"),
        description: t("leavePage.leaveApprovedDesc", { name: request.employee_name }),
      });

      // Send email notification (non-blocking)
      // Get employee email
      const { data: empData } = await supabase
        .from("employees")
        .select("email")
        .eq("id", request.employee_id)
        .single();

      // Get approver name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user?.id || "")
        .single();

      // Calculate remaining balance.
      // Note: this has always reported ANNUAL remaining regardless of the leave
      // type being approved. Left as-is deliberately so approval emails do not
      // change; only the data source moved to the shared helper.
      const { balances: updatedBalances } = await fetchEmployeeLeaveBalances(
        request.employee_id,
        year,
      );
      const updatedAnnual = updatedBalances.annual;

      const remaining = updatedAnnual
        ? updatedAnnual.entitled - updatedAnnual.used - updatedAnnual.pending
        : undefined;

      sendLeaveNotification({
        employeeName: request.employee_name,
        employeeEmail: empData?.email || "unknown@email.com",
        leaveType: request.leave_type,
        startDate: format(new Date(request.start_date), "MMM d, yyyy"),
        endDate: format(new Date(request.end_date), "MMM d, yyyy"),
        totalDays: request.total_days,
        status: "approved",
        remainingBalance: remaining,
        approverName: profileData?.full_name || undefined,
      });

      fetchData();
    } catch (error) {
      console.error("Error approving leave:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToApprove"),
        variant: "destructive",
      });
    }
  };

  // --- Leave certificates -------------------------------------------------
  // Attaching goes through /api/hr/leave/attachment (service role + HR check);
  // the private bucket is never touched from the browser.

  const handlePickCertificate = (requestId: string) => {
    setCertificateTargetId(requestId);
    certificateInputRef.current?.click();
  };

  const handleCertificateSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    const requestId = certificateTargetId;
    // Reset so re-picking the same file still fires onChange.
    event.target.value = "";
    setCertificateTargetId(null);
    if (!file || !requestId) return;

    const problem = validateLeaveAttachment(file);
    if (problem) {
      toast({
        title: t("common.error"),
        description: problem,
        variant: "destructive",
      });
      return;
    }

    setUploadingCertificateId(requestId);
    const failure = await uploadLeaveCertificate(requestId, file);
    setUploadingCertificateId(null);

    if (failure) {
      toast({
        title: t("common.error"),
        description: failure,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("common.success", "Success"),
      description: t("leavePage.certificateAttached", "Certificate attached."),
    });
    fetchData();
  };

  const handleViewCertificate = async (requestId: string) => {
    const failure = await openLeaveCertificate(requestId);
    if (failure) {
      toast({
        title: t("common.error"),
        description: failure,
        variant: "destructive",
      });
    }
  };

  // Main approve handler - checks conflicts first
  const handleApprove = async (request: LeaveRequest) => {
    try {
      const foundConflicts = await checkAttendanceConflicts(request);

      if (foundConflicts.length > 0) {
        // Show conflict dialog
        setConflictRequest(request);
        setConflicts(foundConflicts);
        setConflictDialogOpen(true);
      } else {
        // No conflicts, proceed with approval
        await executeApproval(request);
      }
    } catch (error) {
      console.error("Error checking conflicts:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToCheckConflicts"),
        variant: "destructive",
      });
    }
  };

  // Handle confirmation from conflict dialog
  const handleConfirmOverride = async () => {
    if (!conflictRequest) return;

    setConflictDialogOpen(false);
    await executeApproval(conflictRequest);
    setConflictRequest(null);
    setConflicts([]);
  };

  const handleDeny = async () => {
    if (!selectedRequest || !denialReason.trim()) {
      toast({
        title: t("common.error"),
        description: t("leavePage.provideReasonForDenial"),
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      // A denial at ANY step denies the whole request immediately — the engine
      // still verifies the caller may act at the current step, and records the
      // denial (with its reason) on the audit trail.
      const decision = await recordApprovalDecision({
        request: selectedRequest,
        action: "denied",
        comment: denialReason,
        preloadedRules: approvalRules,
      });

      if (decision.error) {
        toast({
          title: t("common.error"),
          description: decision.error.message,
          variant: "destructive",
        });
        fetchData();
        return;
      }

      // Release the pending reservation for any balance-tracking leave type.
      // (Previously annual-only, because annual_pending was the only column.)
      const denyConfig = getBySlug(selectedRequest.leave_type);
      if (denyConfig?.tracks_balance) {
        const { error: balanceError } = await applyLeaveBalanceChange({
          employeeId: selectedRequest.employee_id,
          year: new Date().getFullYear(),
          slug: selectedRequest.leave_type,
          pendingDelta: -selectedRequest.total_days,
        });

        if (balanceError) {
          console.error("Error releasing pending leave balance:", balanceError);
          toast({
            title: t("common.error"),
            description: t(
              "leavePage.balanceUpdateFailed",
              "Leave denied, but the balance could not be updated: {{message}}",
              { message: balanceError.message },
            ),
            variant: "destructive",
          });
        }
      }

      toast({
        title: t("leavePage.leaveDenied"),
        description: t("leavePage.leaveDeniedDesc", { name: selectedRequest.employee_name }),
      });

      // Send denial notification email (non-blocking)
      const { data: empData } = await supabase
        .from("employees")
        .select("email")
        .eq("id", selectedRequest.employee_id)
        .single();

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user?.id || "")
        .single();

      sendLeaveNotification({
        employeeName: selectedRequest.employee_name,
        employeeEmail: empData?.email || "unknown@email.com",
        leaveType: selectedRequest.leave_type,
        startDate: format(new Date(selectedRequest.start_date), "MMM d, yyyy"),
        endDate: format(new Date(selectedRequest.end_date), "MMM d, yyyy"),
        totalDays: selectedRequest.total_days,
        status: "denied",
        denialReason: denialReason,
        approverName: profileData?.full_name || undefined,
      });

      setDenyDialogOpen(false);
      setSelectedRequest(null);
      setDenialReason("");
      fetchData();
    } catch (error) {
      console.error("Error denying leave:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToDeny"),
        variant: "destructive",
      });
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: t("leavePage.fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    const workingDays = calculateWorkingDays(startDate, endDate);
    if (workingDays <= 0) {
      toast({
        title: t("common.error"),
        description: t("leavePage.invalidDateRange"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: created, error } = await supabase
        .from("leave_requests")
        .insert({
          employee_id: selectedEmployee,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          total_days: workingDays,
          reason: reason || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      // Resolve and persist the approval chain for this request. Until the
      // set_leave_approval_plan trigger (migration 20260731000006) is applied,
      // this is what writes approval_rule_id / total_approval_steps; once it is,
      // this becomes a no-op because the plan is already there.
      if (created?.id) {
        const { error: planError } = await initializeApprovalWorkflow(
          created.id,
          leaveType,
          workingDays,
          approvalRules,
        );
        if (planError) {
          console.error("Error resolving approval chain:", planError);
        }
      }

      // Reserve the days as pending for any balance-tracking leave type.
      // (Previously annual-only, because annual_pending was the only column.)
      const submitConfig = getBySlug(leaveType);
      if (submitConfig?.tracks_balance) {
        const { error: balanceError } = await applyLeaveBalanceChange({
          employeeId: selectedEmployee,
          year: new Date().getFullYear(),
          slug: leaveType,
          pendingDelta: workingDays,
        });

        if (balanceError) {
          console.error("Error reserving pending leave balance:", balanceError);
          toast({
            title: t("common.error"),
            description: t(
              "leavePage.balanceUpdateFailed",
              "Request created, but the balance could not be updated: {{message}}",
              { message: balanceError.message },
            ),
            variant: "destructive",
          });
        }
      }

      toast({
        title: t("leavePage.leaveRequestCreated"),
        description: t("leavePage.leaveRequestCreatedDesc", { days: workingDays }),
      });

      setNewRequestOpen(false);
      setSelectedEmployee("");
      setLeaveType("annual");
      setStartDate("");
      setEndDate("");
      setReason("");
      fetchData();
    } catch (error) {
      console.error("Error creating leave request:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToCreate"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedDays = startDate && endDate ? calculateWorkingDays(startDate, endDate) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CalendarDays className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("leavePage.leaveRequests")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("leavePage.manageLeaveRequests")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push("/admin/hr/leave/calendar")}
              className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
            >
              <Calendar className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("leaveCalendar.title")}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push("/admin/hr/leave/balances")}
              className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
            >
              <Wallet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("leavePage.viewBalances")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportModalOpen(true)}
              className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
            >
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:exportButton", "Export")}
            </Button>
            <Button
              onClick={() => setNewRequestOpen(true)}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("leavePage.newRequest")}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`border-[#E6E6E4] cursor-pointer transition-all hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] ${statusFilter === "pending" ? "ring-2 ring-[#C6A03B]" : ""}`}
          onClick={() => setStatusFilter("pending")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("leavePage.pendingCount")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <Clock className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-[#222222]">{pendingCount}</p>
          </CardContent>
        </Card>
        {leaveTypesList.slice(0, 3).map((lt) => {
          const Icon = getLeaveTypeIcon(lt.icon_name);
          const count = requests.filter((r) => r.leave_type === lt.slug && r.status === "pending").length;

          return (
            <Card
              key={lt.slug}
              className={`border-[#E6E6E4] cursor-pointer transition-all hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] ${leaveTypeFilter === lt.slug ? "ring-2 ring-[#C6A03B]" : ""}`}
              onClick={() => {
                setLeaveTypeFilter(leaveTypeFilter === lt.slug ? "all" : lt.slug);
                setStatusFilter("pending");
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6B6B6B]">{lt.name}</p>
                  <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[#0C5536]" />
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2 text-[#222222]">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter Bar */}
      <Card className="border-[#E6E6E4]">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C6A03B]" />
              <Input
                placeholder={t("leavePage.searchEmployee", "Search by employee name...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltr:pl-9 rtl:pr-9 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                <SelectValue placeholder={t("leavePage.filterByStatus", "Filter by status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leavePage.allStatuses", "All Statuses")}</SelectItem>
                <SelectItem value="pending">{t("leavePage.statusPending", "Pending")}</SelectItem>
                <SelectItem value="approved">{t("leavePage.statusApproved", "Approved")}</SelectItem>
                <SelectItem value="denied">{t("leavePage.statusDenied", "Denied")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Leave Type Filter */}
            <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                <SelectValue placeholder={t("leavePage.filterByType", "Filter by type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leavePage.allTypes", "All Types")}</SelectItem>
                {leaveTypesList.map((lt) => {
                  const Icon = getLeaveTypeIcon(lt.icon_name);
                  return (
                    <SelectItem key={lt.slug} value={lt.slug}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${lt.color_class}`} />
                        {lt.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={`${sortColumn}-${sortDirection}`} onValueChange={(value) => {
              const [col, dir] = value.split("-") as [SortColumn, "asc" | "desc"];
              setSortColumn(col);
              setSortDirection(dir);
            }}>
              <SelectTrigger className="w-full md:w-[180px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                <SelectValue placeholder={t("leavePage.sortBy", "Sort by")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted-desc">{t("leavePage.sortNewest", "Newest First")}</SelectItem>
                <SelectItem value="submitted-asc">{t("leavePage.sortOldest", "Oldest First")}</SelectItem>
                <SelectItem value="employee-asc">{t("leavePage.sortEmployeeAZ", "Employee A-Z")}</SelectItem>
                <SelectItem value="employee-desc">{t("leavePage.sortEmployeeZA", "Employee Z-A")}</SelectItem>
                <SelectItem value="dates-asc">{t("leavePage.sortDateEarliest", "Start Date (Earliest)")}</SelectItem>
                <SelectItem value="dates-desc">{t("leavePage.sortDateLatest", "Start Date (Latest)")}</SelectItem>
                <SelectItem value="days-desc">{t("leavePage.sortDaysMore", "Most Days")}</SelectItem>
                <SelectItem value="days-asc">{t("leavePage.sortDaysLess", "Fewest Days")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(searchQuery || statusFilter !== "pending" || leaveTypeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("pending");
                  setLeaveTypeFilter("all");
                }}
                className="text-[#777777] hover:text-[#222222]"
              >
                <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("leavePage.clearFilters", "Clear")}
              </Button>
            )}
          </div>

          {/* Results count */}
          <div className="mt-3 text-sm text-[#6B6B6B]">
            {t("leavePage.showingResults", "Showing {{count}} of {{total}} requests", { 
              count: sortedRequests.length, 
              total: requests.length 
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {statusFilter === "pending" 
                ? t("leavePage.pendingRequests") 
                : statusFilter === "approved" 
                  ? t("leavePage.approvedRequests", "Approved Requests")
                  : statusFilter === "denied"
                    ? t("leavePage.deniedRequests", "Denied Requests")
                    : t("leavePage.allRequests", "All Requests")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {sortedRequests.length === 0 ? (
            <div className="text-center py-12 text-[#6B6B6B]">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">
                {statusFilter === "pending" 
                  ? t("leavePage.noPendingRequests") 
                  : t("leavePage.noRequestsFound", "No requests found")}
              </p>
              <p className="text-sm mt-1">
                {statusFilter === "pending" 
                  ? t("leavePage.allCaughtUp", "All caught up!") 
                  : t("leavePage.tryDifferentFilters", "Try adjusting your filters")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRequests.map((request) => {
                const config = getConfig(request.leave_type);
                const Icon = config.icon;
                const daysAgo = differenceInDays(new Date(), new Date(request.created_at));
                const approval = request.status === "pending" ? getApprovalInfo(request) : null;

                return (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border border-[#E6E6E4] bg-white hover:border-[#C6A03B]/50 hover:bg-[#FAFAF8] transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-full bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-[hsl(var(--jw-primary-green))]">
                              {(request.employee_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </span>
                          </div>
                          <span className="font-medium text-[#222222]">{request.employee_name}</span>
                          <Badge className={`${config.color.replace("text", "bg").replace("600", "100")} ${config.color} border-0`}>
                            <Icon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                            {config.label}
                          </Badge>
                          {/* Status Badge */}
                          {request.status === "approved" && (
                            <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
                              <CheckCircle className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                              {t("leavePage.statusApproved", "Approved")}
                            </Badge>
                          )}
                          {request.status === "denied" && (
                            <Badge className="bg-[#FEECEC] text-[#C0392B] border-0">
                              <XCircle className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                              {t("leavePage.statusDenied", "Denied")}
                            </Badge>
                          )}
                          {request.status === "pending" && (
                            <Badge className="bg-[#FFF9E6] text-[#C6A03B] border-0">
                              <Clock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                              {t("leavePage.statusPending", "Pending")}
                            </Badge>
                          )}
                          {/* Which approver the request is waiting on */}
                          {approval && (
                            <Badge variant="outline" className="text-[#555555] border-[#E6E6E4]">
                              {approval.label}
                            </Badge>
                          )}
                          {approval?.auth.delegateFor && (
                            <Badge variant="outline" className="text-[#555555] border-[#E6E6E4]">
                              {t("leavePage.actingAsDelegate", "Acting as delegate")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-[#6B6B6B] space-y-1 ltr:ml-11 rtl:mr-11">
                          <div>
                            <span className="font-medium text-[#555555]">{t("leavePage.dates")}:</span>{" "}
                            {format(new Date(request.start_date), "MMM d")} -{" "}
                            {format(new Date(request.end_date), "MMM d, yyyy")}
                            <Badge variant="outline" className="ml-2 text-[#222222] border-[#E6E6E4]">
                              {request.total_days} {t("days")}
                            </Badge>
                          </div>
                          {request.reason && (
                            <p>
                              <span className="font-medium text-[#555555]">{t("common.reason")}:</span> {request.reason}
                            </p>
                          )}
                          <p className="text-xs text-[#999999]">
                            {daysAgo === 0 ? t("leavePage.submittedToday") : daysAgo === 1 ? t("leavePage.submittedYesterday") : t("leavePage.submittedDaysAgo", { days: daysAgo })}
                          </p>
                          {/* Leave certificate: open the attached one, or attach
                              a certificate that was handed in on paper. */}
                          <div className="flex items-center gap-3 pt-0.5">
                            {request.attachment_path && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs text-[#0C5536]"
                                onClick={() => handleViewCertificate(request.id)}
                              >
                                <FileText className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                {t("leavePage.viewCertificate", "View Certificate")}
                              </Button>
                            )}
                            <Button
                              variant="link"
                              size="sm"
                              disabled={uploadingCertificateId === request.id}
                              className="h-auto p-0 text-xs text-[#555555]"
                              onClick={() => handlePickCertificate(request.id)}
                            >
                              {uploadingCertificateId === request.id ? (
                                <Loader2 className="h-3 w-3 animate-spin ltr:mr-1 rtl:ml-1" />
                              ) : (
                                <Paperclip className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                              )}
                              {request.attachment_path
                                ? t("leavePage.replaceCertificate", "Replace Certificate")
                                : t("leavePage.attachCertificate", "Attach Certificate")}
                            </Button>
                          </div>
                        </div>
                      </div>
                      {request.status === "pending" && (
                        <div
                          className="flex items-center gap-2 ltr:ml-11 rtl:mr-11 md:ml-0 md:mr-0"
                          title={approval && !approval.auth.allowed ? approval.auth.reason : undefined}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!approval?.auth.allowed}
                            className="text-[#C0392B] border-[#C0392B]/30 hover:bg-[#C0392B]/10"
                            onClick={() => {
                              setSelectedRequest(request);
                              setDenyDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                            {t("leavePage.deny")}
                          </Button>
                          <Button
                            size="sm"
                            disabled={!approval?.auth.allowed}
                            className="bg-[#0C5536] hover:bg-[#094228] text-white"
                            onClick={() => handleApprove(request)}
                          >
                            <CheckCircle className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                            {t("leavePage.approve")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shared hidden picker for leave certificates */}
      <input
        ref={certificateInputRef}
        type="file"
        accept={LEAVE_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={handleCertificateSelected}
      />

      {/* New Request Dialog */}
      <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
              <Plus className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {t("leavePage.submitLeaveRequest")}
            </DialogTitle>
            <DialogDescription>{t("leavePage.submitRequestDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="employee" className="text-[#555555]">{t("leavePage.employee")} <span className="text-red-500">*</span></Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="border-[#E6E6E4]">
                  <SelectValue placeholder={t("leavePage.selectEmployee")} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leave_type" className="text-[#555555]">{t("leavePage.leaveTypeLabel")} <span className="text-red-500">*</span></Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger className="border-[#E6E6E4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypesList.map((lt) => {
                    const Icon = getLeaveTypeIcon(lt.icon_name);
                    return (
                      <SelectItem key={lt.slug} value={lt.slug}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${lt.color_class}`} />
                          {lt.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date" className="text-[#555555]">{t("leavePage.startDate")} <span className="text-red-500">*</span></Label>
                <DatePicker
                  date={startDate ? new Date(startDate + "T00:00:00") : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      setStartDate(`${year}-${month}-${day}`);
                    } else {
                      setStartDate("");
                    }
                  }}
                  placeholder={t("leavePage.startDate")}
                  className="w-full"
                  clearable={false}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date" className="text-[#555555]">{t("leavePage.endDate")} <span className="text-red-500">*</span></Label>
                <DatePicker
                  date={endDate ? new Date(endDate + "T00:00:00") : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      setEndDate(`${year}-${month}-${day}`);
                    } else {
                      setEndDate("");
                    }
                  }}
                  placeholder={t("leavePage.endDate")}
                  className="w-full"
                  clearable={false}
                />
              </div>
            </div>
            {calculatedDays > 0 && (
              <div className="p-3 rounded-lg bg-[#E6F7F1] border border-[#0C5536]/20">
                <p className="text-sm text-[#0C5536]">
                  {t("leavePage.workingDays")}: <span className="font-semibold">{calculatedDays}</span>{" "}
                  <span className="text-xs opacity-75">({t("leavePage.excludingFriSat")})</span>
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="reason" className="text-[#555555]">{t("leavePage.reasonOptional")}</Label>
              <Textarea
                id="reason"
                placeholder={t("leavePage.enterReason")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRequestOpen(false)} className="border-[#E6E6E4]">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={isSubmitting || !selectedEmployee || !startDate || !endDate}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                  {t("leavePage.submitting")}
                </>
              ) : (
                t("leavePage.submitRequest")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#C0392B]">
              <XCircle className="h-5 w-5" />
              {t("leavePage.denyLeaveRequest")}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && t("leavePage.denyDescription", { name: selectedRequest.employee_name, type: getConfig(selectedRequest.leave_type).label })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="denial_reason" className="text-[#555555]">{t("leavePage.reasonForDenial")} <span className="text-red-500">*</span></Label>
              <Textarea
                id="denial_reason"
                placeholder={t("leavePage.enterDenialReason")}
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={3}
                className="border-[#E6E6E4] focus:border-[#C0392B] focus:ring-1 focus:ring-[#C0392B]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)} className="border-[#E6E6E4]">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleDeny}
              disabled={!denialReason.trim()}
              className="bg-[#C0392B] hover:bg-[#A33025] text-white"
            >
              <XCircle className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              {t("leavePage.denyRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Conflict Warning Dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#C6A03B]">
              <AlertCircle className="h-5 w-5" />
              {t("leavePage.conflictDetected")}
            </DialogTitle>
            <DialogDescription>
              {conflictRequest && t("leavePage.conflictDescription", { name: conflictRequest.employee_name })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-[#FFF9E6] border border-[#C6A03B]/30 rounded-lg p-3">
              <p className="text-sm text-[#8B6914] font-medium mb-2">{t("leavePage.conflictingRecords")}:</p>
              <ul className="space-y-1">
                {conflicts.map((conflict, idx) => (
                  <li key={idx} className="text-sm text-[#8B6914] flex items-center gap-2">
                    <span className="font-medium">{format(new Date(conflict.date), "MMM d, yyyy")}</span>
                    <span>-</span>
                    <Badge variant="outline" className="text-xs capitalize border-[#C6A03B]/30">
                      {conflict.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-[#6B6B6B] mt-3">
              {t("leavePage.approvingWillOverwrite")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConflictDialogOpen(false);
                setConflictRequest(null);
                setConflicts([]);
              }}
              className="border-[#E6E6E4]"
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleConfirmOverride} className="bg-[#C6A03B] hover:bg-[#A88A2F] text-white">
              <AlertCircle className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              {t("leavePage.overrideAndApprove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <ExportLeaveModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
      />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice")}
        </p>
      </div>
    </div>
  );
}
