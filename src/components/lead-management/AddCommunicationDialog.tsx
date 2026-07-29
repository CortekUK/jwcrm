"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Phone, MessageCircle, Mail, Video, Users, PhoneOff, PhoneCall } from "lucide-react";
import { toast } from "sonner";

interface CommunicationMethod {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

interface AddCommunicationDialogProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preSelectedMethodId?: string;
}

// Call outcome options
const CALL_OUTCOMES = [
  { value: "answered", icon: PhoneCall },
  { value: "no_answer", icon: PhoneOff },
  { value: "voicemail", icon: Phone },
  { value: "busy", icon: PhoneOff },
  { value: "wrong_number", icon: PhoneOff },
] as const;

type CallOutcome = typeof CALL_OUTCOMES[number]["value"];

const communicationFormSchema = z.object({
  communication_method_id: z.string().min(1, "Please select a communication method"),
  scheduled_at: z.string().min(1, "Please select a date and time"),
  notes: z.string().optional(),
  call_outcome: z.string().optional(),
});

type CommunicationFormValues = z.infer<typeof communicationFormSchema>;

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  "message-circle": MessageCircle,
  mail: Mail,
  video: Video,
  users: Users,
};

export function AddCommunicationDialog({
  leadId,
  open,
  onOpenChange,
  onSuccess,
  preSelectedMethodId,
}: AddCommunicationDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [methods, setMethods] = useState<CommunicationMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  const form = useForm<CommunicationFormValues>({
    resolver: zodResolver(communicationFormSchema),
    defaultValues: {
      communication_method_id: "",
      scheduled_at: "",
      notes: "",
      call_outcome: "",
    },
  });

  // Watch the selected method to conditionally show call outcome
  const selectedMethodId = useWatch({
    control: form.control,
    name: "communication_method_id",
  });

  // Check if the selected method is a phone call
  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const isPhoneCall = selectedMethod?.icon === "phone" || selectedMethod?.name?.toLowerCase() === "phone";

  // Fetch communication methods when dialog opens
  useEffect(() => {
    if (open) {
      fetchMethods();
      form.reset({
        communication_method_id: preSelectedMethodId || "",
        scheduled_at: new Date().toISOString().slice(0, 16),
        notes: "",
        call_outcome: "",
      });
    }
  }, [open, form, preSelectedMethodId]);

  const fetchMethods = async () => {
    setLoadingMethods(true);
    try {
      const response = await fetch("/api/lead-management/communication-methods");
      if (!response.ok) throw new Error("Failed to fetch methods");
      const { data } = await response.json();
      setMethods(data || []);
    } catch (error) {
      console.error("Error fetching communication methods:", error);
      toast.error(t("failedToFetchCommunicationMethods"));
    } finally {
      setLoadingMethods(false);
    }
  };

  const handleSubmit = async (data: CommunicationFormValues) => {
    // Validate call outcome is selected for phone calls
    if (isPhoneCall && !data.call_outcome) {
      form.setError("call_outcome", { message: t("callOutcomeRequired") });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/lead-management/leads/${leadId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communication_method_id: data.communication_method_id,
          scheduled_at: new Date(data.scheduled_at).toISOString(),
          notes: data.notes || null,
          call_outcome: isPhoneCall ? data.call_outcome : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add communication");
      }

      toast.success(t("communicationAdded"));
      onOpenChange(false);
      onSuccess?.();

      // Check cadence enforcement for failed call outcomes
      const callOutcome = isPhoneCall ? data.call_outcome : null;
      if (callOutcome) {
        try {
          // Contact cadence is org-wide and lives in the DB now — reading it
          // from localStorage meant the rule only applied on machines that had
          // visited the Settings page.
          const cadenceResponse = await fetch(
            "/api/lead-management/settings/followup-cadence"
          );
          if (cadenceResponse.ok) {
            const { data: cadence } = await cadenceResponse.json();
            if (cadence?.autoMarkUnreachable && cadence.failedOutcomes?.includes(callOutcome)) {
              // Fetch communications to count consecutive failures
              const commResponse = await fetch(`/api/lead-management/leads/${leadId}/communications`);
              if (commResponse.ok) {
                const { data: comms } = await commResponse.json();
                // Count consecutive failed attempts from newest
                let consecutiveFails = 0;
                for (const comm of comms) {
                  if (comm.call_outcome && cadence.failedOutcomes.includes(comm.call_outcome)) {
                    consecutiveFails++;
                  } else {
                    break;
                  }
                }
                if (consecutiveFails >= (cadence.maxAttempts || 3)) {
                  await fetch(`/api/lead-management/leads/${leadId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "unreachable" }),
                  });
                  toast.info(
                    t("leadMarkedUnreachable", `Lead marked as unreachable after ${consecutiveFails} failed contact attempts`),
                  );
                  onSuccess?.();
                }
              }
            }
          }
        } catch (cadenceError) {
          console.error("Error checking cadence enforcement:", cadenceError);
        }
      }
    } catch (error) {
      console.error("Error adding communication:", error);
      toast.error(error instanceof Error ? error.message : t("failedToAddCommunication"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodIcon = (iconName: string) => {
    const IconComponent = iconComponents[iconName] || Phone;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#C6A03B]" />
            <span className="text-[hsl(var(--jw-primary-green))]">{t("addCommunication")}</span>
          </DialogTitle>
          <DialogDescription className="ltr:ml-7 rtl:mr-7">
            {t("addCommunicationDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="communication_method_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#555555]">{t("communicationMethod")} <span className="text-[#C0392B]">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                        <SelectValue placeholder={loadingMethods ? t("loading") : t("selectMethod")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingMethods ? (
                        <div className="p-2 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-[#C6A03B]" />
                        </div>
                      ) : methods.length === 0 ? (
                        <div className="p-2 text-center text-sm text-[#999999]">
                          {t("noMethodsAvailable")}
                        </div>
                      ) : (
                        methods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            <div className="flex items-center gap-2">
                              {getMethodIcon(method.icon)}
                              <span>{method.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[#C0392B]" />
                </FormItem>
              )}
            />

            {/* Call Outcome - Only shown for phone calls */}
            {isPhoneCall && (
              <FormField
                control={form.control}
                name="call_outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#555555]">{t("callOutcome")} <span className="text-[#C0392B]">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                          <SelectValue placeholder={t("selectCallOutcome")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CALL_OUTCOMES.map((outcome) => {
                          const OutcomeIcon = outcome.icon;
                          return (
                            <SelectItem key={outcome.value} value={outcome.value}>
                              <div className="flex items-center gap-2">
                                <OutcomeIcon className="h-4 w-4" />
                                <span>{t(`callOutcome_${outcome.value}`)}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[#C0392B]" />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#555555]">{t("dateTime")} <span className="text-[#C0392B]">*</span></FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[#C0392B]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#555555]">{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("communicationNotesPlaceholder")}
                      className="resize-none border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[#C0392B]" />
                </FormItem>
              )}
            />

            <DialogFooter className="border-t border-[#E6E6E4] pt-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="border-[#E6E6E4] hover:bg-[#F5F5F3]"
              >
                {t("cancel")}
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                {isSubmitting && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                {t("addCommunication")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
