"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { Search, Eye, Edit, UserX, Plus, Users, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

// Helper function to get initials
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_role: { name: string } | null;
  department: { name: string } | null;
  employment_status: string;
  start_date: string;
}

interface Department {
  id: string;
  name: string;
}

interface EmployeeTableProps {
  employees: Employee[];
  departments: Department[];
  onAddNew: () => void;
  onEdit: (id: string) => void;
  onDeactivate: (employee: Employee) => void;
}

export function EmployeeTable({
  employees,
  departments,
  onAddNew,
  onEdit,
  onDeactivate,
}: EmployeeTableProps) {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.job_role?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || emp.employment_status === statusFilter;

    const matchesDepartment =
      departmentFilter === "all" || emp.department?.name === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#E6F7F1] text-[#0C5536] border-[#0C5536]/20",
      inactive: "bg-gray-100 text-gray-600 border-gray-300",
      on_leave: "bg-[#FFF9E6] text-[#C6A03B] border-[#C6A03B]/20",
      terminated: "bg-red-50 text-red-600 border-red-200",
    };

    return (
      <Badge variant="outline" className={styles[status] || styles.inactive}>
        {t(`hr:status.${status}`)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
            <Input
              placeholder={t("hr:searchEmployees")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-[#E6E6E4]"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] border-[#E6E6E4]">
              <SelectValue placeholder={t("hr:allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hr:allStatuses")}</SelectItem>
              <SelectItem value="active">{t("hr:status.active")}</SelectItem>
              <SelectItem value="inactive">{t("hr:status.inactive")}</SelectItem>
              <SelectItem value="on_leave">{t("hr:status.on_leave")}</SelectItem>
              <SelectItem value="terminated">{t("hr:status.terminated")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Department Filter */}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px] border-[#E6E6E4]">
              <SelectValue placeholder={t("hr:allDepartments")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hr:allDepartments")}</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Add Employee Button */}
        <Button
          onClick={onAddNew}
          className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("hr:addEmployee")}
        </Button>
      </div>

      {/* Table */}
      <div className="border border-[#E6E6E4] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#FAFAF8]">
              <TableHead className="text-[#555555] font-semibold">{t("hr:name")}</TableHead>
              <TableHead className="text-[#555555] font-semibold">{t("hr:jobRole")}</TableHead>
              <TableHead className="text-[#555555] font-semibold">{t("hr:department")}</TableHead>
              <TableHead className="text-[#555555] font-semibold">{t("hr:startDate")}</TableHead>
              <TableHead className="text-[#555555] font-semibold">{t("hr:statusColumn")}</TableHead>
              <TableHead className="text-[#555555] font-semibold text-right">{t("hr:actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-[#6B6B6B]">
                    <Users className="h-12 w-12 text-[#E6E6E4]" />
                    <p>{t("hr:noEmployeesFound")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="hover:bg-[#FAFAF8] cursor-pointer"
                  onClick={() => router.push(`/admin/hr/employees/${employee.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-[#E6E6E4]">
                        <AvatarFallback className="bg-[hsl(var(--jw-gold-accent))] text-white text-xs font-medium">
                          {getInitials(employee.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-[#222222]">{employee.full_name}</p>
                        {employee.email && (
                          <p className="text-sm text-[#6B6B6B]">{employee.email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#555555]">
                    {employee.job_role?.name || "-"}
                  </TableCell>
                  <TableCell className="text-[#555555]">
                    {employee.department?.name || "-"}
                  </TableCell>
                  <TableCell className="text-[#555555]">
                    {format(new Date(employee.start_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>{getStatusBadge(employee.employment_status)}</TableCell>
                  <TableCell className="text-right">
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/hr/employees/${employee.id}`)}
                            className="cursor-pointer"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t("hr:viewDetails")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onEdit(employee.id)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t("hr:edit")}
                          </DropdownMenuItem>
                          {employee.employment_status === "active" && (
                            <DropdownMenuItem
                              onClick={() => onDeactivate(employee)}
                              className="cursor-pointer text-red-600 focus:text-red-700"
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              {t("hr:deactivate")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        {t("hr:showingResults", { count: filteredEmployees.length, total: employees.length })}
      </div>
    </div>
  );
}
