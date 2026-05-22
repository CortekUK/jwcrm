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
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  MapPin,
  User,
  Calendar,
  Loader2,
  MessageCircle,
  Bell,
} from "lucide-react";
import { AddCommunicationDialog } from "@/components/lead-management/AddCommunicationDialog";
import { AddReminderDialog } from "@/components/lead-management/reminders/AddReminderDialog";
import { LeadNotesSection } from "@/components/lead-management/LeadNotesSection";
import { GenerateInvoiceDialog } from "@/components/lead-management/GenerateInvoiceDialog";
import { Receipt } from "lucide-react";

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

export default function LeadHistoryPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const resolvedParams = use(params);
  const { t } = useTranslation("leadManagement");
  const router = useRouter();

  const [lead, setLead] = useState<LeadData | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  useEffect(() => {
    const fetchLeadHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/lead-management/leads/${resolvedParams.leadId}/history`
        );

        if (!response.ok) {
          if (response.status === 404) {
            toast.error(t("leadNotFound"));
            router.push("/admin/lead-management/leads");
            return;
          }
          throw new Error("Failed to fetch lead history");
        }

        const { data } = await response.json();
        setLead(data.lead);
        setProposals(data.proposals);
        setCommunications(data.communications || []);
        setReminders(data.reminders || []);
      } catch (error) {
        console.error("Error fetching lead history:", error);
        toast.error(t("failedToFetchLeadHistory"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.leadId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won":
        return "bg-green-100 text-green-800";
      case "lost":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "qualified":
        return "bg-purple-100 text-purple-800";
      case "negotiation":
        return "bg-indigo-100 text-indigo-800";
      case "meeting":
        return "bg-blue-100 text-blue-800";
      case "consultation":
        return "bg-cyan-100 text-cyan-800";
      case "hold":
        return "bg-orange-100 text-orange-800";
      case "not_started":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      not_started: t("notStarted"),
      consultation: t("consultation"),
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
    const fetchLeadHistory = async () => {
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
    fetchLeadHistory();
  };

  const handleReminderAdded = () => {
    // Refetch reminders
    const fetchReminders = async () => {
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
    fetchReminders();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {lead.full_name}
            </h1>
            <Badge className={getStatusColor(lead.status)}>
              {getStatusLabel(lead.status)}
            </Badge>
            {lead.is_paid && (
              <Badge className="bg-emerald-100 text-emerald-800">
                {t("paid")}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{t("leadHistory")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCommunicationDialog(true)}
          >
            <MessageCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("addCommunication")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReminderDialog(true)}
          >
            <Bell className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("setReminder")}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowInvoiceDialog(true)}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            <Receipt className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("generateInvoice")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lead Details Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("leadDetails")}</CardTitle>
            <CardDescription>
              {t("created")}: {format(new Date(lead.created_at), "MMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("email")}</p>
                <p className="text-sm font-medium">{lead.email}</p>
              </div>
            </div>

            {/* Phone */}
            {lead.phone && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50">
                  <Phone className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("phone")}</p>
                  <p className="text-sm font-medium">{lead.phone}</p>
                </div>
              </div>
            )}

            {/* Company */}
            {lead.company_name && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-50">
                  <Building className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("company")}</p>
                  <p className="text-sm font-medium">{lead.company_name}</p>
                </div>
              </div>
            )}

            {/* Source */}
            {(lead.source_data?.name || lead.source) && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-50">
                  <MapPin className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("source")}</p>
                  <p className="text-sm font-medium">
                    {lead.source_data?.name ||
                      lead.source
                        ?.replace(/[_-]/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Assigned To */}
            {lead.assigned_user && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("assignedTo")}
                  </p>
                  <p className="text-sm font-medium">
                    {lead.assigned_user.full_name}
                  </p>
                  {lead.assigned_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(lead.assigned_at), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("notes")}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Timeline Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("timeline")}</CardTitle>
            <CardDescription>{t("timelineDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadHistoryTimeline events={timelineEvents} isLoading={false} />
          </CardContent>
        </Card>
      </div>

      {/* Notes Section */}
      <LeadNotesSection
        leadId={lead.id}
        initialNotes={lead.notes}
        updatedAt={lead.updated_at}
      />

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

      <GenerateInvoiceDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        leadId={lead.id}
        leadName={lead.full_name}
      />
    </div>
  );
}
