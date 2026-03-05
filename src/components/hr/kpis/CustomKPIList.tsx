"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Archive, RotateCcw, Target, AlertCircle, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { AddCustomKPIForm } from "./AddCustomKPIForm";

type CustomKPI = {
  id: string;
  name: string;
  description: string | null;
  target_value: number;
  unit: string;
  weighting: number;
  deadline: string | null;
  is_archived: boolean;
  created_at: string | null;
};

type CustomKPIListProps = {
  employeeId: string;
  employeeName: string;
};

export function CustomKPIList({ employeeId, employeeName }: CustomKPIListProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const [kpis, setKpis] = useState<CustomKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const fetchKpis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_custom_kpis")
        .select("id, name, description, target_value, unit, weighting, deadline, is_archived, created_at")
        .eq("employee_id", employeeId)
        .order("is_archived")
        .order("name");

      if (error) {
        // Table may not exist yet if migration hasn't been applied
        if (error.code === "42P01" || error.message?.includes("relation") || error.code === "PGRST204") {
          setKpis([]);
        } else {
          console.error("Error fetching custom KPIs:", error);
        }
      } else {
        setKpis(data || []);
      }
    } catch (error) {
      // Silently handle - table likely doesn't exist yet
      setKpis([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [employeeId]);

  const handleArchiveToggle = async (kpi: CustomKPI) => {
    try {
      const { error } = await supabase
        .from("employee_custom_kpis")
        .update({ is_archived: !kpi.is_archived, updated_at: new Date().toISOString() })
        .eq("id", kpi.id);

      if (error) throw error;

      toast({
        title: kpi.is_archived ? t("hr:customKpiRestored") : t("hr:customKpiArchived"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      fetchKpis();
    } catch (error) {
      console.error("Error toggling archive:", error);
      toast({ variant: "destructive", description: "Error updating KPI" });
    }
  };

  const handleEdit = (kpi: CustomKPI) => {
    setEditData({
      id: kpi.id,
      employee_id: employeeId,
      name: kpi.name,
      description: kpi.description || "",
      target_value: String(kpi.target_value),
      unit: kpi.unit,
      weighting: String(kpi.weighting),
      deadline: kpi.deadline || "",
    });
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditData(null);
    fetchKpis();
  };

  const getDeadlineDisplay = (deadline: string | null) => {
    if (!deadline) return null;
    const daysUntil = differenceInDays(new Date(deadline), new Date());
    if (daysUntil < 0) {
      return <Badge className="bg-red-100 text-red-700 border-0">{format(new Date(deadline), "MMM d, yyyy")}</Badge>;
    }
    if (daysUntil <= 7) {
      return <Badge className="bg-red-50 text-red-600 border-0">{format(new Date(deadline), "MMM d, yyyy")}</Badge>;
    }
    if (daysUntil <= 30) {
      return <Badge className="bg-yellow-50 text-yellow-700 border-0">{format(new Date(deadline), "MMM d, yyyy")}</Badge>;
    }
    return <span className="text-sm text-[#6B6B6B]">{format(new Date(deadline), "MMM d, yyyy")}</span>;
  };

  const activeKpis = kpis.filter((k) => !k.is_archived);
  const archivedKpis = kpis.filter((k) => k.is_archived);
  const totalWeighting = activeKpis.reduce((sum, k) => sum + k.weighting, 0);

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[#222222]">{t("hr:customKpis")}</h3>
          <Badge variant="outline" className="text-xs">{activeKpis.length}</Badge>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditData(null); setShowForm(true); }}
          className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("hr:addCustomKpi")}
        </Button>
      </div>

      {/* Weighting Summary */}
      {activeKpis.length > 0 && (
        <div className={`p-3 rounded-lg ${
          totalWeighting === 100
            ? "bg-[#E6F7F1] border border-[#0C5536]/20"
            : totalWeighting > 100
            ? "bg-red-50 border border-red-200"
            : "bg-[#FFF9E6] border border-[#C6A03B]/20"
        }`}>
          <div className="flex items-center gap-2 text-sm">
            {totalWeighting > 100 && <AlertCircle className="h-4 w-4 text-red-600" />}
            <span className={totalWeighting > 100 ? "text-red-600" : "text-[#6B6B6B]"}>
              {t("hr:totalWeighting")}: <strong>{totalWeighting}%</strong>
            </span>
          </div>
        </div>
      )}

      {/* KPI Table or Empty State */}
      {activeKpis.length === 0 && !loading ? (
        <div className="p-8 text-center border border-dashed border-[#E6E6E4] rounded-lg">
          <Target className="h-10 w-10 text-[#C6A03B] mx-auto mb-3" />
          <p className="text-[#6B6B6B]">{t("hr:noCustomKpis")}</p>
          <p className="text-sm text-[#9B9B9B] mt-1">{t("hr:noCustomKpisHint")}</p>
        </div>
      ) : (
        <div className="border border-[#E6E6E4] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAF8] hover:bg-[#FAFAF8]">
                <TableHead className="font-semibold text-[#222222]">{t("hr:kpiName")}</TableHead>
                <TableHead className="font-semibold text-[#222222] text-center">{t("hr:targetValue")}</TableHead>
                <TableHead className="font-semibold text-[#222222] text-center">{t("hr:weighting")}</TableHead>
                <TableHead className="font-semibold text-[#222222] text-center">{t("hr:deadline")}</TableHead>
                <TableHead className={`font-semibold text-[#222222] ${isRtl ? "text-left" : "text-right"}`}>{t("hr:actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeKpis.map((kpi) => (
                <TableRow key={kpi.id} className="hover:bg-[#FAFAF8]">
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#222222]">{kpi.name}</p>
                        <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">{t("hr:custom")}</Badge>
                      </div>
                      {kpi.description && (
                        <p className="text-xs text-[#6B6B6B] mt-0.5 line-clamp-1">{kpi.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {kpi.target_value} {kpi.unit}
                  </TableCell>
                  <TableCell className="text-center text-sm">{kpi.weighting}%</TableCell>
                  <TableCell className="text-center">
                    {kpi.deadline ? getDeadlineDisplay(kpi.deadline) : (
                      <span className="text-sm text-[#9B9B9B]">-</span>
                    )}
                  </TableCell>
                  <TableCell className={isRtl ? "text-left" : "text-right"}>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(kpi)}
                        className="text-[#777777] hover:text-[#222222]"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveToggle(kpi)}
                        className="text-[#777777] hover:text-[#C6A03B]"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Archived KPIs */}
      {archivedKpis.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[#9B9B9B] uppercase">{t("hr:archived")} ({archivedKpis.length})</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <Table>
              <TableBody>
                {archivedKpis.map((kpi) => (
                  <TableRow key={kpi.id} className="bg-gray-50/50">
                    <TableCell>
                      <p className="text-sm text-[#9B9B9B]">{kpi.name}</p>
                    </TableCell>
                    <TableCell className="text-center text-sm text-[#9B9B9B]">
                      {kpi.target_value} {kpi.unit}
                    </TableCell>
                    <TableCell className="text-center text-sm text-[#9B9B9B]">{kpi.weighting}%</TableCell>
                    <TableCell className={isRtl ? "text-left" : "text-right"}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveToggle(kpi)}
                        className="text-[#9B9B9B] hover:text-[#0C5536]"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditData(null); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Target className="h-5 w-5 text-purple-600" />
              {editData ? t("hr:editCustomKpi") : t("hr:addCustomKpi")}
            </DialogTitle>
          </DialogHeader>
          <AddCustomKPIForm
            employeeId={employeeId}
            employeeName={employeeName}
            editData={editData}
            onSuccess={handleFormSuccess}
            onCancel={() => { setShowForm(false); setEditData(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
