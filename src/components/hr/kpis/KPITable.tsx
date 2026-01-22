"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Archive, ArchiveRestore, Target, AlertTriangle, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type KPI = {
  id: string;
  name: string;
  description: string | null;
  target_value: number;
  unit: string;
  weighting: number;
  job_role_id: string;
  job_role?: {
    id: string;
    name: string;
  } | null;
  created_at: string | null;
  is_archived?: boolean;
};

type JobRole = {
  id: string;
  name: string;
};

type KPITableProps = {
  kpis: KPI[];
  jobRoles: JobRole[];
  onAddNew: () => void;
  onEdit: (id: string) => void;
  onRefresh: () => void;
  showArchived?: boolean;
  onShowArchivedChange?: (value: boolean) => void;
};

export function KPITable({
  kpis,
  jobRoles,
  onAddNew,
  onEdit,
  onRefresh,
  showArchived = false,
  onShowArchivedChange,
}: KPITableProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [jobRoleFilter, setJobRoleFilter] = useState<string>("all");
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<KPI | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Filter KPIs based on search and job role
  const filteredKPIs = kpis.filter((kpi) => {
    const matchesSearch = kpi.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJobRole = jobRoleFilter === "all" || kpi.job_role_id === jobRoleFilter;
    return matchesSearch && matchesJobRole;
  });

  // Calculate total weighting per job role
  const weightingByRole: Record<string, number> = {};
  kpis.forEach((kpi) => {
    weightingByRole[kpi.job_role_id] = (weightingByRole[kpi.job_role_id] || 0) + kpi.weighting;
  });

  const handleArchiveClick = (kpi: KPI) => {
    setSelectedKPI(kpi);
    setArchiveModalOpen(true);
  };

  const handleArchive = async () => {
    if (!selectedKPI) return;

    setArchiving(true);
    try {
      const { error } = await supabase
        .from("kpis")
        .update({ is_archived: true })
        .eq("id", selectedKPI.id);

      if (error) throw error;

      toast({
        title: t("hr:kpiArchived"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      setArchiveModalOpen(false);
      setSelectedKPI(null);
      onRefresh();
    } catch (error) {
      console.error("Error archiving KPI:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : t("hr:errorArchivingKPI"),
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (kpi: KPI) => {
    setRestoring(true);
    try {
      const { error } = await supabase
        .from("kpis")
        .update({ is_archived: false })
        .eq("id", kpi.id);

      if (error) throw error;

      toast({
        title: t("hr:kpiRestored"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      onRefresh();
    } catch (error) {
      console.error("Error restoring KPI:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : t("hr:errorRestoringKPI"),
      });
    } finally {
      setRestoring(false);
    }
  };

  const getWeightingBadgeColor = (roleId: string) => {
    const total = weightingByRole[roleId] || 0;
    if (total === 100) return "bg-[#E6F7F1] text-[#0C5536]";
    if (total < 100) return "bg-[#FFF9E6] text-[#C6A03B]";
    return "bg-red-50 text-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Header with Search, Filter and Add Button */}
      <div className={`flex flex-col md:flex-row gap-4 justify-between ${isRtl ? "md:flex-row-reverse" : ""}`}>
        <div className={`flex flex-col sm:flex-row gap-2 flex-1 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
          <div className="relative flex-1 max-w-sm">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B] ${isRtl ? "right-3" : "left-3"}`} />
            <Input
              placeholder={t("hr:searchEmployees")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`border-[#E6E6E4] ${isRtl ? "pr-10" : "pl-10"}`}
            />
          </div>
          <Select value={jobRoleFilter} onValueChange={setJobRoleFilter}>
            <SelectTrigger className="border-[#E6E6E4] w-full sm:w-[180px]">
              <SelectValue placeholder={t("hr:selectJobRole")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hr:allEmployees")}</SelectItem>
              {jobRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                  {weightingByRole[role.id] !== undefined && (
                    <span className={`ml-2 text-xs ${
                      weightingByRole[role.id] === 100 ? "text-[#0C5536]" : "text-[#C6A03B]"
                    }`}>
                      ({weightingByRole[role.id]}%)
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          {onShowArchivedChange && (
            <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={onShowArchivedChange}
              />
              <Label htmlFor="show-archived" className="text-sm text-[#6B6B6B] cursor-pointer">
                {t("hr:showArchived")}
              </Label>
            </div>
          )}
          <Button
            onClick={onAddNew}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("hr:addKPI")}
          </Button>
        </div>
      </div>

      {/* Weighting Summary for selected role */}
      {jobRoleFilter !== "all" && (
        <div className={`p-3 rounded-lg ${getWeightingBadgeColor(jobRoleFilter)}`}>
          <p className="text-sm">
            {t("hr:currentWeighting")}: <strong>{weightingByRole[jobRoleFilter] || 0}%</strong>
            {weightingByRole[jobRoleFilter] !== 100 && (
              <span className="ml-2">
                ({t("hr:remainingWeighting")}: {100 - (weightingByRole[jobRoleFilter] || 0)}%)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Table */}
      <div className="border border-[#E6E6E4] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#FAFAF8]">
              <TableHead>{t("hr:kpiName")}</TableHead>
              <TableHead>{t("hr:jobRoles")}</TableHead>
              <TableHead className="text-center">{t("hr:targetValue")}</TableHead>
              <TableHead className="text-center">{t("hr:unit")}</TableHead>
              <TableHead className="text-center">{t("hr:weighting")}</TableHead>
              <TableHead className={isRtl ? "text-left" : "text-right"}>{t("hr:actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKPIs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Target className="h-12 w-12 text-[#E6E6E4] mx-auto mb-2" />
                  <p className="text-[#6B6B6B]">{t("hr:noKPIs")}</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredKPIs.map((kpi) => (
                <TableRow key={kpi.id} className={`hover:bg-[#FAFAF8] ${kpi.is_archived ? "opacity-60" : ""}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-[#222222]">{kpi.name}</p>
                        {kpi.description && (
                          <p className="text-sm text-[#6B6B6B] truncate max-w-[200px]">
                            {kpi.description}
                          </p>
                        )}
                      </div>
                      {kpi.is_archived && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                          {t("hr:archived")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-[#E6E6E4]">
                      {kpi.job_role?.name || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">{kpi.target_value}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-[#6B6B6B]">{kpi.unit}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={getWeightingBadgeColor(kpi.job_role_id)}>
                      {kpi.weighting}%
                    </Badge>
                  </TableCell>
                  <TableCell className={isRtl ? "text-left" : "text-right"}>
                    <div className={`flex gap-1 ${isRtl ? "justify-start" : "justify-end"}`}>
                      {!kpi.is_archived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(kpi.id)}
                          className="text-[#6B6B6B] hover:text-[#222222]"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {kpi.is_archived ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(kpi)}
                          disabled={restoring}
                          className="text-[#6B6B6B] hover:text-[hsl(var(--jw-primary-green))]"
                        >
                          {restoring ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArchiveRestore className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveClick(kpi)}
                          className="text-[#6B6B6B] hover:text-amber-600"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results Count */}
      <div className="text-sm text-[#6B6B6B]">
        {t("hr:showingResults", {
          count: filteredKPIs.length,
          total: kpis.length,
        })}
      </div>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveModalOpen} onOpenChange={setArchiveModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Archive className="h-5 w-5" />
              {t("hr:archiveKPI")}
            </DialogTitle>
            <DialogDescription className="text-[#6B6B6B] mt-2">
              {t("hr:confirmArchiveKPI", { name: selectedKPI?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setArchiveModalOpen(false)}
              className="border-[#E6E6E4]"
            >
              {t("hr:cancel")}
            </Button>
            <Button
              onClick={handleArchive}
              disabled={archiving}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {archiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("hr:archiveKPI")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
