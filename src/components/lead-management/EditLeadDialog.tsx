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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Edit3 } from "lucide-react";
import { Lead } from "./LeadTable";
import { LeadStatus } from "./LeadStatusBadge";
import { supabase } from "@/integrations/supabase/client";

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
}

interface Salesperson {
  user_id: string;
  full_name: string;
}

type LeadFormValues = {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  lead_type: "individual" | "corporate";
  source_id: string;
  notes?: string;
  status: LeadStatus;
  assigned_to?: string;
};

interface EditLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: LeadFormValues) => Promise<void>;
  isSalesperson?: boolean;
}

export function EditLeadDialog({
  lead,
  open,
  onOpenChange,
  onSubmit,
  isSalesperson = false,
}: EditLeadDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loadingSalespeople, setLoadingSalespeople] = useState(false);
  // Additional co-assignees (beyond the primary in `assigned_to`)
  const [additionalAssignees, setAdditionalAssignees] = useState<string[]>([]);

  // Different schema for salesperson (only notes and status)
  const leadFormSchema = isSalesperson
    ? z.object({
        full_name: z.string(),
        email: z.string(),
        phone: z.string(),
        company_name: z.string(),
        lead_type: z.enum(["individual", "corporate"]),
        source_id: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["not_started", "contacted", "consultation", "consultation_completed", "meeting", "hold", "qualified", "negotiation", "pending", "drafting", "won", "lost"]),
        assigned_to: z.string().optional(),
      })
    : z.object({
        full_name: z.string().min(2, t("nameMin")),
        email: z.string().min(1, t("emailRequired")).email(t("invalidEmail")),
        phone: z.string().min(1, t("phoneRequired")).regex(
          /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
          t("invalidPhone")
        ),
        company_name: z.string().optional(),
        lead_type: z.enum(["individual", "corporate"]),
        source_id: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["not_started", "contacted", "consultation", "consultation_completed", "meeting", "hold", "qualified", "negotiation", "pending", "drafting", "won", "lost"]),
        assigned_to: z.string().optional(),
      });

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: "not_started", label: t("notStarted") },
    { value: "contacted", label: t("contacted") },
    { value: "consultation", label: t("consultation") },
    { value: "consultation_completed", label: t("consultationCompleted", "Consultation Completed") },
    { value: "meeting", label: t("meeting") },
    { value: "hold", label: t("hold") },
    { value: "qualified", label: t("qualified") },
    { value: "negotiation", label: t("negotiation") },
    { value: "drafting", label: t("drafting", "Drafting") },
    { value: "pending", label: t("pending") },
    { value: "won", label: t("won") },
    { value: "lost", label: t("lost") },
    { value: "unreachable", label: t("unreachable") },
  ];

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      company_name: "",
      lead_type: "individual",
      source_id: "",
      notes: "",
      status: "not_started",
      assigned_to: "",
    },
  });

  // Fetch sources when dialog opens
  useEffect(() => {
    if (open) {
      fetchSources();
    }
  }, [open]);

  // Update form when lead changes
  useEffect(() => {
    if (lead) {
      form.reset({
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone || "",
        company_name: lead.company_name || "",
        lead_type: lead.lead_type === "corporate" ? "corporate" : "individual",
        source_id: lead.source_id || "",
        notes: lead.notes || "",
        status: lead.status,
        assigned_to: lead.assigned_to || "",
      });
      // Fetch all salespeople so any of them can be assigned (primary or co-assignee)
      if (!isSalesperson) {
        fetchAllSalespeople();
        loadAdditionalAssignees(lead.id, lead.assigned_to || null);
      }
    }
  }, [lead, form, isSalesperson]);

  const loadAdditionalAssignees = async (
    leadId: string,
    primaryId: string | null
  ) => {
    try {
      const { data } = await (supabase as any)
        .from("lead_assignments")
        .select("salesperson_id")
        .eq("lead_id", leadId);
      const ids = ((data || []) as { salesperson_id: string }[])
        .map((a) => a.salesperson_id)
        .filter((sid) => sid !== primaryId);
      setAdditionalAssignees(ids);
    } catch (error) {
      console.error("Error loading co-assignees:", error);
      setAdditionalAssignees([]);
    }
  };

  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("id, name, is_active")
        .order("name");

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error("Error fetching sources:", error);
    } finally {
      setLoadingSources(false);
    }
  };

  // Fetch ALL salespeople (any salesperson can be assigned as primary or
  // co-assignee, regardless of the lead's source).
  const fetchAllSalespeople = async () => {
    setLoadingSalespeople(true);
    try {
      const { data: roleRows, error: roleError } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("role", "salesperson");

      if (roleError) throw roleError;

      const salespersonIds = ((roleRows || []) as { user_id: string }[]).map(
        (r) => r.user_id
      );

      if (salespersonIds.length === 0) {
        setSalespeople([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", salespersonIds);

      if (profileError) throw profileError;
      setSalespeople(
        (profiles || []).map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name || "",
        }))
      );
    } catch (error) {
      console.error("Error fetching salespeople:", error);
      setSalespeople([]);
    } finally {
      setLoadingSalespeople(false);
    }
  };

  const handleSubmit = async (data: LeadFormValues) => {
    if (!lead) return;
    setIsSubmitting(true);
    try {
      // Build the full assignee list: primary first, then additional co-assignees.
      const combinedAssignees = Array.from(
        new Set(
          [data.assigned_to, ...additionalAssignees].filter(Boolean) as string[]
        )
      );

      // Assignment changed if the primary changed or the co-assignee set differs.
      const assignmentChanged =
        combinedAssignees.length > 0 &&
        (data.assigned_to !== lead.assigned_to || additionalAssignees.length > 0);

      // First, update the lead data (excluding assigned_to which is handled separately)
      const { assigned_to, ...leadData } = data;
      await onSubmit(lead.id, leadData as LeadFormValues);

      // If assignment changed, call the assign API with the full list
      if (assignmentChanged && !isSalesperson) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const response = await fetch(`/api/lead-management/leads/${lead.id}/assign`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ salesperson_ids: combinedAssignees }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to reassign lead");
        }
      }

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-[#C6A03B]" />
            <span className="text-[hsl(var(--jw-primary-green))]">{t("editLead")}</span>
          </DialogTitle>
          <DialogDescription className="ltr:ml-7 rtl:mr-7">
            {t("editLeadDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {isSalesperson ? (
              // Salesperson view - read-only lead info + editable notes/status
              <>
                <div className="bg-[#FAFAF8] p-4 rounded-md space-y-2 border border-[#E6E6E4]">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-[#777777]">{t("fullName")}:</span>
                      <p className="font-medium text-[#222222]">{lead?.full_name}</p>
                    </div>
                    <div>
                      <span className="text-[#777777]">{t("email")}:</span>
                      <p className="font-medium text-[#222222]">{lead?.email}</p>
                    </div>
                    <div>
                      <span className="text-[#777777]">{t("phone")}:</span>
                      <p className="font-medium text-[#222222]">{lead?.phone || "-"}</p>
                    </div>
                    <div>
                      <span className="text-[#777777]">{t("company")}:</span>
                      <p className="font-medium text-[#222222]">{lead?.company_name || "-"}</p>
                    </div>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#555555]">{t("status")} <span className="text-[#C0392B]">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                            <SelectValue placeholder={t("selectStatus")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          placeholder={t("additionalNotes")}
                          className="resize-none border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[#C0392B]" />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              // Full edit view for lead managers
              <>
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#555555]">{t("fullName")} <span className="text-[#C0392B]">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Doe" 
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#555555]">{t("email")} <span className="text-[#C0392B]">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="john@example.com" 
                          className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-[#C0392B]" />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#555555]">{t("phone")} <span className="text-[#C0392B]">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+971 50 123 4567" 
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
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#555555]">{t("company")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t("company")} 
                            className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage className="text-[#C0392B]" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="lead_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#555555]">{t("leadType")} <span className="text-[#C0392B]">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSalesperson}>
                        <FormControl>
                          <SelectTrigger className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="individual">{t("individual")}</SelectItem>
                          <SelectItem value="corporate">{t("corporate")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[#C0392B]" />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="source_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#555555]">{t("source")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                              <SelectValue placeholder={loadingSources ? t("loadingSources") : t("selectSource")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingSources ? (
                              <div className="p-2 text-center text-sm text-[#999999]">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto text-[#C6A03B]" />
                              </div>
                            ) : sources.length === 0 ? (
                              <div className="p-2 text-center text-sm text-[#999999]">
                                {t("noSourcesAvailable")}
                              </div>
                            ) : (
                              sources.map((source) => (
                                <SelectItem key={source.id} value={source.id}>
                                  {source.name}
                                  {!source.is_active && " (inactive)"}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[#C0392B]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#555555]">{t("status")} <span className="text-[#C0392B]">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                              <SelectValue placeholder={t("selectStatus")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[#C0392B]" />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Salesperson Assignment */}
                {!isSalesperson && (
                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#555555]">{t("assignedTo")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                              <SelectValue placeholder={loadingSalespeople ? t("loadingSalespeople") : t("selectSalesperson")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingSalespeople ? (
                              <div className="p-2 text-center text-sm text-[#999999]">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto text-[#C6A03B]" />
                              </div>
                            ) : salespeople.length === 0 ? (
                              <div className="p-2 text-center text-sm text-[#999999]">
                                {t("noSalespersonAssigned")}
                              </div>
                            ) : (
                              salespeople.map((sp) => (
                                <SelectItem key={sp.user_id} value={sp.user_id}>
                                  {sp.full_name}
                                  {sp.user_id === lead?.assigned_to && " (current)"}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[#C0392B]" />
                      </FormItem>
                    )}
                  />
                )}
                {!isSalesperson && salespeople.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#555555]">
                      {t("additionalAssignees", "Additional Assignees")}
                    </p>
                    <div className="rounded-md border border-[#E6E6E4] p-3 space-y-2 max-h-40 overflow-y-auto">
                      {salespeople
                        .filter((sp) => sp.user_id !== form.watch("assigned_to"))
                        .map((sp) => {
                          const checked = additionalAssignees.includes(sp.user_id);
                          return (
                            <label
                              key={sp.user_id}
                              className="flex items-center gap-2 cursor-pointer text-sm text-[#555555]"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  setAdditionalAssignees((prev) =>
                                    prev.includes(sp.user_id)
                                      ? prev.filter((x) => x !== sp.user_id)
                                      : [...prev, sp.user_id]
                                  )
                                }
                              />
                              <span>{sp.full_name}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
                {isSalesperson && lead?.assigned_user?.full_name && (
                  <div className="text-sm text-[#555555] bg-[#FAFAF8] p-3 rounded-md border border-[#E6E6E4]">
                    <span className="font-medium">{t("assignedTo")}:</span>{" "}
                    {lead.assigned_user.full_name}
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#555555]">{t("notes")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("additionalNotes")}
                          className="resize-none border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[#C0392B]" />
                    </FormItem>
                  )}
                />
              </>
            )}
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
                {t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
