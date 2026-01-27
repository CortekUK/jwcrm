"use client";

import { useState, useEffect, use } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LeadHistoryTimeline,
  buildTimelineEvents,
} from "@/components/lead-management/LeadHistoryTimeline";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  Loader2,
  MessageCircle,
  Bell,
  Target,
  ClipboardCheck,
  DollarSign,
  ListChecks,
  CheckCircle2,
  Save,
  Send,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddCommunicationDialog } from "@/components/lead-management/AddCommunicationDialog";
import { AddReminderDialog } from "@/components/lead-management/reminders/AddReminderDialog";
import { LeadDocuments } from "@/components/lead-management/LeadDocuments";
import { QuickProposalDialog } from "@/components/lead-management/QuickProposalDialog";
import { Lead } from "@/components/lead-management/LeadTable";

interface LeadData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  source: string | null;
  source_id: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  status: string;
  is_paid: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  needs_identified: string | null;
  quoted_price: number | null;
  quoted_currency: string | null;
  next_steps: string | null;
  created_at: string;
  updated_at: string;
  source_data?: { id: string; name: string } | null;
  assigned_user?: { user_id: string; full_name: string; email: string } | null;
}

interface Proposal {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
}

interface Communication {
  id: string;
  scheduled_at: string;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  communication_method: {
    id: string;
    name: string;
    icon: string;
  } | null;
}

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export default function SalespersonLeadHistoryPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const resolvedParams = use(params);
  const { t } = useTranslation("leadManagement");
  const { t: tSalesperson } = useTranslation("salesperson");
  const router = useRouter();
  const { user } = useAuth();

  const [lead, setLead] = useState<LeadData | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [showQuickProposalDialog, setShowQuickProposalDialog] = useState(false);
  
  // Consultation outcome state
  const [needsIdentified, setNeedsIdentified] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [quotedCurrency, setQuotedCurrency] = useState("AED");
  const [nextSteps, setNextSteps] = useState("");
  const [isSavingConsultation, setIsSavingConsultation] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

  useEffect(() => {
    const fetchLeadHistory = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/lead-management/leads/${resolvedParams.leadId}/history`
        );

        if (!response.ok) {
          if (response.status === 404) {
            toast.error(t("leadNotFound"));
            router.push("/admin/salesperson/leads");
            return;
          }
          throw new Error("Failed to fetch lead history");
        }

        const { data } = await response.json();

        // Check if this lead is assigned to the current salesperson
        if (data.lead.assigned_to !== user.id) {
          toast.error(t("accessDenied"));
          router.push("/admin/salesperson/leads");
          return;
        }

        setLead(data.lead);
        setProposals(data.proposals);
        setCommunications(data.communications || []);
        setReminders(data.reminders || []);
        
        // Populate consultation outcome fields
        setNeedsIdentified(data.lead.needs_identified || "");
        setQuotedPrice(data.lead.quoted_price?.toString() || "");
        setQuotedCurrency(data.lead.quoted_currency || "AED");
        setNextSteps(data.lead.next_steps || "");
      } catch (error) {
        console.error("Error fetching lead history:", error);
        toast.error(t("failedToFetchLeadHistory"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.leadId, user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won":
        return "bg-[#E6F7F1] text-[#0C5536] border-0";
      case "lost":
        return "bg-[#FEECEC] text-[#C0392B] border-0";
      case "pending":
        return "bg-[#FFF9E6] text-[#C6A03B] border-0";
      case "qualified":
        return "bg-[#EDE9FE] text-[#7C3AED] border-0";
      case "negotiation":
        return "bg-[#E0E7FF] text-[#4F46E5] border-0";
      case "meeting":
        return "bg-[#DBEAFE] text-[#2563EB] border-0";
      case "consultation":
        return "bg-[#E0F2FE] text-[#0369A1] border-0";
      case "consultation_completed":
        return "bg-[#DCFCE7] text-[#166534] border-0";
      case "hold":
        return "bg-[#FEF3C7] text-[#D97706] border-0";
      case "contacted":
        return "bg-[#E6F7F1] text-[#0C5536] border-0";
      case "not_started":
      default:
        return "bg-[#F5F5F3] text-[#6B6B6B] border-0";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      not_started: t("notStarted"),
      consultation: t("consultation"),
      consultation_completed: t("consultationCompleted", "Consultation Completed"),
      meeting: t("meeting"),
      hold: t("hold"),
      qualified: t("qualified"),
      negotiation: t("negotiation"),
      pending: t("pending"),
      won: t("won"),
      lost: t("lost"),
    };
    return statusMap[status] || status;
  };

  const timelineEvents = lead
    ? buildTimelineEvents(
        {
          created_at: lead.created_at,
          assigned_at: lead.assigned_at,
          assigned_user: lead.assigned_user
            ? { full_name: lead.assigned_user.full_name }
            : null,
        },
        proposals,
        t,
        communications.map(c => ({
          id: c.id,
          scheduled_at: c.scheduled_at,
          notes: c.notes,
          communication_method: c.communication_method
        }))
      )
    : [];

  const handleCommunicationAdded = () => {
    // Refetch data to update timeline
    const fetchData = async () => {
      try {
        const response = await fetch(
          `/api/lead-management/leads/${resolvedParams.leadId}/history`
        );
        if (response.ok) {
          const { data } = await response.json();
          setCommunications(data.communications || []);
        }
      } catch (error) {
        console.error("Error refetching communications:", error);
      }
    };
    fetchData();
  };

  const handleReminderAdded = () => {
    // Refetch reminders
    const fetchData = async () => {
      try {
        const response = await fetch(
          `/api/lead-management/leads/${resolvedParams.leadId}/history`
        );
        if (response.ok) {
          const { data } = await response.json();
          setReminders(data.reminders || []);
        }
      } catch (error) {
        console.error("Error refetching reminders:", error);
      }
    };
    fetchData();
  };

  const handleProposalSent = () => {
    // Refetch lead data to update status and proposals
    const refetchData = async () => {
      try {
        const response = await fetch(
          `/api/lead-management/leads/${resolvedParams.leadId}/history`
        );
        if (response.ok) {
          const { data } = await response.json();
          setLead(data.lead);
          setProposals(data.proposals);
        }
      } catch (error) {
        console.error("Error refetching data:", error);
      }
    };
    refetchData();
  };

  // Convert LeadData to Lead type for QuickProposalDialog
  const leadForDialog: Lead | null = lead
    ? {
        id: lead.id,
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone,
        company_name: lead.company_name,
        notes: lead.notes,
        source: lead.source,
        source_id: lead.source_id,
        assigned_to: lead.assigned_to,
        assigned_at: lead.assigned_at,
        status: lead.status as Lead["status"],
        is_paid: lead.is_paid,
        paid_at: lead.paid_at,
        paid_amount: lead.paid_amount,
        paid_currency: lead.paid_currency,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      }
    : null;

  // Determine if the "Complete & Send Proposal" button should be shown
  const canSendProposal = lead && !["won", "lost", "pending"].includes(lead.status);

  const handleSaveConsultationOutcome = async () => {
    if (!lead) return;
    
    setIsSavingConsultation(true);
    try {
      const response = await fetch(`/api/lead-management/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          needs_identified: needsIdentified || null,
          quoted_price: quotedPrice ? parseFloat(quotedPrice) : null,
          quoted_currency: quotedCurrency,
          next_steps: nextSteps || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save consultation outcome");
      }

      const { data } = await response.json();
      setLead(data);
      toast.success(t("consultationOutcomeSaved", "Consultation outcome saved"));
    } catch (error) {
      console.error("Error saving consultation outcome:", error);
      toast.error(t("failedToSaveConsultationOutcome", "Failed to save consultation outcome"));
    } finally {
      setIsSavingConsultation(false);
    }
  };

  const handleMarkConsultationComplete = async () => {
    if (!lead) return;
    
    // Validate that required fields are filled
    if (!needsIdentified.trim()) {
      toast.error(t("needsIdentifiedRequired", "Please enter needs identified before marking complete"));
      return;
    }
    
    setIsMarkingComplete(true);
    try {
      const response = await fetch(`/api/lead-management/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          needs_identified: needsIdentified || null,
          quoted_price: quotedPrice ? parseFloat(quotedPrice) : null,
          quoted_currency: quotedCurrency,
          next_steps: nextSteps || null,
          status: "consultation_completed",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark consultation complete");
      }

      const { data } = await response.json();
      setLead(data);
      toast.success(t("consultationMarkedComplete", "Consultation marked as complete"));
    } catch (error) {
      console.error("Error marking consultation complete:", error);
      toast.error(t("failedToMarkComplete", "Failed to mark consultation complete"));
    } finally {
      setIsMarkingComplete(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C6A03B]" />
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8 hover:bg-[#FFF9E6]"
          >
            <ArrowLeft className="h-4 w-4 text-[#555555]" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {lead.full_name}
              </h1>
              <Badge className={getStatusColor(lead.status)}>
                {getStatusLabel(lead.status)}
              </Badge>
              {lead.is_paid && (
                <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
                  {t("paid")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">{t("leadHistory")}</p>
          </div>
          <div className="flex items-center gap-2">
            {canSendProposal && (
              <Button
                size="sm"
                onClick={() => setShowQuickProposalDialog(true)}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("completeAndSendProposal", "Complete & Send Proposal")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCommunicationDialog(true)}
              className="border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
            >
              <MessageCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-[hsl(var(--jw-primary-green))]" />
              {t("addCommunication")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReminderDialog(true)}
              className="border-[#E6E6E4] hover:bg-[#FFF9E6] hover:border-[#C6A03B]"
            >
              <Bell className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-[#C6A03B]" />
              {t("setReminder")}
            </Button>
          </div>
        </div>
      </div>

      {/* Consultation Outcome Card - Only show for consultation or earlier statuses */}
      {lead.status !== "won" && lead.status !== "lost" && (
        <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-[#C6A03B]" />
                <CardTitle className="text-[hsl(var(--jw-primary-green))]">
                  {t("consultationOutcome", "Consultation Outcome")}
                </CardTitle>
              </div>
              {lead.status === "consultation_completed" && (
                <Badge className="bg-[#DCFCE7] text-[#166534] border-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t("completed", "Completed")}
                </Badge>
              )}
            </div>
            <CardDescription className="ltr:ml-7 rtl:mr-7">
              {t("consultationOutcomeDescription", "Record the outcomes from the consultation meeting")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Needs Identified */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="needs_identified" className="flex items-center gap-2 text-[#555555]">
                  <ListChecks className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                  {t("needsIdentified", "Needs Identified")}
                </Label>
                <Textarea
                  id="needs_identified"
                  placeholder={t("needsIdentifiedPlaceholder", "Describe the client's needs identified during consultation...")}
                  value={needsIdentified}
                  onChange={(e) => setNeedsIdentified(e.target.value)}
                  className="min-h-[100px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]/20"
                />
              </div>

              {/* Quoted Price */}
              <div className="space-y-2">
                <Label htmlFor="quoted_price" className="flex items-center gap-2 text-[#555555]">
                  <DollarSign className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                  {t("quotedPrice", "Quoted Price")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="quoted_price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={quotedPrice}
                    onChange={(e) => setQuotedPrice(e.target.value)}
                    className="flex-1 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]/20"
                  />
                  <Select value={quotedCurrency} onValueChange={setQuotedCurrency}>
                    <SelectTrigger className="w-24 border-[#E6E6E4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Next Steps */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="next_steps" className="flex items-center gap-2 text-[#555555]">
                  <ListChecks className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                  {t("nextSteps", "Next Steps")}
                </Label>
                <Textarea
                  id="next_steps"
                  placeholder={t("nextStepsPlaceholder", "Outline the agreed next steps...")}
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  className="min-h-[80px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]/20"
                />
              </div>
            </div>

            <Separator className="bg-[#E6E6E4]" />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleSaveConsultationOutcome}
                disabled={isSavingConsultation}
                className="border-[#E6E6E4] hover:bg-[hsl(var(--jw-gold-accent))]/10 hover:border-[hsl(var(--jw-gold-accent))]"
              >
                {isSavingConsultation ? (
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                )}
                {t("saveDraft", "Save Draft")}
              </Button>
              {lead.status !== "consultation_completed" && (
                <Button
                  onClick={handleMarkConsultationComplete}
                  disabled={isMarkingComplete || !needsIdentified.trim()}
                  className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
                >
                  {isMarkingComplete ? (
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  )}
                  {t("markConsultationComplete", "Mark Consultation Complete")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lead Details Card */}
        <Card className="lg:col-span-1 border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>{t("leadDetails")}</CardTitle>
            <CardDescription className="text-[#777777]">
              {t("created")}: {format(new Date(lead.created_at), "MMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FFF9E6]">
                <Mail className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
              </div>
              <div>
                <p className="text-xs text-[#777777]">{t("email")}</p>
                <p className="text-sm font-medium text-[#222222]">{lead.email}</p>
              </div>
            </div>

            {/* Phone */}
            {lead.phone && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FFF9E6]">
                  <Phone className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                </div>
                <div>
                  <p className="text-xs text-[#777777]">{t("phone")}</p>
                  <p className="text-sm font-medium text-[#222222]">{lead.phone}</p>
                </div>
              </div>
            )}

            {/* Company */}
            {lead.company_name && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FFF9E6]">
                  <Building className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                </div>
                <div>
                  <p className="text-xs text-[#777777]">{t("company")}</p>
                  <p className="text-sm font-medium text-[#222222]">{lead.company_name}</p>
                </div>
              </div>
            )}

            {/* Source */}
            {(lead.source_data?.name || lead.source) && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FFF9E6]">
                  <MapPin className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                </div>
                <div>
                  <p className="text-xs text-[#777777]">{t("source")}</p>
                  <p className="text-sm font-medium text-[#222222]">
                    {lead.source_data?.name ||
                      lead.source
                        ?.replace(/[_-]/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <>
                <Separator className="bg-[#E6E6E4]" />
                <div>
                  <p className="text-xs text-[#777777] mb-1">
                    {t("notes")}
                  </p>
                  <p className="text-sm text-[#555555] whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Timeline Card */}
        <Card className="lg:col-span-2 border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>{t("timeline")}</CardTitle>
            <CardDescription className="text-[#777777]">{t("timelineDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadHistoryTimeline events={timelineEvents} isLoading={false} />
          </CardContent>
        </Card>
      </div>

      {/* Documents Section */}
      <div className="mt-6">
        <LeadDocuments leadId={lead.id} leadName={lead.full_name} />
      </div>

      {/* Dialogs */}
      <AddCommunicationDialog
        open={showCommunicationDialog}
        onOpenChange={setShowCommunicationDialog}
        leadId={lead.id}
        onSuccess={handleCommunicationAdded}
      />

      <AddReminderDialog
        open={showReminderDialog}
        onOpenChange={setShowReminderDialog}
        leadId={lead.id}
        leadName={lead.full_name}
        onSuccess={handleReminderAdded}
      />

      <QuickProposalDialog
        lead={leadForDialog}
        open={showQuickProposalDialog}
        onOpenChange={setShowQuickProposalDialog}
        onSuccess={handleProposalSent}
      />
    </div>
  );
}
