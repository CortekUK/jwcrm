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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/hr/leave")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#222222]">{t("leaveBalances.title")}</h1>
            <p className="text-[#6B6B6B]">{t("leaveBalances.yearDescription", { year: currentYear })}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("totalEmployees")}</p>
                <p className="text-2xl font-bold text-[#222222]">{balances.length}</p>
              </div>
              <Users className="h-8 w-8 text-[#6B6B6B]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4] border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">{t("leaveBalances.annualUsed")}</p>
                <p className="text-2xl font-bold text-blue-600">{totals.annual_used}</p>
              </div>
              <Plane className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4] border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">{t("leaveBalances.sickUsed")}</p>
                <p className="text-2xl font-bold text-yellow-600">{totals.sick_used}</p>
              </div>
              <Thermometer className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={`border-[#E6E6E4] ${lowBalanceEmployees.length > 0 ? "border-red-200 bg-red-50" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("leaveBalances.lowBalance")}</p>
                <p className={`text-2xl font-bold ${lowBalanceEmployees.length > 0 ? "text-red-600" : "text-[#222222]"}`}>
                  {lowBalanceEmployees.length}
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${lowBalanceEmployees.length > 0 ? "text-red-500" : "text-[#E6E6E4]"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balances Table */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-lg">{t("leaveBalances.employeeBalances")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E6E6E4]">
                  <th className="text-left py-3 px-2 text-sm font-medium text-[#6B6B6B]">{t("leavePage.employee")}</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-blue-600">
                    <div className="flex items-center justify-center gap-1">
                      <Plane className="h-4 w-4" />
                      {t("leaveBalances.annual")}
                    </div>
                  </th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-[#6B6B6B]">{t("leaveBalances.used")}</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-[#6B6B6B]">{t("leaveBalances.pending")}</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-green-600">{t("leaveBalances.remaining")}</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-yellow-600">
                    <div className="flex items-center justify-center gap-1">
                      <Thermometer className="h-4 w-4" />
                      {t("leaveBalances.sick")}
                    </div>
                  </th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-[#6B6B6B]">{t("leaveBalances.used")}</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-green-600">{t("leaveBalances.remaining")}</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-[#6B6B6B]">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => (
                  <tr
                    key={balance.employee_id}
                    className={`border-b border-[#E6E6E4] hover:bg-gray-50 ${
                      balance.annual_remaining <= 5 ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="py-3 px-2">
                      <div>
                        <button
                          onClick={() => router.push(`/admin/hr/leave/history/${balance.employee_id}`)}
                          className="font-medium text-[#222222] hover:text-[hsl(var(--jw-primary-green))] hover:underline cursor-pointer"
                        >
                          {balance.employee_name}
                        </button>
                        {balance.department_name && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {balance.department_name}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-3 px-2 font-medium text-blue-600">{balance.annual_entitled}</td>
                    <td className="text-center py-3 px-2">{balance.annual_used}</td>
                    <td className="text-center py-3 px-2">
                      {balance.annual_pending > 0 && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          {balance.annual_pending}
                        </Badge>
                      )}
                      {balance.annual_pending === 0 && "-"}
                    </td>
                    <td className="text-center py-3 px-2">
                      <span
                        className={`font-medium ${
                          balance.annual_remaining <= 5
                            ? "text-red-600"
                            : balance.annual_remaining <= 10
                              ? "text-yellow-600"
                              : "text-green-600"
                        }`}
                      >
                        {balance.annual_remaining}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2 font-medium text-yellow-600">{balance.sick_entitled}</td>
                    <td className="text-center py-3 px-2">{balance.sick_used}</td>
                    <td className="text-center py-3 px-2 font-medium text-green-600">{balance.sick_remaining}</td>
                    <td className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/hr/leave/history/${balance.employee_id}`)}
                          title={t("leaveBalances.viewHistory")}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(balance)} title={t("leaveBalances.editEntitlement")}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#222222] bg-gray-50 font-medium">
                  <td className="py-3 px-2">{t("leaveBalances.total")}</td>
                  <td className="text-center py-3 px-2 text-blue-600">{totals.annual_entitled}</td>
                  <td className="text-center py-3 px-2">{totals.annual_used}</td>
                  <td className="text-center py-3 px-2">{totals.annual_pending || "-"}</td>
                  <td className="text-center py-3 px-2 text-green-600">{totals.annual_remaining}</td>
                  <td className="text-center py-3 px-2 text-yellow-600">{totals.sick_entitled}</td>
                  <td className="text-center py-3 px-2">{totals.sick_used}</td>
                  <td className="text-center py-3 px-2 text-green-600">{totals.sick_remaining}</td>
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
            <DialogTitle>{t("leaveBalances.editLeaveEntitlement")}</DialogTitle>
            <DialogDescription>
              {selectedBalance && t("leaveBalances.setEntitlementFor", { name: selectedBalance.employee_name })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="annual_entitled">{t("leaveBalances.annualLeaveEntitlement")}</Label>
              <Input
                id="annual_entitled"
                type="number"
                min={0}
                max={365}
                value={annualEntitled}
                onChange={(e) => setAnnualEntitled(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-[#6B6B6B]">{t("leaveBalances.uaeStandardAnnual")}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sick_entitled">{t("leaveBalances.sickLeaveEntitlement")}</Label>
              <Input
                id="sick_entitled"
                type="number"
                min={0}
                max={365}
                value={sickEntitled}
                onChange={(e) => setSickEntitled(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-[#6B6B6B]">{t("leaveBalances.uaeStandardSick")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveBalance}
              disabled={isSaving}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("leaveBalances.saveChanges")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
