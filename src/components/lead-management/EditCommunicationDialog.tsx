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
import { Loader2, Phone, MessageCircle, Mail, Video, Users, PhoneOff, PhoneCall, Pencil } from "lucide-react";
import { toast } from "sonner";

interface CommunicationMethod {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

interface EditCommunicationDialogProps {
  leadId: string;
  communicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CALL_OUTCOMES = [
  { value: "answered", icon: PhoneCall },
  { value: "no_answer", icon: PhoneOff },
  { value: "voicemail", icon: Phone },
  { value: "busy", icon: PhoneOff },
  { value: "wrong_number", icon: PhoneOff },
] as const;

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

export function EditCommunicationDialog({
  leadId,
  communicationId,
  open,
  onOpenChange,
  onSuccess,
}: EditCommunicationDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [methods, setMethods] = useState<CommunicationMethod[]>([]);

  const form = useForm<CommunicationFormValues>({
    resolver: zodResolver(communicationFormSchema),
    defaultValues: {
      communication_method_id: "",
      scheduled_at: "",
      notes: "",
      call_outcome: "",
    },
  });

  const selectedMethodId = useWatch({
    control: form.control,
    name: "communication_method_id",
  });

  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const isPhoneCall = selectedMethod?.icon === "phone" || selectedMethod?.name?.toLowerCase() === "phone";

  useEffect(() => {
    if (open && communicationId) {
      fetchData();
    }
  }, [open, communicationId]);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      // Fetch methods and communication data in parallel
      const [methodsRes, commRes] = await Promise.all([
        fetch("/api/lead-management/communication-methods"),
        fetch(`/api/lead-management/leads/${leadId}/communications`),
      ]);

      if (methodsRes.ok) {
        const { data } = await methodsRes.json();
        setMethods(data || []);
      }

      if (commRes.ok) {
        const { data: comms } = await commRes.json();
        const comm = comms?.find((c: { id: string }) => c.id === communicationId);
        if (comm) {
          form.reset({
            communication_method_id: comm.communication_method?.id || comm.communication_method_id || "",
            scheduled_at: comm.scheduled_at ? new Date(comm.scheduled_at).toISOString().slice(0, 16) : "",
            notes: comm.notes || "",
            call_outcome: comm.call_outcome || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching communication data:", error);
      toast.error(t("failedToFetchCommunication", "Failed to load communication"));
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (data: CommunicationFormValues) => {
    if (!communicationId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/lead-management/leads/${leadId}/communications/${communicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            communication_method_id: data.communication_method_id,
            scheduled_at: new Date(data.scheduled_at).toISOString(),
            notes: data.notes || null,
            call_outcome: isPhoneCall ? data.call_outcome || null : null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update communication");
      }

      toast.success(t("communicationUpdated", "Communication updated"));
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating communication:", error);
      toast.error(error instanceof Error ? error.message : t("failedToUpdateCommunication", "Failed to update communication"));
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
            <Pencil className="h-5 w-5 text-[#C6A03B]" />
            <span className="text-[hsl(var(--jw-primary-green))]">{t("editCommunication", "Edit Communication")}</span>
          </DialogTitle>
          <DialogDescription className="ltr:ml-7 rtl:mr-7">
            {t("editCommunicationDescription", "Update communication details")}
          </DialogDescription>
        </DialogHeader>
        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#C6A03B]" />
          </div>
        ) : (
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
                          <SelectValue placeholder={t("selectMethod")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {methods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            <div className="flex items-center gap-2">
                              {getMethodIcon(method.icon)}
                              <span>{method.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[#C0392B]" />
                  </FormItem>
                )}
              />

              {isPhoneCall && (
                <FormField
                  control={form.control}
                  name="call_outcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#555555]">{t("callOutcome")}</FormLabel>
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
                  {t("saveChanges", "Save Changes")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
