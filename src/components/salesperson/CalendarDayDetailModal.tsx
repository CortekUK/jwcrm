"use client";

import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Building,
  MessageSquare,
  ExternalLink,
  Send,
} from "lucide-react";

export interface CommunicationData {
  id: string;
  lead_id: string;
  scheduled_at: string;
  notes: string | null;
  created_by_name: string | null;
  communication_method: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
  lead: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  };
}

interface CalendarDayDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  communications: CommunicationData[];
  onViewLead: (leadId: string) => void;
  onSendMeetingInvite: (communication: CommunicationData) => void;
}

export function CalendarDayDetailModal({
  open,
  onOpenChange,
  selectedDate,
  communications,
  onViewLead,
  onSendMeetingInvite,
}: CalendarDayDetailModalProps) {
  const { t } = useTranslation("salesperson");

  if (!selectedDate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 flex-1 overflow-hidden flex flex-col">
          {/* Summary */}
          <div className="mb-4 p-3 rounded-lg bg-gray-50 flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{t("scheduledMeetings")}</span>
              <Badge variant="secondary">{communications.length}</Badge>
            </div>
          </div>

          {/* Communications List */}
          {communications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>{t("noMeetingsToday")}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "400px" }}>
              <div className="space-y-4 pb-2">
                {communications.map((comm) => (
                  <div
                    key={comm.id}
                    className="p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    {/* Header: Time and Method */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                        <span className="font-medium text-gray-900">
                          {format(new Date(comm.scheduled_at), "h:mm a")}
                        </span>
                      </div>
                      {comm.communication_method && (
                        <Badge
                          variant="outline"
                          className="text-[hsl(var(--jw-primary-green))] border-[hsl(var(--jw-primary-green))]"
                        >
                          {comm.communication_method.name}
                        </Badge>
                      )}
                    </div>

                    {/* Lead Info */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{comm.lead.full_name}</span>
                      </div>
                      {comm.lead.email && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{comm.lead.email}</span>
                        </div>
                      )}
                      {comm.lead.phone && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{comm.lead.phone}</span>
                        </div>
                      )}
                      {comm.lead.company_name && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span>{comm.lead.company_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {comm.notes && (
                      <div className="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                        {comm.notes}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[hsl(var(--jw-primary-green))] hover:text-[hsl(var(--jw-hover-green))]"
                        onClick={() => onViewLead(comm.lead.id)}
                      >
                        <ExternalLink className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                        {t("viewLead")}
                      </Button>
                      {comm.lead.email && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[hsl(var(--jw-gold-accent))] hover:text-[hsl(var(--jw-gold-accent))]/80"
                          onClick={() => onSendMeetingInvite(comm)}
                        >
                          <Send className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                          {t("sendMeetingInvite")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
