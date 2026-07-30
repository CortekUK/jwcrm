"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Briefcase, AlertTriangle, Loader2, Target, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { useHrBasePath } from "@/hooks/useHrBasePath";

type JobRole = {
  id: string;
  name: string;
  department_id: string | null;
  created_at: string | null;
  department?: {
    name: string;
  } | null;
  employee_count: number;
  kpi_count: number;
};

type JobRoleTableProps = {
  jobRoles: JobRole[];
  onAddNew: () => void;
  onEdit: (id: string) => void;
  onRefresh: () => void;
};

export function JobRoleTable({
  jobRoles,
  onAddNew,
  onEdit,
  onRefresh,
}: JobRoleTableProps) {
  const hrBase = useHrBasePath();
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const { toast } = useToast();
  const { canPerform } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<JobRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check if user can delete job roles (head-only operation for HR)
  const canDeleteJobRole = canPerform("hr", "delete_job_role");

  // Filter job roles based on search
  const filteredRoles = jobRoles.filter((role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteClick = (role: JobRole) => {
    setSelectedRole(role);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    if (selectedRole.employee_count > 0) {
      toast({
        variant: "destructive",
        description: t("hr:cannotDeleteJobRole"),
      });
      setDeleteModalOpen(false);
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("job_roles")
        .delete()
        .eq("id", selectedRole.id);

      if (error) throw error;

      toast({
        title: t("hr:jobRoleDeleted"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      setDeleteModalOpen(false);
      setSelectedRole(null);
      onRefresh();
    } catch (error) {
      console.error("Error deleting job role:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Error deleting job role",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Search and Add Button */}
      <div className={`flex flex-col md:flex-row gap-4 justify-between ${isRtl ? "md:flex-row-reverse" : ""}`}>
        <div className="relative flex-1 max-w-sm">
          <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[#C6A03B] ${isRtl ? "right-3" : "left-3"}`} />
          <Input
            placeholder={t("hr:searchJobRoles")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`border-[#E6E6E4] dark:border-border focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B] ${isRtl ? "pr-10" : "pl-10"}`}
          />
        </div>
        <Button
          onClick={onAddNew}
          className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("hr:addJobRole")}
        </Button>
      </div>

      {/* Table */}
      <div className="border border-[#E6E6E4] dark:border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#FAFAF8] dark:bg-muted hover:bg-[#FAFAF8] dark:hover:bg-muted">
              <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:jobRoleName")}</TableHead>
              <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:department")}</TableHead>
              <TableHead className="font-semibold text-[#222222] dark:text-foreground text-center">{t("hr:employeesAssigned")}</TableHead>
              <TableHead className="font-semibold text-[#222222] dark:text-foreground text-center">{t("hr:kpisAssigned")}</TableHead>
              <TableHead className={`font-semibold text-[#222222] dark:text-foreground ${isRtl ? "text-left" : "text-right"}`}>{t("hr:actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Briefcase className="h-10 w-10 text-[#C6A03B] mx-auto mb-3" />
                  <p className="text-[#6B6B6B] dark:text-muted-foreground">{t("hr:noJobRoles")}</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredRoles.map((role) => (
                <TableRow key={role.id} className="hover:bg-[#FAFAF8] dark:hover:bg-accent">
                  <TableCell>
                    <p className="font-medium text-[#222222] dark:text-foreground">{role.name}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-[#6B6B6B] dark:text-muted-foreground">
                      {role.department?.name || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-sm font-medium ${
                      role.employee_count > 0
                        ? "bg-[#E6F7F1] text-[#0C5536]"
                        : "bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground"
                    }`}>
                      {role.employee_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => router.push(`${hrBase}/kpis?role=${role.id}`)}
                      className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-sm font-medium transition-colors hover:opacity-80 ${
                        role.kpi_count > 0
                          ? "bg-[#FFF9E6] text-[#C6A03B] cursor-pointer"
                          : "bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground cursor-pointer"
                      }`}
                      title={t("hr:viewKPIs", "View KPIs")}
                    >
                      {role.kpi_count}
                    </button>
                  </TableCell>
                  <TableCell className={isRtl ? "text-left" : "text-right"}>
                    <div className={`flex gap-1 ${isRtl ? "justify-start" : "justify-end"}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`${hrBase}/kpis?role=${role.id}`)}
                        className="text-[#C6A03B] hover:text-[#8B6914] hover:bg-[#FFF9E6]"
                        title={t("hr:viewKPIs", "View KPIs")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`${hrBase}/kpis/new?job_role_id=${role.id}`)}
                        className="text-[hsl(var(--jw-primary-green))] hover:text-[hsl(var(--jw-hover-green))] hover:bg-[#E6F7F1]"
                        title={t("hr:addKPI", "Add KPI")}
                      >
                        <Target className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(role.id)}
                        className="text-[#6B6B6B] hover:text-[#222222]"
                        title={t("hr:edit", "Edit")}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDeleteJobRole && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(role)}
                          className="text-[#6B6B6B] hover:text-red-600"
                          disabled={role.employee_count > 0}
                          title={t("hr:delete", "Delete")}
                        >
                          <Trash2 className="h-4 w-4" />
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
      <div className="text-sm text-[#6B6B6B] dark:text-muted-foreground">
        {t("hr:showingResults", {
          count: filteredRoles.length,
          total: jobRoles.length,
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t("hr:deleteJobRole")}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                {selectedRole?.employee_count ? (
                  <div className="p-3 bg-[#FFF9E6] rounded-lg border border-[#C6A03B]/20 mt-2">
                    <span className="text-sm text-[#C6A03B]">
                      {t("hr:cannotDeleteJobRole")}
                    </span>
                  </div>
                ) : (
                  <span className="text-[#6B6B6B] dark:text-muted-foreground mt-2 block">
                    {t("hr:jobRoleDeleteNote")}
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="border-[#E6E6E4] dark:border-border"
            >
              {t("hr:cancel")}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting || (selectedRole?.employee_count ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("hr:deleteJobRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
