"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getLeaveTypeIcon, ICON_OPTIONS } from "@/lib/leave-type-icons";
import {
  Plus,
  Edit2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Settings2,
  Archive,
  ArchiveRestore,
  CheckCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeaveType {
  id: string;
  slug: string;
  name: string;
  icon_name: string;
  color_class: string;
  bg_color_class: string;
  tracks_balance: boolean;
  balance_field_prefix: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface LeaveTypeFormData {
  name: string;
  slug: string;
  icon_name: string;
  color_preset_index: number;
  tracks_balance: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: "Purple", color_class: "text-purple-600", bg_color_class: "bg-purple-100" },
  { label: "Yellow", color_class: "text-yellow-600", bg_color_class: "bg-yellow-100" },
  { label: "Orange", color_class: "text-orange-600", bg_color_class: "bg-orange-100" },
  { label: "Gray", color_class: "text-gray-600", bg_color_class: "bg-gray-100" },
  { label: "Blue", color_class: "text-blue-600", bg_color_class: "bg-blue-100" },
  { label: "Green", color_class: "text-green-600", bg_color_class: "bg-green-100" },
  { label: "Red", color_class: "text-red-600", bg_color_class: "bg-red-100" },
  { label: "Teal", color_class: "text-teal-600", bg_color_class: "bg-teal-100" },
];

const DEFAULT_FORM: LeaveTypeFormData = {
  name: "",
  slug: "",
  icon_name: "Calendar",
  color_preset_index: 0,
  tracks_balance: true,
};

/** Derive a URL-friendly slug from a human name. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Keep `balance_field_prefix` in sync with the slug.
 *
 * Balances are now stored per leave type slug in `employee_leave_balances`, so
 * this column is no longer used to build a column name. It is still maintained
 * because the legacy `leave_balances` columns (annual_*, sick_*) remain as a
 * fallback and other tooling reads the prefix.
 */
function toBalancePrefix(slug: string): string {
  return slug.replace(/-/g, "_");
}

/** Find the matching COLOR_PRESETS index for a given color_class, defaulting to 0. */
function findColorPresetIndex(colorClass: string): number {
  const idx = COLOR_PRESETS.findIndex((p) => p.color_class === colorClass);
  return idx >= 0 ? idx : 0;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LeaveTypesSettings() {
  const { t } = useTranslation(["hr", "common"]);
  const { toast } = useToast();

  // Data
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveTypeFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchLeaveTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error("Error fetching leave types:", error);
      toast({
        title: t("common:error"),
        description: "Failed to load leave types",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchLeaveTypes();
  }, [fetchLeaveTypes]);

  // ── Dialog helpers ───────────────────────────────────────────────────────────

  const openDialog = (leaveType?: LeaveType) => {
    if (leaveType) {
      setEditingType(leaveType);
      setForm({
        name: leaveType.name,
        slug: leaveType.slug,
        icon_name: leaveType.icon_name,
        color_preset_index: findColorPresetIndex(leaveType.color_class),
        tracks_balance: leaveType.tracks_balance,
      });
    } else {
      setEditingType(null);
      setForm({ ...DEFAULT_FORM });
    }
    setDialogOpen(true);
  };

  const handleNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      // Only auto-generate slug when creating a new leave type
      slug: editingType ? prev.slug : toSlug(value),
    }));
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: t("common:error"),
        description: t("hr:leaveTypeNameRequired", "Leave type name is required"),
        variant: "destructive",
      });
      return;
    }

    if (!form.slug.trim()) {
      toast({
        title: t("common:error"),
        description: t("hr:leaveTypeSlugRequired", "Leave type slug is required"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const preset = COLOR_PRESETS[form.color_preset_index] || COLOR_PRESETS[0];

    try {
      if (editingType) {
        // Update existing.
        // balance_field_prefix MUST be written here too: without it, turning
        // "Tracks Balance" on for a type created with it off left the prefix
        // NULL, so the badge said "Yes" while nothing was ever deducted.
        const { error } = await supabase
          .from("leave_types")
          .update({
            name: form.name.trim(),
            icon_name: form.icon_name,
            color_class: preset.color_class,
            bg_color_class: preset.bg_color_class,
            tracks_balance: form.tracks_balance,
            balance_field_prefix: form.tracks_balance
              ? toBalancePrefix(editingType.slug)
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingType.id);

        if (error) throw error;

        toast({
          title: t("common:success"),
          description: t("hr:leaveTypeUpdated", "Leave type updated successfully"),
        });
      } else {
        // Determine next sort_order
        const maxOrder = leaveTypes.reduce(
          (max, lt) => Math.max(max, lt.sort_order),
          0,
        );

        const balancePrefix = form.tracks_balance
          ? toBalancePrefix(form.slug)
          : null;

        const { error } = await supabase.from("leave_types").insert({
          name: form.name.trim(),
          slug: form.slug,
          icon_name: form.icon_name,
          color_class: preset.color_class,
          bg_color_class: preset.bg_color_class,
          tracks_balance: form.tracks_balance,
          balance_field_prefix: balancePrefix,
          is_active: true,
          sort_order: maxOrder + 10,
        });

        if (error) throw error;

        toast({
          title: t("common:success"),
          description: t("hr:leaveTypeCreated", "Leave type created successfully"),
        });
      }

      setDialogOpen(false);
      fetchLeaveTypes();
    } catch (error: unknown) {
      console.error("Error saving leave type:", error);
      const message =
        error instanceof Error && error.message.includes("duplicate")
          ? t("hr:leaveTypeSlugExists", "A leave type with this slug already exists")
          : "Failed to save leave type";
      toast({
        title: t("common:error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────────────

  const toggleActive = async (leaveType: LeaveType) => {
    try {
      const { error } = await supabase
        .from("leave_types")
        .update({
          is_active: !leaveType.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveType.id);

      if (error) throw error;

      toast({
        title: t("common:success"),
        description: leaveType.is_active
          ? t("hr:leaveTypeArchived", "Leave type archived")
          : t("hr:leaveTypeRestored", "Leave type restored"),
      });

      fetchLeaveTypes();
    } catch (error) {
      console.error("Error toggling leave type:", error);
      toast({
        title: t("common:error"),
        description: "Failed to update leave type status",
        variant: "destructive",
      });
    }
  };

  // ── Reorder ──────────────────────────────────────────────────────────────────

  const moveLeaveType = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= leaveTypes.length) return;

    const current = leaveTypes[index];
    const adjacent = leaveTypes[swapIndex];

    try {
      // Swap sort_order values
      const { error: err1 } = await supabase
        .from("leave_types")
        .update({ sort_order: adjacent.sort_order, updated_at: new Date().toISOString() })
        .eq("id", current.id);

      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from("leave_types")
        .update({ sort_order: current.sort_order, updated_at: new Date().toISOString() })
        .eq("id", adjacent.id);

      if (err2) throw err2;

      fetchLeaveTypes();
    } catch (error) {
      console.error("Error reordering leave types:", error);
      toast({
        title: t("common:error"),
        description: "Failed to reorder leave types",
        variant: "destructive",
      });
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderIconPreview = (iconName: string, colorClass: string, bgColorClass: string) => {
    const Icon = getLeaveTypeIcon(iconName);
    return (
      <span
        className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${bgColorClass}`}
      >
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </span>
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle
                  className="text-xl font-semibold text-[#0C5536]"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  {t("hr:leaveTypesManagement", "Leave Types")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7 mt-1">
                {t(
                  "hr:leaveTypesManagementDesc",
                  "Configure the leave types available to employees. Inactive types are hidden from leave requests.",
                )}
              </CardDescription>
            </div>
            <Button
              onClick={() => openDialog()}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:addLeaveType", "Add Leave Type")}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {leaveTypes.length === 0 ? (
            <div className="text-center py-12 text-[#6B6B6B]">
              <Settings2 className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">
                {t("hr:noLeaveTypes", "No leave types configured")}
              </p>
              <p className="text-sm mt-1">
                {t(
                  "hr:noLeaveTypesDesc",
                  "Add leave types to allow employees to submit leave requests",
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAF8]">
                    <TableHead className="font-semibold text-[#222222] w-12">
                      {t("hr:order", "#")}
                    </TableHead>
                    <TableHead className="font-semibold text-[#222222]">
                      {t("hr:leaveTypeName", "Name")}
                    </TableHead>
                    <TableHead className="font-semibold text-[#222222]">
                      {t("hr:slug", "Slug")}
                    </TableHead>
                    <TableHead className="font-semibold text-[#222222]">
                      {t("hr:color", "Color")}
                    </TableHead>
                    <TableHead className="font-semibold text-[#222222]">
                      {t("hr:tracksBalance", "Tracks Balance")}
                    </TableHead>
                    <TableHead className="font-semibold text-[#222222]">
                      {t("hr:evaluationStatus", "Status")}
                    </TableHead>
                    <TableHead className="font-semibold text-[#222222] text-right">
                      {t("hr:actions", "Actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveTypes.map((lt, index) => {
                    const Icon = getLeaveTypeIcon(lt.icon_name);
                    const isInactive = !lt.is_active;

                    return (
                      <TableRow
                        key={lt.id}
                        className={`hover:bg-[#FAFAF8] ${isInactive ? "opacity-50" : ""}`}
                      >
                        {/* Reorder */}
                        <TableCell>
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveLeaveType(index, "up")}
                              disabled={index === 0}
                              className="p-0.5 rounded hover:bg-[#E6E6E4] disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Move up"
                            >
                              <ArrowUp className="h-3.5 w-3.5 text-[#555555]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLeaveType(index, "down")}
                              disabled={index === leaveTypes.length - 1}
                              className="p-0.5 rounded hover:bg-[#E6E6E4] disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Move down"
                            >
                              <ArrowDown className="h-3.5 w-3.5 text-[#555555]" />
                            </button>
                          </div>
                        </TableCell>

                        {/* Name + icon */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {renderIconPreview(lt.icon_name, lt.color_class, lt.bg_color_class)}
                            <span className="font-medium text-[#222222]">{lt.name}</span>
                          </div>
                        </TableCell>

                        {/* Slug */}
                        <TableCell>
                          <code className="text-xs bg-[#F5F5F5] text-[#555555] px-2 py-1 rounded">
                            {lt.slug}
                          </code>
                        </TableCell>

                        {/* Color */}
                        <TableCell>
                          <Badge className={`${lt.bg_color_class} ${lt.color_class} border-0`}>
                            <Icon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                            {COLOR_PRESETS.find((p) => p.color_class === lt.color_class)?.label ||
                              "Custom"}
                          </Badge>
                        </TableCell>

                        {/* Tracks Balance */}
                        <TableCell>
                          {lt.tracks_balance ? (
                            <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
                              <CheckCircle className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                              {t("hr:yes", "Yes")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-[#E6E6E4] text-[#6B6B6B]">
                              {t("hr:no", "No")}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {lt.is_active ? (
                            <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
                              {t("hr:active", "Active")}
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 border-0">
                              {t("hr:inactive", "Inactive")}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDialog(lt)}
                              className="text-[#555555] hover:text-[#0C5536]"
                              title={t("hr:edit", "Edit")}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(lt)}
                              className={
                                lt.is_active
                                  ? "text-[#555555] hover:text-orange-600 hover:bg-orange-50"
                                  : "text-[#0C5536] hover:text-[#0C5536] hover:bg-[#E6F7F1]"
                              }
                              title={
                                lt.is_active
                                  ? t("hr:archive", "Archive")
                                  : t("hr:restore", "Restore")
                              }
                            >
                              {lt.is_active ? (
                                <Archive className="h-4 w-4" />
                              ) : (
                                <ArchiveRestore className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ───────────────────────────────────────────────── */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
              <Settings2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {editingType
                ? t("hr:editLeaveType", "Edit Leave Type")
                : t("hr:addLeaveType", "Add Leave Type")}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? t(
                    "hr:editLeaveTypeDesc",
                    "Update the configuration for this leave type",
                  )
                : t(
                    "hr:addLeaveTypeDesc",
                    "Create a new leave type that employees can use when requesting time off",
                  )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">
                {t("hr:leaveTypeName", "Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("hr:leaveTypeNamePlaceholder", "e.g. Annual Leave")}
                className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
            </div>

            {/* Slug */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">
                {t("hr:leaveTypeSlug", "Slug")}
              </Label>
              <Input
                value={form.slug}
                readOnly
                disabled={!!editingType}
                className="border-[#E6E6E4] bg-[#FAFAF8] text-[#6B6B6B] font-mono text-sm"
              />
              <p className="text-xs text-[#6B6B6B]">
                {t(
                  "hr:slugHelp",
                  "Auto-generated unique identifier. Cannot be changed after creation.",
                )}
              </p>
            </div>

            {/* Icon */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">{t("hr:icon", "Icon")}</Label>
              <div className="flex items-center gap-3">
                <Select
                  value={form.icon_name}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, icon_name: v }))}
                >
                  <SelectTrigger className="border-[#E6E6E4] flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => {
                      const OptIcon = getLeaveTypeIcon(opt.value);
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <OptIcon className="h-4 w-4 text-[#555555]" />
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {/* Live preview */}
                {renderIconPreview(
                  form.icon_name,
                  COLOR_PRESETS[form.color_preset_index]?.color_class ?? "text-gray-600",
                  COLOR_PRESETS[form.color_preset_index]?.bg_color_class ?? "bg-gray-100",
                )}
              </div>
            </div>

            {/* Color theme */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">
                {t("hr:colorTheme", "Color Theme")}
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset, idx) => {
                  const isSelected = form.color_preset_index === idx;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, color_preset_index: idx }))
                      }
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-[#0C5536] bg-[#E6F7F1] ring-1 ring-[#0C5536]"
                          : "border-[#E6E6E4] hover:bg-[#FAFAF8]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded ${preset.bg_color_class} border border-black/10`}
                      >
                        <span
                          className={`block h-full w-full rounded ${preset.color_class.replace(
                            "text-",
                            "bg-",
                          )}`}
                        />
                      </span>
                      <span className="text-[#222222]">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tracks Balance toggle */}
            <div className="flex items-center justify-between p-4 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
              <div className="space-y-0.5">
                <Label className="text-base font-medium text-[#222222]">
                  {t("hr:tracksBalance", "Tracks Balance")}
                </Label>
                <p className="text-sm text-[#6B6B6B]">
                  {t(
                    "hr:tracksBalanceDesc",
                    "When enabled, this leave type deducts from the employee's available balance",
                  )}
                </p>
              </div>
              <Switch
                checked={form.tracks_balance}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, tracks_balance: checked }))
                }
              />
            </div>
            {form.tracks_balance && (
              <p className="text-xs text-[#6B6B6B] -mt-3">
                {t(
                  "hr:tracksBalanceEntitlementHint",
                  "Set each employee's entitlement for this type under Leave → Balances → Edit.",
                )}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-[#E6E6E4]"
            >
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                  {t("common:saving")}
                </>
              ) : (
                t("common:save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
