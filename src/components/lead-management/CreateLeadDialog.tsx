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
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
}

type LeadFormValues = {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  source_id: string;
  notes?: string;
};

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: LeadFormValues) => Promise<void>;
}

export function CreateLeadDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateLeadDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  const leadFormSchema = z.object({
    full_name: z.string().min(2, t("nameMin")),
    email: z.string().min(1, t("emailRequired")).email(t("invalidEmail")),
    phone: z.string().min(1, t("phoneRequired")).regex(
      /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
      t("invalidPhone")
    ),
    company_name: z.string().min(1, t("companyRequired")),
    source_id: z.string().min(1, t("sourceRequired")),
    notes: z.string().optional(),
  });

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      company_name: "",
      source_id: "",
      notes: "",
    },
  });

  // Fetch sources when dialog opens
  useEffect(() => {
    if (open) {
      fetchSources();
    } else {
      form.reset();
    }
  }, [open]);

  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error("Error fetching sources:", error);
    } finally {
      setLoadingSources(false);
    }
  };

  const handleSubmit = async (data: LeadFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("createNewLead")}</DialogTitle>
          <DialogDescription>
            {t("createLeadDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fullName")} *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("email")} *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")} *</FormLabel>
                    <FormControl>
                      <Input placeholder="+971 50 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("company")} *</FormLabel>
                    <FormControl>
                      <Input placeholder={t("company")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="source_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("source")} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingSources ? t("loadingSources") : t("selectSource")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingSources ? (
                        <div className="p-2 text-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : sources.length === 0 ? (
                        <div className="p-2 text-center text-sm text-muted-foreground">
                          {t("noSourcesAvailable")}
                        </div>
                      ) : (
                        sources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("additionalNotes")}
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
              <Button type="submit" disabled={isSubmitting || sources.length === 0}>
                {isSubmitting && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                {t("createLead")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
