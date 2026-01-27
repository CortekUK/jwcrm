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
  Target,
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
        return "bg-[#E6F7F1] text-[#0C5536] border-0";
      case "lost":
        return "bg-[#FEECEC] text-[#C0392B] border-0";
      case "pending":
        return "bg-[#FFF9E6] text-[#C6A03B] border-0";
      case "qualified":
        return "bg-[#F3E8FF] text-[#7C3AED] border-0";
      case "negotiation":
        return "bg-[#E6F0FF] text-[#4F46E5] border-0";
      case "meeting":
        return "bg-[#E6F0FF] text-[#2563EB] border-0";
      case "consultation":
        return "bg-[#E0F2FE] text-[#0369A1] border-0";
      case "contacted":
        return "bg-[#E6F7F1] text-[#0C5536] border-0";
      case "hold":
        return "bg-[#FFF7ED] text-[#D97706] border-0";
      case "not_started":
      default:
        return "bg-[#F5F5F5] text-[#6B6B6B] border-0";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      not_started: t("notStarted"),
      contacted: t("contacted"),
      consultation: t("consultation"),
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  if (!salesperson) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="h-9 w-9 rounded-full border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
            >
              <ArrowLeft className="h-4 w-4 text-[#555555]" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <User className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
                <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {salesperson.full_name}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-[#777777] ltr:ml-9 rtl:mr-9">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{salesperson.email}</span>
              </div>
            </div>
          </div>
          {/* KPI Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
            <Target className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
            <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
              {leads.length} {t("leads")}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && <SalespersonStatsCard stats={stats} isLoading={false} />}

      {/* Leads Section */}
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4 bg-[#FAFAF8]" style={{ borderBottom: '1px solid #EAEAE8' }}>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("assignedLeads")}
            </CardTitle>
          </div>
          <CardDescription className="text-[#777777]">
            {t("viewingSalesperson", { name: salesperson.full_name })}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C6A03B]" />
              <Input
                placeholder={t("searchLeads")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltr:pl-9 rtl:pr-9 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]">
                <SelectValue placeholder={t("filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="not_started">{t("notStarted")}</SelectItem>
                <SelectItem value="contacted">{t("contacted")}</SelectItem>
                <SelectItem value="consultation">{t("consultation")}</SelectItem>
                <SelectItem value="meeting">{t("meeting")}</SelectItem>
                <SelectItem value="hold">{t("hold")}</SelectItem>
                <SelectItem value="qualified">{t("qualified")}</SelectItem>
                <SelectItem value="negotiation">{t("negotiation")}</SelectItem>
                <SelectItem value="pending">{t("pending")}</SelectItem>
                <SelectItem value="won">{t("won")}</SelectItem>
                <SelectItem value="lost">{t("lost")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leads Table */}
          {filteredLeads.length === 0 ? (
            <div className="rounded-lg border border-[#E6E6E4] p-12 text-center">
              <Target className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("noLeads")}</p>
              <p className="text-sm text-[#6B6B6B] mt-1">
                {t("noMatchingLeads", "No matching leads found")}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAF8]" style={{ borderBottom: '1px solid #EAEAE8' }}>
                    <TableHead className="font-semibold text-[#555555]">{t("name")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("email")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("source")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("created")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("status")}</TableHead>
                    <TableHead className="font-semibold text-[#555555] text-center">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="transition-colors hover:bg-[#FDFBF4]" style={{ borderBottom: '1px solid #EAEAE8' }}>
                      <TableCell className="font-medium text-[#222222]">
                        {lead.full_name}
                      </TableCell>
                      <TableCell className="text-[#555555]">{lead.email}</TableCell>
                      <TableCell className="text-[#555555]">
                        {lead.source_data?.name ||
                          lead.source
                            ?.replace(/[_-]/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase()) ||
                          "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#555555]">
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
                            className="h-8 w-8 text-[#999999] hover:text-[hsl(var(--jw-primary-green))] hover:bg-[#E6F7F1]"
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

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice", "© 2024 Just Wills. All rights reserved.")}
        </p>
      </div>
    </div>
  );
}
