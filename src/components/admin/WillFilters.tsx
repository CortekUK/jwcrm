import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface WillFiltersProps {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateFromFilter: string;
  onDateFromFilterChange: (value: string) => void;
  dateToFilter: string;
  onDateToFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

export function WillFilters({
  statusFilter,
  onStatusFilterChange,
  dateFromFilter,
  onDateFromFilterChange,
  dateToFilter,
  onDateToFilterChange,
  onClearFilters,
}: WillFiltersProps) {
  const hasActiveFilters = statusFilter !== "all" || dateFromFilter || dateToFilter;

  return (
    <div className="bg-card border rounded-lg p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_progress">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#9E9E9E]" />
                    In Progress
                  </span>
                </SelectItem>
                <SelectItem value="awaiting_review">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C6A03B]" />
                    Awaiting Review
                  </span>
                </SelectItem>
                <SelectItem value="under_review">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#557A95]" />
                    Under Review
                  </span>
                </SelectItem>
                <SelectItem value="draft_ready">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0C5536]" />
                    Draft Ready
                  </span>
                </SelectItem>
                <SelectItem value="draft_released">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#128277]" />
                    Draft Released
                  </span>
                </SelectItem>
                <SelectItem value="finalized">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#083D29]" />
                    Finalized
                  </span>
                </SelectItem>
              </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-2">
          <Label htmlFor="date-from">From Date</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFromFilter}
            onChange={(e) => onDateFromFilterChange(e.target.value)}
          />
        </div>

        <div className="flex-1 space-y-2">
          <Label htmlFor="date-to">To Date</Label>
          <Input
            id="date-to"
            type="date"
            value={dateToFilter}
            onChange={(e) => onDateToFilterChange(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <Button variant="outline" onClick={onClearFilters} className="shrink-0">
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
