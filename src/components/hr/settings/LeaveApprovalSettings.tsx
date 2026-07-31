"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import {
  GitBranch,
  Users,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  UserCheck,
  Shield,
  Building2,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { useLeaveTypes } from "@/hooks/useLeaveTypes";
import { getLeaveTypeIcon } from "@/lib/leave-type-icons";
import { format, isAfter, isBefore, isToday, parseISO } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";

interface ApprovalRule {
  id: string;
  leave_type: string | null;
  min_days: number;
  max_days: number | null;
  requires_manager_approval: boolean;
  requires_hr_approval: boolean;
  requires_director_approval: boolean;
  escalation_days: number;
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface ApprovalDelegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  delegator_name?: string;
  delegate_name?: string;
  start_date: string;
  end_date: string;
  leave_types: string[] | null;
  max_days: number | null;
  is_active: boolean;
  reason: string | null;
  created_at: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export function LeaveApprovalSettings() {
  const { t } = useTranslation(["hr", "common"]);
  const { leaveTypes: leaveTypesList, getBySlug } = useLeaveTypes();
  const { toast } = useToast();
  const { canPerform } = usePermissions();

  // Check if user can manage leave rules (head-only operation for HR)
  const canManageLeaveRules = canPerform("hr", "manage_leave_rules");

  // State
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [delegations, setDelegations] = useState<ApprovalDelegation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    leave_type: "all",
    min_days: 1,
    max_days: "",
    requires_manager_approval: true,
    requires_hr_approval: true,
    requires_director_approval: false,
    escalation_days: 3,
    priority: 100,
    is_active: true,
  });
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Delegation dialog state
  const [delegationDialogOpen, setDelegationDialogOpen] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<ApprovalDelegation | null>(null);
  const [delegationForm, setDelegationForm] = useState({
    delegate_id: "",
    start_date: "",
    end_date: "",
    leave_types: [] as string[],
    max_days: "",
    reason: "",
    is_active: true,
  });
  const [isSavingDelegation, setIsSavingDelegation] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch approval rules
      const { data: rulesData, error: rulesError } = await supabase
        .from("leave_approval_rules")
        .select("*")
        .order("priority", { ascending: true });

      if (rulesError) throw rulesError;
      setRules(rulesData || []);

      // Fetch delegations with user names
      const { data: delegationsData, error: delegationsError } = await supabase
        .from("leave_approval_delegations")
        .select("*")
        .order("created_at", { ascending: false });

      if (delegationsError) throw delegationsError;

      // Get user profiles for delegation names
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      const profileMap = new Map((profilesData || []).map(p => [p.user_id, p]));

      const delegationsWithNames = (delegationsData || []).map(d => ({
        ...d,
        delegator_name: profileMap.get(d.delegator_id)?.full_name || "Unknown",
        delegate_name: profileMap.get(d.delegate_id)?.full_name || "Unknown",
      }));

      setDelegations(delegationsWithNames);

      // Fetch users for dropdown
      setUsers((profilesData || []).map(p => ({
        id: p.user_id,
        full_name: p.full_name || "Unknown",
        email: "",
      })));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: t("common:error"),
        description: "Failed to load approval settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Rule handlers
  const openRuleDialog = (rule?: ApprovalRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        leave_type: rule.leave_type || "all",
        min_days: rule.min_days,
        max_days: rule.max_days?.toString() || "",
        requires_manager_approval: rule.requires_manager_approval,
        requires_hr_approval: rule.requires_hr_approval,
        requires_director_approval: rule.requires_director_approval,
        escalation_days: rule.escalation_days,
        priority: rule.priority,
        is_active: rule.is_active,
      });
    } else {
      setEditingRule(null);
      setRuleForm({
        leave_type: "all",
        min_days: 1,
        max_days: "",
        requires_manager_approval: true,
        requires_hr_approval: true,
        requires_director_approval: false,
        escalation_days: 3,
        priority: 100,
        is_active: true,
      });
    }
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    setIsSavingRule(true);
    try {
      const ruleData = {
        leave_type: ruleForm.leave_type === "all" ? null : ruleForm.leave_type,
        min_days: ruleForm.min_days,
        max_days: ruleForm.max_days ? parseInt(ruleForm.max_days) : null,
        requires_manager_approval: ruleForm.requires_manager_approval,
        requires_hr_approval: ruleForm.requires_hr_approval,
        requires_director_approval: ruleForm.requires_director_approval,
        escalation_days: ruleForm.escalation_days,
        priority: ruleForm.priority,
        is_active: ruleForm.is_active,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("leave_approval_rules")
          .update(ruleData)
          .eq("id", editingRule.id);

        if (error) throw error;
        toast({
          title: t("common:success"),
          description: t("hr:approvalRuleUpdated", "Approval rule updated successfully"),
        });
      } else {
        const { error } = await supabase
          .from("leave_approval_rules")
          .insert(ruleData);

        if (error) throw error;
        toast({
          title: t("common:success"),
          description: t("hr:approvalRuleCreated", "Approval rule created successfully"),
        });
      }

      setRuleDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast({
        title: t("common:error"),
        description: "Failed to save approval rule",
        variant: "destructive",
      });
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from("leave_approval_rules")
        .delete()
        .eq("id", ruleId);

      if (error) throw error;
      toast({
        title: t("common:success"),
        description: t("hr:approvalRuleDeleted", "Approval rule deleted successfully"),
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast({
        title: t("common:error"),
        description: "Failed to delete approval rule",
        variant: "destructive",
      });
    }
  };

  const toggleRuleActive = async (rule: ApprovalRule) => {
    try {
      const { error } = await supabase
        .from("leave_approval_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast({
        title: t("common:error"),
        description: "Failed to update rule status",
        variant: "destructive",
      });
    }
  };

  // Delegation handlers
  const openDelegationDialog = (delegation?: ApprovalDelegation) => {
    if (delegation) {
      setEditingDelegation(delegation);
      setDelegationForm({
        delegate_id: delegation.delegate_id,
        start_date: delegation.start_date,
        end_date: delegation.end_date,
        leave_types: delegation.leave_types || [],
        max_days: delegation.max_days?.toString() || "",
        reason: delegation.reason || "",
        is_active: delegation.is_active,
      });
    } else {
      setEditingDelegation(null);
      setDelegationForm({
        delegate_id: "",
        start_date: "",
        end_date: "",
        leave_types: [],
        max_days: "",
        reason: "",
        is_active: true,
      });
    }
    setDelegationDialogOpen(true);
  };

  const handleSaveDelegation = async () => {
    if (!delegationForm.delegate_id || !delegationForm.start_date || !delegationForm.end_date) {
      toast({
        title: t("common:error"),
        description: t("hr:fillRequiredFields", "Please fill in all required fields"),
        variant: "destructive",
      });
      return;
    }

    setIsSavingDelegation(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const delegationData = {
        delegator_id: userData.user?.id,
        delegate_id: delegationForm.delegate_id,
        start_date: delegationForm.start_date,
        end_date: delegationForm.end_date,
        leave_types: delegationForm.leave_types.length > 0 ? delegationForm.leave_types : null,
        max_days: delegationForm.max_days ? parseInt(delegationForm.max_days) : null,
        reason: delegationForm.reason || null,
        is_active: delegationForm.is_active,
      };

      if (editingDelegation) {
        const { error } = await supabase
          .from("leave_approval_delegations")
          .update(delegationData)
          .eq("id", editingDelegation.id);

        if (error) throw error;
        toast({
          title: t("common:success"),
          description: t("hr:delegationUpdated", "Delegation updated successfully"),
        });
      } else {
        const { error } = await supabase
          .from("leave_approval_delegations")
          .insert(delegationData);

        if (error) throw error;
        toast({
          title: t("common:success"),
          description: t("hr:delegationCreated", "Delegation created successfully"),
        });
      }

      setDelegationDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving delegation:", error);
      toast({
        title: t("common:error"),
        description: "Failed to save delegation",
        variant: "destructive",
      });
    } finally {
      setIsSavingDelegation(false);
    }
  };

  const handleDeleteDelegation = async (delegationId: string) => {
    try {
      const { error } = await supabase
        .from("leave_approval_delegations")
        .delete()
        .eq("id", delegationId);

      if (error) throw error;
      toast({
        title: t("common:success"),
        description: t("hr:delegationDeleted", "Delegation deleted successfully"),
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting delegation:", error);
      toast({
        title: t("common:error"),
        description: "Failed to delete delegation",
        variant: "destructive",
      });
    }
  };

  const getDelegationStatus = (delegation: ApprovalDelegation) => {
    const today = new Date();
    const start = parseISO(delegation.start_date);
    const end = parseISO(delegation.end_date);

    if (!delegation.is_active) {
      return { label: t("hr:inactive", "Inactive"), color: "bg-gray-100 text-gray-600" };
    }
    if (isBefore(end, today)) {
      return { label: t("hr:expired", "Expired"), color: "bg-red-100 text-red-600" };
    }
    if (isAfter(start, today)) {
      return { label: t("hr:upcoming", "Upcoming"), color: "bg-blue-100 text-blue-600" };
    }
    return { label: t("hr:active", "Active"), color: "bg-green-100 text-green-600" };
  };

  const getApprovalChainDisplay = (rule: ApprovalRule) => {
    const chain: string[] = [];
    if (rule.requires_manager_approval) chain.push(t("hr:manager", "Manager"));
    if (rule.requires_hr_approval) chain.push(t("hr:hr", "HR"));
    if (rule.requires_director_approval) chain.push(t("hr:director", "Director"));
    return chain;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t("hr:approvalRules", "Approval Rules")}
          </TabsTrigger>
          <TabsTrigger value="delegations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("hr:approvalDelegations", "Delegations")}
          </TabsTrigger>
        </TabsList>

        {/* Approval Rules Tab */}
        <TabsContent value="rules" className="space-y-6">
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("hr:approvalChainRules", "Approval Chain Rules")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7 mt-1">
                    {t("hr:approvalChainRulesDesc", "Configure multi-level approval workflows based on leave type and duration")}
                  </CardDescription>
                </div>
                {canManageLeaveRules && (
                  <Button
                    onClick={() => openRuleDialog()}
                    className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                  >
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("hr:addRule", "Add Rule")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-12 text-[#6B6B6B]">
                  <GitBranch className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
                  <p className="font-medium text-[#222222]">{t("hr:noApprovalRules", "No approval rules configured")}</p>
                  <p className="text-sm mt-1">{t("hr:noApprovalRulesDesc", "Add rules to define approval chains for leave requests")}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAFAF8]">
                        <TableHead className="font-semibold text-[#222222]">{t("hr:leaveTypeLabel")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:durationRange", "Duration")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:approvalChain", "Approval Chain")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:escalation", "Escalation")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:evaluationStatus")}</TableHead>
                        <TableHead className="font-semibold text-[#222222] text-right">{t("hr:actions", "Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule) => {
                        const chain = getApprovalChainDisplay(rule);
                        const lt = rule.leave_type ? getBySlug(rule.leave_type) : null;
                        const LeaveIcon = lt ? getLeaveTypeIcon(lt.icon_name) : CalendarDays;
                        const leaveConfig = lt ? { color: lt.color_class, label: lt.name } : null;

                        return (
                          <TableRow key={rule.id} className="hover:bg-[#FAFAF8]">
                            <TableCell>
                              {rule.leave_type ? (
                                <Badge className={`${leaveConfig?.color.replace("text", "bg").replace("600", "100")} ${leaveConfig?.color} border-0`}>
                                  <LeaveIcon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                  {leaveConfig?.label}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-[#E6E6E4]">
                                  <CalendarDays className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                  {t("hr:allLeaveTypes", "All Types")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-[#555555]">
                              {rule.min_days} - {rule.max_days || "∞"} {t("hr:days")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                {chain.map((step, idx) => (
                                  <span key={step} className="flex items-center">
                                    <Badge variant="outline" className="border-[#C6A03B]/30 bg-[#FFF9E6] text-[#8B6914] text-xs">
                                      {step}
                                    </Badge>
                                    {idx < chain.length - 1 && (
                                      <ArrowRight className="h-3 w-3 mx-1 text-[#999999]" />
                                    )}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-[#555555]">
                              {rule.escalation_days} {t("hr:days")}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={() => toggleRuleActive(rule)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              {canManageLeaveRules && (
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openRuleDialog(rule)}
                                    className="text-[#555555] hover:text-[#0C5536]"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="text-[#C0392B] hover:text-[#C0392B] hover:bg-[#FEECEC]"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
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

          {/* Info Card */}
          <Card className="border-[#E6E6E4] bg-[#F8F6EC]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-[#C6A03B] mt-0.5" />
                <div>
                  <p className="font-medium text-[#222222] mb-1">{t("hr:howApprovalWorks", "How Approval Chains Work")}</p>
                  <ul className="text-sm text-[#6B6B6B] space-y-1 list-disc ltr:ml-4 rtl:mr-4">
                    <li>{t("hr:approvalInfo1", "Rules are matched by leave type and duration (most specific match wins)")}</li>
                    <li>{t("hr:approvalInfo2", "Each approval step must be completed before moving to the next")}</li>
                    <li>{t("hr:approvalInfo3", "If no response within the escalation period, the request auto-escalates to HR")}</li>
                    <li>{t("hr:approvalInfo4", "Lower priority numbers are evaluated first when multiple rules match")}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delegations Tab */}
        <TabsContent value="delegations" className="space-y-6">
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("hr:approvalDelegations", "Approval Delegations")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7 mt-1">
                    {t("hr:approvalDelegationsDesc", "Delegate your approval authority when you're unavailable")}
                  </CardDescription>
                </div>
                <Button
                  onClick={() => openDelegationDialog()}
                  className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                >
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("hr:addDelegation", "Add Delegation")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {delegations.length === 0 ? (
                <div className="text-center py-12 text-[#6B6B6B]">
                  <Users className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
                  <p className="font-medium text-[#222222]">{t("hr:noDelegations", "No delegations configured")}</p>
                  <p className="text-sm mt-1">{t("hr:noDelegationsDesc", "Set up a delegation when you'll be away")}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAFAF8]">
                        <TableHead className="font-semibold text-[#222222]">{t("hr:delegatedTo", "Delegated To")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:historyPeriod")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:scope", "Scope")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:evaluationStatus")}</TableHead>
                        <TableHead className="font-semibold text-[#222222] text-right">{t("hr:actions", "Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {delegations.map((delegation) => {
                        const status = getDelegationStatus(delegation);

                        return (
                          <TableRow key={delegation.id} className="hover:bg-[#FAFAF8]">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-[hsl(var(--jw-primary-green))]">
                                    {delegation.delegate_name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </span>
                                </div>
                                <span className="font-medium text-[#222222]">{delegation.delegate_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-[#555555]">
                              {format(parseISO(delegation.start_date), "MMM d")} - {format(parseISO(delegation.end_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              {delegation.leave_types && delegation.leave_types.length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {delegation.leave_types.map(type => (
                                    <Badge key={type} variant="outline" className="text-xs border-[#E6E6E4]">
                                      {getBySlug(type)?.name || type}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Badge variant="outline" className="border-[#E6E6E4]">
                                  {t("hr:allLeaveTypes", "All Types")}
                                </Badge>
                              )}
                              {delegation.max_days && (
                                <span className="text-xs text-[#6B6B6B] ml-2">
                                  (≤{delegation.max_days} {t("hr:days")})
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${status.color} border-0`}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDelegationDialog(delegation)}
                                  className="text-[#555555] hover:text-[#0C5536]"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDelegation(delegation.id)}
                                  className="text-[#C0392B] hover:text-[#C0392B] hover:bg-[#FEECEC]"
                                >
                                  <Trash2 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
              <GitBranch className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {editingRule ? t("hr:editApprovalRule", "Edit Approval Rule") : t("hr:addApprovalRule", "Add Approval Rule")}
            </DialogTitle>
            <DialogDescription>
              {t("hr:approvalRuleDialogDesc", "Configure when and who should approve leave requests")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Leave Type */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">{t("hr:leaveTypeLabel")}</Label>
              <Select value={ruleForm.leave_type} onValueChange={(v) => setRuleForm({ ...ruleForm, leave_type: v })}>
                <SelectTrigger className="border-[#E6E6E4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("hr:allLeaveTypes", "All Leave Types")}</SelectItem>
                  {leaveTypesList.map((lt) => {
                    const Icon = getLeaveTypeIcon(lt.icon_name);
                    return (
                      <SelectItem key={lt.slug} value={lt.slug}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${lt.color_class}`} />
                          {lt.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Duration Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[#555555]">{t("hr:minDays", "Min Days")}</Label>
                <Input
                  type="number"
                  min="1"
                  value={ruleForm.min_days ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setRuleForm({ ...ruleForm, min_days: raw === "" ? (null as unknown as number) : parseInt(raw, 10) });
                  }}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setRuleForm((f) => ({ ...f, min_days: Number.isFinite(n) ? Math.max(1, n) : 1 }));
                  }}
                  className="border-[#E6E6E4]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[#555555]">{t("hr:maxDays", "Max Days")} ({t("hr:optional", "optional")})</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="∞"
                  value={ruleForm.max_days}
                  onChange={(e) => setRuleForm({ ...ruleForm, max_days: e.target.value })}
                  className="border-[#E6E6E4]"
                />
              </div>
            </div>

            {/* Approval Chain */}
            <div className="grid gap-3">
              <Label className="text-[#555555]">{t("hr:approvalChain", "Approval Chain")}</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-[#C6A03B]" />
                    <span className="text-sm text-[#222222]">{t("hr:managerApproval", "Manager Approval")}</span>
                  </div>
                  <Switch
                    checked={ruleForm.requires_manager_approval}
                    onCheckedChange={(checked) => setRuleForm({ ...ruleForm, requires_manager_approval: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#C6A03B]" />
                    <span className="text-sm text-[#222222]">{t("hr:hrApproval", "HR Approval")}</span>
                  </div>
                  <Switch
                    checked={ruleForm.requires_hr_approval}
                    onCheckedChange={(checked) => setRuleForm({ ...ruleForm, requires_hr_approval: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#C6A03B]" />
                    <span className="text-sm text-[#222222]">{t("hr:directorApproval", "Director Approval")}</span>
                  </div>
                  <Switch
                    checked={ruleForm.requires_director_approval}
                    onCheckedChange={(checked) => setRuleForm({ ...ruleForm, requires_director_approval: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Escalation & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[#555555]">{t("hr:escalationDays", "Escalation After (days)")}</Label>
                <Select value={String(ruleForm.escalation_days)} onValueChange={(v) => setRuleForm({ ...ruleForm, escalation_days: parseInt(v) })}>
                  <SelectTrigger className="border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 7].map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {days} {t("hr:days")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-[#555555]">{t("hr:priority", "Priority")}</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={ruleForm.priority ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setRuleForm({ ...ruleForm, priority: raw === "" ? (null as unknown as number) : parseInt(raw, 10) });
                  }}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setRuleForm((f) => ({ ...f, priority: Number.isFinite(n) ? Math.max(0, n) : 100 }));
                  }}
                  className="border-[#E6E6E4]"
                />
                <p className="text-xs text-[#6B6B6B]">{t("hr:priorityDesc", "Lower = higher priority")}</p>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#E6F7F1] rounded-lg border border-[#0C5536]/20">
              <span className="text-sm font-medium text-[#0C5536]">{t("hr:ruleActive", "Rule Active")}</span>
              <Switch
                checked={ruleForm.is_active}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)} className="border-[#E6E6E4]">
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={isSavingRule}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {isSavingRule ? (
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

      {/* Delegation Dialog */}
      <Dialog open={delegationDialogOpen} onOpenChange={setDelegationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
              <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {editingDelegation ? t("hr:editDelegation", "Edit Delegation") : t("hr:addDelegation", "Add Delegation")}
            </DialogTitle>
            <DialogDescription>
              {t("hr:delegationDialogDesc", "Delegate your approval authority to another user")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Delegate Selection */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">{t("hr:delegateTo", "Delegate To")} <span className="text-red-500">*</span></Label>
              <Select value={delegationForm.delegate_id} onValueChange={(v) => setDelegationForm({ ...delegationForm, delegate_id: v })}>
                <SelectTrigger className="border-[#E6E6E4]">
                  <SelectValue placeholder={t("hr:selectUser", "Select a user")} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[#555555]">{t("hr:startDate", "Start Date")} <span className="text-red-500">*</span></Label>
                <DatePicker
                  date={delegationForm.start_date ? new Date(delegationForm.start_date + "T00:00:00") : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      setDelegationForm({ ...delegationForm, start_date: `${year}-${month}-${day}` });
                    } else {
                      setDelegationForm({ ...delegationForm, start_date: "" });
                    }
                  }}
                  placeholder={t("hr:startDate", "Start Date")}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[#555555]">{t("hr:endDate", "End Date")} <span className="text-red-500">*</span></Label>
                <DatePicker
                  date={delegationForm.end_date ? new Date(delegationForm.end_date + "T00:00:00") : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      setDelegationForm({ ...delegationForm, end_date: `${year}-${month}-${day}` });
                    } else {
                      setDelegationForm({ ...delegationForm, end_date: "" });
                    }
                  }}
                  placeholder={t("hr:endDate", "End Date")}
                  className="w-full"
                />
              </div>
            </div>

            {/* Leave Types Scope */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">{t("hr:leaveTypesScope", "Leave Types (optional)")}</Label>
              <p className="text-xs text-[#6B6B6B] mb-2">{t("hr:leaveTypesScopeDesc", "Leave empty to delegate all types")}</p>
              <div className="flex flex-wrap gap-2">
                {leaveTypesList.map((lt) => {
                  const Icon = getLeaveTypeIcon(lt.icon_name);
                  const isSelected = delegationForm.leave_types.includes(lt.slug);
                  return (
                    <Button
                      key={lt.slug}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isSelected) {
                          setDelegationForm({
                            ...delegationForm,
                            leave_types: delegationForm.leave_types.filter(t => t !== lt.slug),
                          });
                        } else {
                          setDelegationForm({
                            ...delegationForm,
                            leave_types: [...delegationForm.leave_types, lt.slug],
                          });
                        }
                      }}
                      className={isSelected
                        ? "bg-[hsl(var(--jw-primary-green))] text-white"
                        : "border-[#E6E6E4]"
                      }
                    >
                      <Icon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                      {lt.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Max Days */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">{t("hr:maxDaysScope", "Max Days (optional)")}</Label>
              <Input
                type="number"
                min="1"
                placeholder={t("hr:unlimited", "Unlimited")}
                value={delegationForm.max_days}
                onChange={(e) => setDelegationForm({ ...delegationForm, max_days: e.target.value })}
                className="border-[#E6E6E4]"
              />
              <p className="text-xs text-[#6B6B6B]">{t("hr:maxDaysScopeDesc", "Only delegate approval for requests up to this many days")}</p>
            </div>

            {/* Reason */}
            <div className="grid gap-2">
              <Label className="text-[#555555]">{t("hr:reasonLabel")} ({t("hr:optional", "optional")})</Label>
              <Textarea
                placeholder={t("hr:delegationReasonPlaceholder", "e.g., Vacation, Business Trip")}
                value={delegationForm.reason}
                onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })}
                rows={2}
                className="border-[#E6E6E4]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegationDialogOpen(false)} className="border-[#E6E6E4]">
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleSaveDelegation}
              disabled={isSavingDelegation}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {isSavingDelegation ? (
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
