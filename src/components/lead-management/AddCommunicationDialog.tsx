"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
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
import { Loader2, Phone, MessageCircle, Mail, Video, Users } from "lucide-react";
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

const communicationFormSchema = z.object({
  communication_method_id: z.string().min(1, "Please select a communication method"),
  scheduled_at: z.string().min(1, "Please select a date and time"),
  notes: z.string().optional(),
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
    },
  });

  // Fetch communication methods when dialog opens
  useEffect(() => {
    if (open) {
      fetchMethods();
      form.reset({
        communication_method_id: preSelectedMethodId || "",
        scheduled_at: new Date().toISOString().slice(0, 16),
        notes: "",
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
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/lead-management/leads/${leadId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communication_method_id: data.communication_method_id,
          scheduled_at: new Date(data.scheduled_at).toISOString(),
          notes: data.notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add communication");
      }

      toast.success(t("communicationAdded"));
      onOpenChange(false);
      onSuccess?.();
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
          <DialogTitle>{t("addCommunication")}</DialogTitle>
          <DialogDescription>
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
                  <FormLabel>{t("communicationMethod")} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingMethods ? t("loading") : t("selectMethod")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingMethods ? (
                        <div className="p-2 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : methods.length === 0 ? (
                        <div className="p-2 text-center text-sm text-muted-foreground">
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("dateTime")} *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("communicationNotesPlaceholder")}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
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
