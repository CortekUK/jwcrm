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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Megaphone } from "lucide-react";
import { LeadSource } from "./SourcesTable";

interface Salesperson {
  user_id: string;
  full_name: string;
}

interface EditSourceDialogProps {
  source: LeadSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: { name: string; description?: string; is_active: boolean; salesperson_ids: string[] }) => Promise<void>;
}

export function EditSourceDialog({
  source,
  open,
  onOpenChange,
  onSubmit,
}: EditSourceDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSalespeople, setAvailableSalespeople] = useState<Salesperson[]>([]);
  const [selectedSalespeople, setSelectedSalespeople] = useState<string[]>([]);
  const [loadingSalespeople, setLoadingSalespeople] = useState(false);

  const sourceFormSchema = z.object({
    name: z.string().min(1, t("sourceNameRequired")),
    description: z.string().optional(),
    is_active: z.boolean(),
  });

  type SourceFormValues = z.infer<typeof sourceFormSchema>;

  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      is_active: true,
    },
  });

  // Update form when source changes
  useEffect(() => {
    if (source) {
      form.reset({
        name: source.name,
        description: source.description || "",
        is_active: source.is_active,
      });
      // Set currently assigned salespeople
      setSelectedSalespeople(source.salespeople.map((sp) => sp.user_id));
    }
  }, [source, form]);

  // Fetch available salespeople when dialog opens
  useEffect(() => {
    if (open && source) {
      fetchAvailableSalespeople(source.id);
    }
  }, [open, source]);

  const fetchAvailableSalespeople = async (sourceId: string) => {
    setLoadingSalespeople(true);
    try {
      const response = await fetch(
        `/api/lead-management/sources/available-salespeople?exclude_source_id=${sourceId}`
      );
      if (response.ok) {
        const { data } = await response.json();
        // Combine available salespeople with currently assigned ones
        const currentlyAssigned = source?.salespeople || [];
        const combined = [
          ...currentlyAssigned,
          ...(data || []).filter(
            (sp: Salesperson) => !currentlyAssigned.some((c) => c.user_id === sp.user_id)
          ),
        ];
        setAvailableSalespeople(combined);
      }
    } catch (error) {
      console.error("Error fetching salespeople:", error);
    } finally {
      setLoadingSalespeople(false);
    }
  };

  const toggleSalesperson = (userId: string) => {
    setSelectedSalespeople((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (data: SourceFormValues) => {
    if (!source) return;
    setIsSubmitting(true);
    try {
      await onSubmit(source.id, {
        name: data.name,
        description: data.description,
        is_active: data.is_active,
        salesperson_ids: selectedSalespeople,
      });
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
            <Megaphone className="h-5 w-5 text-[#C6A03B]" />
            <span className="text-[hsl(var(--jw-primary-green))]">{t("editSource")}</span>
          </DialogTitle>
          <DialogDescription className="ltr:ml-7 rtl:mr-7">
            {t("editSourceDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#555555]">{t("sourceName")} <span className="text-[#C0392B]">*</span></FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("sourceNamePlaceholder")} 
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#555555]">{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("sourceDescriptionPlaceholder")}
                      className="resize-none border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[#C0392B]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#E6E6E4] p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-[#555555]">{t("sourceActive")}</FormLabel>
                    <p className="text-xs text-[#777777]">
                      {t("sourceActiveDescription")}
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-[hsl(var(--jw-primary-green))]"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Salespeople Selection */}
            <div className="space-y-2">
              <Label className="text-[#555555]">{t("assignSalespeople")}</Label>
              {loadingSalespeople ? (
                <div className="p-4 text-center text-sm text-[#999999]">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2 text-[#C6A03B]" />
                  {t("loadingSalespeople")}
                </div>
              ) : availableSalespeople.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#999999] border border-[#E6E6E4] rounded-md">
                  {t("noAvailableSalespeople")}
                </div>
              ) : (
                <div className="border border-[#E6E6E4] rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                  {availableSalespeople.map((sp) => (
                    <div
                      key={sp.user_id}
                      className="flex items-center space-x-2 hover:bg-[#FAFAF8] p-1 rounded"
                    >
                      <Checkbox
                        id={`edit-sp-${sp.user_id}`}
                        checked={selectedSalespeople.includes(sp.user_id)}
                        onCheckedChange={() => toggleSalesperson(sp.user_id)}
                        className="data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:border-[hsl(var(--jw-primary-green))]"
                      />
                      <label
                        htmlFor={`edit-sp-${sp.user_id}`}
                        className="text-sm cursor-pointer flex-1 text-[#555555]"
                      >
                        {sp.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-[#777777]">
                {t("salespeopleAssignmentNote")}
              </p>
            </div>

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
