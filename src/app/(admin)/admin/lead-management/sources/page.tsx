"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SourcesTable, LeadSource } from "@/components/lead-management/sources/SourcesTable";
import { CreateSourceDialog } from "@/components/lead-management/sources/CreateSourceDialog";
import { EditSourceDialog } from "@/components/lead-management/sources/EditSourceDialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SourcesPage() {
  const { t } = useTranslation("leadManagement");
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<LeadSource | null>(null);

  // Fetch sources
  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/lead-management/sources");
      if (!response.ok) throw new Error("Failed to fetch sources");

      const { data } = await response.json();
      setSources(data || []);
    } catch (error) {
      console.error("Error fetching sources:", error);
      toast.error(t("failedToFetchSources"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  // Create source
  const handleCreateSource = async (data: {
    name: string;
    description?: string;
    salesperson_ids: string[];
  }) => {
    try {
      const response = await fetch("/api/lead-management/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create source");
      }

      toast.success(t("sourceCreated"));
      fetchSources();
    } catch (error: unknown) {
      console.error("Error creating source:", error);
      toast.error(error instanceof Error ? error.message : t("failedToCreateSource"));
      throw error;
    }
  };

  // Update source
  const handleUpdateSource = async (
    id: string,
    data: {
      name: string;
      description?: string;
      is_active: boolean;
      salesperson_ids: string[];
    }
  ) => {
    try {
      const response = await fetch(`/api/lead-management/sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update source");
      }

      toast.success(t("sourceUpdated"));
      fetchSources();
    } catch (error: unknown) {
      console.error("Error updating source:", error);
      toast.error(error instanceof Error ? error.message : t("failedToUpdateSource"));
      throw error;
    }
  };

  // Delete source
  const handleDeleteSource = async () => {
    if (!selectedSource) return;

    try {
      const response = await fetch(
        `/api/lead-management/sources/${selectedSource.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete source");

      toast.success(t("sourceDeleted"));
      setDeleteDialogOpen(false);
      setSelectedSource(null);
      fetchSources();
    } catch (error) {
      console.error("Error deleting source:", error);
      toast.error(t("failedToDeleteSource"));
    }
  };

  // Open edit dialog
  const handleEdit = (source: LeadSource) => {
    setSelectedSource(source);
    setEditDialogOpen(true);
  };

  // Open delete confirmation
  const handleDelete = (source: LeadSource) => {
    setSelectedSource(source);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("sources")}</h1>
          <p className="text-muted-foreground">
            {t("sourcesDescription")}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
          {t("createSource")}
        </Button>
      </div>

      {/* Sources Table */}
      <SourcesTable
        sources={sources}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      {/* Create Source Dialog */}
      <CreateSourceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateSource}
      />

      {/* Edit Source Dialog */}
      <EditSourceDialog
        source={selectedSource}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateSource}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteSourceWarning", { name: selectedSource?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSource}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
