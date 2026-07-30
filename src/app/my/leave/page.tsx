"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import {
  LEAVE_ATTACHMENT_ACCEPT,
  validateLeaveAttachment,
} from "@/lib/hr/leaveAttachments";

type LeaveType = { slug: string; name: string };
type LeaveRequest = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  denial_reason: string | null;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
};

export default function MyLeavePage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employeeName, setEmployeeName] = useState<string>("");
  const [employeeLinked, setEmployeeLinked] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  // Bumped to reset the file input after a successful submit.
  const [fileInputKey, setFileInputKey] = useState(0);

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const t = await token();
    if (!t) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/hr/leave/self", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load your leave.");
        return;
      }
      setTypes(data.leaveTypes || []);
      setRequests(data.requests || []);
      setEmployeeName(data.employee?.full_name || "");
      setEmployeeLinked(data.employeeLinked !== false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveType || !startDate || !endDate) {
      toast.error("Please fill in the leave type and dates.");
      return;
    }
    setSubmitting(true);
    try {
      const t = await token();
      const auth: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};

      // With no certificate this is byte-for-byte the request it always was.
      // A certificate switches the same endpoint to multipart so the file can
      // travel with it; the server uploads it and stores the path.
      const res = certificate
        ? await fetch("/api/hr/leave/self", {
            method: "POST",
            headers: auth,
            body: (() => {
              const form = new FormData();
              form.append("leave_type", leaveType);
              form.append("start_date", startDate);
              form.append("end_date", endDate);
              form.append("reason", reason);
              form.append("certificate", certificate);
              return form;
            })(),
          })
        : await fetch("/api/hr/leave/self", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...auth,
            },
            body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      toast.success("Leave request submitted for approval.");
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setCertificate(null);
      setFileInputKey((k) => k + 1);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#C6A03B]" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-[#555555]">Please sign in to request leave.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--jw-primary-green))] flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-[#C6A03B]" />
            My Leave
          </h1>
          {employeeName && (
            <p className="text-sm text-[#555555] mt-1">Signed in as {employeeName}</p>
          )}
        </div>

        <Card className="border-[#E6E6E4]">
          <CardHeader>
            <CardTitle className="text-base">Request Leave</CardTitle>
          </CardHeader>
          <CardContent>
            {!employeeLinked && (
              <div className="mb-4 rounded-md border border-[#E6C200] bg-[#FFF8E1] px-4 py-3 text-sm text-[#7A5C00]">
                Your account isn&apos;t linked to an employee record yet, so you can&apos;t submit leave.
                Please ask HR to add you as an employee.
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[#555555]">Leave Type *</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((tp) => (
                      <SelectItem key={tp.slug} value={tp.slug}>
                        {tp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[#555555]">Start Date *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#555555]">End Date *</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#555555]">Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Add any details for HR" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#555555]">Attach certificate (optional)</Label>
                <Input
                  key={fileInputKey}
                  type="file"
                  accept={LEAVE_ATTACHMENT_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (!file) {
                      setCertificate(null);
                      return;
                    }
                    const problem = validateLeaveAttachment(file);
                    if (problem) {
                      toast.error(problem);
                      setCertificate(null);
                      setFileInputKey((k) => k + 1);
                      return;
                    }
                    setCertificate(file);
                  }}
                />
                <p className="text-xs text-[#999999]">
                  PDF, JPG or PNG, up to 5MB. Only HR can see it.
                </p>
                {certificate && (
                  <div className="flex items-center gap-2 text-xs text-[#555555]">
                    <span className="truncate">{certificate.name}</span>
                    <button
                      type="button"
                      className="text-[#999999] hover:text-[#555555]"
                      onClick={() => {
                        setCertificate(null);
                        setFileInputKey((k) => k + 1);
                      }}
                      aria-label="Remove attached certificate"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                disabled={submitting || !employeeLinked}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardHeader>
            <CardTitle className="text-base">My Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-[#999999]">You haven&apos;t submitted any leave requests yet.</p>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md border border-[#EAEAE8] p-3"
                  >
                    <div>
                      <div className="font-medium text-sm capitalize">
                        {types.find((t) => t.slug === r.leave_type)?.name || r.leave_type}
                      </div>
                      <div className="text-xs text-[#777777]">
                        {r.start_date} → {r.end_date} · {r.total_days} day{r.total_days > 1 ? "s" : ""}
                      </div>
                      {r.status === "denied" && r.denial_reason && (
                        <div className="text-xs text-red-600 mt-1">Reason: {r.denial_reason}</div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded capitalize ${statusStyle[r.status] || ""}`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
