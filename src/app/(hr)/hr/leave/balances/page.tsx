"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Users,
  Plane,
  Thermometer,
  Edit,
  ArrowLeft,
  AlertTriangle,
  History,
  Wallet,
  UserPlus,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmployeeBalance {
  employee_id: string;
  employee_name: string;
  department_name: string | null;
  balance_id: string | null;
  annual_entitled: number;
  annual_used: number;
  annual_pending: number;
  annual_remaining: number;
  sick_entitled: number;
  sick_used: number;
  sick_remaining: number;
}

export default function LeaveBalancesPage() {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const currentYear = new Date().getFullYear();

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<EmployeeBalance | null>(null);
  const [annualEntitled, setAnnualEntitled] = useState(30);
  const [sickEntitled, setSickEntitled] = useState(90);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all active employees
      const { data: employeesData } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          departments(name)
        `)
        .eq("employment_status", "active")
        .order("full_name");

      // Fetch leave balances for current year
      const { data: balancesData } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("year", currentYear);

      // Map balances to employees
      const balanceMap: Record<string, any> = {};
      (balancesData || []).forEach((bal: any) => {
        balanceMap[bal.employee_id] = bal;
      });

      const formattedBalances: EmployeeBalance[] = (employeesData || []).map((emp: any) => {
        const bal = balanceMap[emp.id] || {
          id: null,
          annual_entitled: 30,
          annual_used: 0,
          annual_pending: 0,
          sick_entitled: 90,
          sick_used: 0,
        };

        return {
          employee_id: emp.id,
          employee_name: emp.full_name,
          department_name: emp.departments?.name || null,
          balance_id: bal.id,
          annual_entitled: bal.annual_entitled || 30,
          annual_used: bal.annual_used || 0,
          annual_pending: bal.annual_pending || 0,
          annual_remaining: (bal.annual_entitled || 30) - (bal.annual_used || 0) - (bal.annual_pending || 0),
          sick_entitled: bal.sick_entitled || 90,
          sick_used: bal.sick_used || 0,
          sick_remaining: (bal.sick_entitled || 90) - (bal.sick_used || 0),
        };
      });

      setBalances(formattedBalances);
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast({
        title: t("common.error"),
        description: t("leaveBalances.failedToFetch"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentYear, toast, t]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const openEditDialog = (balance: EmployeeBalance) => {
    setSelectedBalance(balance);
    setAnnualEntitled(balance.annual_entitled);
    setSickEntitled(balance.sick_entitled);
    setEditDialogOpen(true);
  };

  const handleSaveBalance = async () => {
    if (!selectedBalance) return;

    setIsSaving(true);
    try {
      if (selectedBalance.balance_id) {
        // Update existing balance
        const { error } = await supabase
          .from("leave_balances")
          .update({
            annual_entitled: annualEntitled,
            sick_entitled: sickEntitled,
          })
          .eq("id", selectedBalance.balance_id);

        if (error) throw error;
      } else {
        // Create new balance
        const { error } = await supabase.from("leave_balances").insert({
          employee_id: selectedBalance.employee_id,
          year: currentYear,
          annual_entitled: annualEntitled,
          sick_entitled: sickEntitled,
        });

        if (error) throw error;
      }

      toast({
        title: t("leaveBalances.balanceUpdated"),
        description: t("leaveBalances.balanceUpdatedDesc", { name: selectedBalance.employee_name }),
      });

      setEditDialogOpen(false);
      setSelectedBalance(null);
      fetchBalances();
    } catch (error) {
      console.error("Error saving balance:", error);
      toast({
        title: t("common.error"),
        description: t("leaveBalances.failedToSave"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate totals
  const totals = balances.reduce(
    (acc, bal) => ({
      annual_entitled: acc.annual_entitled + bal.annual_entitled,
      annual_used: acc.annual_used + bal.annual_used,
      annual_pending: acc.annual_pending + bal.annual_pending,
      annual_remaining: acc.annual_remaining + bal.annual_remaining,
      sick_entitled: acc.sick_entitled + bal.sick_entitled,
      sick_used: acc.sick_used + bal.sick_used,
      sick_remaining: acc.sick_remaining + bal.sick_remaining,
    }),
    {
      annual_entitled: 0,
      annual_used: 0,
      annual_pending: 0,
      annual_remaining: 0,
      sick_entitled: 0,
      sick_used: 0,
      sick_remaining: 0,
    }
  );

  const lowBalanceEmployees = balances.filter((bal) => bal.annual_remaining <= 5);

  // Filter balances by search query
  const filteredBalances = balances.filter((balance) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      balance.employee_name.toLowerCase().includes(query) ||
      (balance.department_name && balance.department_name.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.push("/admin/hr/leave")}
                className="h-8 w-8 hover:bg-[#F0F0EE]"
              >
                <ArrowLeft className="h-5 w-5 text-[#777777]" />
              </Button>
              <Wallet className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("leaveBalances.title")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-[88px] rtl:mr-[88px]">
              {t("leaveBalances.yearDescription", { year: currentYear })}
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
            <Users className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
            <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
              {balances.length} {t("employees")}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {balances.length === 0 ? (
        <Card className="border-[#E6E6E4]">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-[#C6A03B]" />
              </div>
              <h3 className="text-lg font-semibold text-[#222222] mb-2">
                {t("leaveBalances.noEmployees", "No employees found")}
              </h3>
              <p className="text-sm text-[#6B6B6B] mb-4 max-w-md">
                {t("leaveBalances.noEmployeesDescription", "Add employees to your organization to manage their leave balances")}
              </p>
              <Button 
                onClick={() => router.push("/admin/hr/employees/new")}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                <UserPlus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("addEmployee")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("totalEmployees")}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(198,160,59,0.15)]">
                <Users className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222]">{balances.length}</p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3" />
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("leaveBalances.annualUsed")}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F0FF]">
                <Plane className="h-5 w-5 text-[#2563EB]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222]">{totals.annual_used}</p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#2563EB] transition-all duration-300 mt-3" />
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("leaveBalances.sickUsed")}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF9E6]">
                <Thermometer className="h-5 w-5 text-[#C6A03B]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222]">{totals.sick_used}</p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3" />
          </CardContent>
        </Card>
        <Card className={`border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group ${lowBalanceEmployees.length > 0 ? "border-[#C0392B]/30" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("leaveBalances.lowBalance")}</p>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${lowBalanceEmployees.length > 0 ? "bg-[#FEECEC]" : "bg-[#F5F5F5]"}`}>
                <AlertTriangle className={`h-5 w-5 ${lowBalanceEmployees.length > 0 ? "text-[#C0392B]" : "text-[#6B6B6B]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${lowBalanceEmployees.length > 0 ? "text-[#C0392B]" : "text-[#222222]"}`}>
              {lowBalanceEmployees.length}
            </p>
            <div className={`h-0.5 w-0 group-hover:w-full transition-all duration-300 mt-3 ${lowBalanceEmployees.length > 0 ? "bg-[#C0392B]" : "bg-[#6B6B6B]"}`} />
          </CardContent>
        </Card>
      </div>

      {/* Balances Table */}
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>{t("leaveBalances.employeeBalances")}</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C6A03B]" />
                <Input
                  placeholder={t("leaveBalances.searchEmployee", "Search employee...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ltr:pl-9 rtl:pr-9 w-64 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#555555]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <span className="text-sm text-[#6B6B6B]">
                {t("leaveBalances.showingResults", "Showing {{count}} of {{total}}", { 
                  count: filteredBalances.length, 
                  total: balances.length 
                })}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-[#E6E6E4]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAF8] border-b border-[#E6E6E4]">
                  <th className="text-left py-3 px-3 text-sm font-semibold text-[#555555]">{t("leavePage.employee")}</th>
                  <th className="text-center py-3 px-3 text-sm font-semibold text-[#2563EB]">
                    <div className="flex items-center justify-center gap-1">
                      <Plane className="h-4 w-4" />
                      {t("leaveBalances.annual")}
                    </div>
                  </th>
                  <th className="text-center py-3 px-3 text-sm font-semibold text-[#555555]">{t("leaveBalances.used")}</th>
                  <th className="text-center py-3 px-3 text-sm font-semibold text-[#555555]">{t("leaveBalances.pending")}</th>
                  <th className="text-center py-3 px-3 text-sm font-semibold text-[#0C5536]">{t("leaveBalances.remaining")}</th>
                  <th className="text-center py-3 px-3 text-sm font-semibold text-[#C6A03B]">
                    <div className="flex items-center justify-center gap-1">
                      <Thermometer className="h-4 w-4" />
                      {t("leaveBalances.sick")}
                    </div>
                  </th>
                  <th className="text-center py-3 px-3 text-sm font-semibold text-[#555555]">{t("leaveBalances.used")}</th>
                  <th className="text-center py-3 px-3 text-sm font-semibold text-[#0C5536]">{t("leaveBalances.remaining")}</th>
                  <th className="text-right py-3 px-3 text-sm font-semibold text-[#555555]">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBalances.map((balance) => (
                  <tr
                    key={balance.employee_id}
                    className={`border-b border-[#E6E6E4] hover:bg-[#FDFBF4] transition-colors ${
                      balance.annual_remaining <= 5 ? "bg-[#FEECEC]/50" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div>
                        <button
                          onClick={() => router.push(`/admin/hr/leave/history/${balance.employee_id}`)}
                          className="font-medium text-[#222222] hover:text-[hsl(var(--jw-primary-green))] hover:underline cursor-pointer"
                        >
                          {balance.employee_name}
                        </button>
                        {balance.department_name && (
                          <Badge variant="outline" className="ltr:ml-2 rtl:mr-2 text-xs border-[#E6E6E4] text-[#6B6B6B]">
                            {balance.department_name}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-3 px-3 font-medium text-[#2563EB]">{balance.annual_entitled}</td>
                    <td className="text-center py-3 px-3 text-[#555555]">{balance.annual_used}</td>
                    <td className="text-center py-3 px-3">
                      {balance.annual_pending > 0 && (
                        <Badge variant="outline" className="text-[#C6A03B] border-[#C6A03B]/30 bg-[#FFF9E6]">
                          {balance.annual_pending}
                        </Badge>
                      )}
                      {balance.annual_pending === 0 && <span className="text-[#999999]">-</span>}
                    </td>
                    <td className="text-center py-3 px-3">
                      <span
                        className={`font-medium ${
                          balance.annual_remaining <= 5
                            ? "text-[#C0392B]"
                            : balance.annual_remaining <= 10
                              ? "text-[#C6A03B]"
                              : "text-[#0C5536]"
                        }`}
                      >
                        {balance.annual_remaining}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3 font-medium text-[#C6A03B]">{balance.sick_entitled}</td>
                    <td className="text-center py-3 px-3 text-[#555555]">{balance.sick_used}</td>
                    <td className="text-center py-3 px-3 font-medium text-[#0C5536]">{balance.sick_remaining}</td>
                    <td className="text-right py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/hr/leave/history/${balance.employee_id}`)}
                          title={t("leaveBalances.viewHistory")}
                          className="text-[#6B6B6B] hover:text-[#0C5536] hover:bg-[#E6F7F1]"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditDialog(balance)} 
                          title={t("leaveBalances.editEntitlement")}
                          className="text-[#6B6B6B] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#0C5536] bg-[#FAFAF8] font-medium">
                  <td className="py-3 px-3 text-[#222222]">{t("leaveBalances.total")}</td>
                  <td className="text-center py-3 px-3 text-[#2563EB]">{totals.annual_entitled}</td>
                  <td className="text-center py-3 px-3 text-[#555555]">{totals.annual_used}</td>
                  <td className="text-center py-3 px-3 text-[#555555]">{totals.annual_pending || "-"}</td>
                  <td className="text-center py-3 px-3 text-[#0C5536]">{totals.annual_remaining}</td>
                  <td className="text-center py-3 px-3 text-[#C6A03B]">{totals.sick_entitled}</td>
                  <td className="text-center py-3 px-3 text-[#555555]">{totals.sick_used}</td>
                  <td className="text-center py-3 px-3 text-[#0C5536]">{totals.sick_remaining}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
              <Edit className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {t("leaveBalances.editLeaveEntitlement")}
            </DialogTitle>
            <DialogDescription>
              {selectedBalance && t("leaveBalances.setEntitlementFor", { name: selectedBalance.employee_name })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="annual_entitled" className="text-[#555555]">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-[#2563EB]" />
                  {t("leaveBalances.annualLeaveEntitlement")}
                </div>
              </Label>
              <Input
                id="annual_entitled"
                type="number"
                min={0}
                max={365}
                value={annualEntitled}
                onChange={(e) => setAnnualEntitled(parseInt(e.target.value) || 0)}
                className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
              <p className="text-xs text-[#6B6B6B]">{t("leaveBalances.uaeStandardAnnual")}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sick_entitled" className="text-[#555555]">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-[#C6A03B]" />
                  {t("leaveBalances.sickLeaveEntitlement")}
                </div>
              </Label>
              <Input
                id="sick_entitled"
                type="number"
                min={0}
                max={365}
                value={sickEntitled}
                onChange={(e) => setSickEntitled(parseInt(e.target.value) || 0)}
                className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
              <p className="text-xs text-[#6B6B6B]">{t("leaveBalances.uaeStandardSick")}</p>
            </div>
          </div>
          <DialogFooter className="border-t border-[#E6E6E4] pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-[#E6E6E4]">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveBalance}
              disabled={isSaving}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("leaveBalances.saveChanges")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice")}
        </p>
      </div>
    </div>
  );
}
