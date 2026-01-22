"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[160px] justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
          {date ? format(date, "MMM d, yyyy") : placeholder}
          {clearable && date && (
            <span
              role="button"
              className="ltr:ml-auto rtl:mr-auto p-0.5 rounded-sm hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onDateChange(undefined);
              }}
            >
              <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            onDateChange(newDate);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
