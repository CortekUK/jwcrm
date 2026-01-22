"use client";

import { useState, useEffect, use } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { SalespersonStatsCard, SalespersonStats } from "@/components/lead-management/SalespersonStatsCard";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Search,
  Mail,
  History,
  Loader2,
  User,
} from "lucide-react";

interface LeadData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  source: string | null;
  source_id: string | null;
  status: string;
  is_paid: boolean;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  source_data?: { id: string; name: string } | null;
}

interface SalespersonData {
  user_id: string;
  full_name: string;
  email: string;
}

export default function SalespersonViewPage({
  params,
}: {
  params: Promise<{ salespersonId: string }>;
}) {
  const resolvedParams = use(params);
  const { t } = useTranslation("leadManagement");
  const router = useRouter();

  const [salesperson, setSalesperson] = useState<SalespersonData | null>(null);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [stats, setStats] = useState<SalespersonStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const fetchSalespersonData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/lead-management/salesperson/${resolvedParams.salespersonId}/leads`
        );

        if (!response.ok) {
          if (response.status === 404) {
            toast.error(t("salespersonNotFound"));
            router.push("/admin/lead-management/leads");
            return;
          }
          throw new Error("Failed to fetch salesperson data");
        }

        const { data } = await response.json();
        setSalesperson(data.salesperson);
        setLeads(data.leads);
        setStats(data.stats);
      } catch (error) {
        console.error("Error fetching salesperson data:", error);
        toast.error(t("failedToFetchSalespersonData"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalespersonData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.salespersonId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won":
        return "bg-green-100 text-green-800";
      case "lost":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "qualified":
        return "bg-purple-100 text-purple-800";
      case "negotiation":
        return "bg-indigo-100 text-indigo-800";
      case "meeting":
        return "bg-blue-100 text-blue-800";
      case "hold":
        return "bg-orange-100 text-orange-800";
      case "not_started":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      not_started: t("notStarted"),
      meeting: t("meeting"),
      hold: t("hold"),
      qualified: t("qualified"),
      negotiation: t("negotiation"),
      pending: t("pending"),
      won: t("won"),
      lost: t("lost"),
    };
    return statusMap[status] || status;
  };

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      searchQuery === "" ||
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStatus =
      statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!salesperson) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {salesperson.full_name}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{salesperson.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && <SalespersonStatsCard stats={stats} isLoading={false} />}

      {/* Leads Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("assignedLeads")}</CardTitle>
          <CardDescription>
            {t("viewingSalesperson", { name: salesperson.full_name })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchLeads")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltr:pl-9 rtl:pr-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="not_started">{t("notStarted")}</SelectItem>
                <SelectItem value="contacted">{t("contacted")}</SelectItem>
                <SelectItem value="consultation">{t("consultation")}</SelectItem>
                <SelectItem value="qualified">{t("qualified")}</SelectItem>
                <SelectItem value="pending">{t("pending")}</SelectItem>
                <SelectItem value="won">{t("won")}</SelectItem>
                <SelectItem value="lost">{t("lost")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leads Table */}
          {filteredLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("noLeads")}</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("source")}</TableHead>
                    <TableHead>{t("created")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-center">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.full_name}
                      </TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>
                        {lead.source_data?.name ||
                          lead.source
                            ?.replace(/[_-]/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase()) ||
                          "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(lead.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(lead.status)}>
                          {getStatusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              router.push(
                                `/admin/lead-management/leads/${lead.id}`
                              )
                            }
                            title={t("viewHistory")}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
