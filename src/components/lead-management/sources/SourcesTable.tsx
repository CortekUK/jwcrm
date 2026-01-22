"use client";

import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  salespeople: { user_id: string; full_name: string }[];
  salespeople_count: number;
}

interface SourcesTableProps {
  sources: LeadSource[];
  onEdit: (source: LeadSource) => void;
  onDelete: (source: LeadSource) => void;
  isLoading?: boolean;
}

export function SourcesTable({
  sources,
  onEdit,
  onDelete,
  isLoading,
}: SourcesTableProps) {
  const { t } = useTranslation("leadManagement");

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sourceName")}</TableHead>
              <TableHead>{t("description")}</TableHead>
              <TableHead>{t("assignedSalespeople")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("created")}</TableHead>
              <TableHead className="text-center">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-6 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-8 bg-gray-200 rounded animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">{t("noSources")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("createFirstSource")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("sourceName")}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead>{t("assignedSalespeople")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("created")}</TableHead>
            <TableHead className="text-center">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.id}>
              <TableCell className="font-medium">{source.name}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {source.description || "-"}
              </TableCell>
              <TableCell>
                {source.salespeople_count > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {source.salespeople.slice(0, 2).map((sp) => (
                      <Badge key={sp.user_id} variant="secondary" className="text-xs">
                        {sp.full_name}
                      </Badge>
                    ))}
                    {source.salespeople_count > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{source.salespeople_count - 2}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {t("noSalespersonAssigned")}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={source.is_active ? "default" : "secondary"}
                  className={source.is_active ? "bg-green-100 text-green-700" : ""}
                >
                  {source.is_active ? t("active") : t("inactive")}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {format(new Date(source.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    onClick={() => onEdit(source)}
                    title={t("editSource")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(source)}
                    title={t("deleteSource")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
