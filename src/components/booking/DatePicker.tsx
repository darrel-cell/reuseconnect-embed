import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  className?: string;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  minDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    // Close the popover when a date is selected
    if (selectedDate) {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="truncate">{date ? format(date, "P") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          disabled={(date) => {
            if (minDate) {
              // Compare dates by setting time to midnight
              const compareDate = new Date(date);
              compareDate.setHours(0, 0, 0, 0);
              const compareMinDate = new Date(minDate);
              compareMinDate.setHours(0, 0, 0, 0);
              return compareDate < compareMinDate;
            }
            return false;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

