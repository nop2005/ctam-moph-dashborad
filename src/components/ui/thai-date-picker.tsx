import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ThaiDatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export function ThaiDatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  disabled = false,
}: ThaiDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [displayMonth, setDisplayMonth] = React.useState<Date>(new Date());

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      return new Date(value);
    } catch {
      return undefined;
    }
  }, [value]);

  // Update display month when selected date changes
  React.useEffect(() => {
    if (selectedDate) {
      setDisplayMonth(selectedDate);
    }
  }, [selectedDate]);

  const formatThaiDate = (date: Date | undefined) => {
    if (!date) return "";
    const buddhistYear = date.getFullYear() + 543;
    const formatted = format(date, "d MMMM", { locale: th });
    return `${formatted} ${buddhistYear}`;
  };

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const isoDate = format(date, "yyyy-MM-dd");
      onChange(isoDate);
    } else {
      onChange("");
    }
    setOpen(false);
  };

  // Generate year options (current year +/- 50 years in Buddhist Era)
  const currentYear = new Date().getFullYear();
  const years = React.useMemo(() => {
    const result = [];
    for (let y = currentYear - 100; y <= currentYear + 10; y++) {
      result.push(y);
    }
    return result;
  }, [currentYear]);

  const handleMonthChange = (monthIndex: string) => {
    const newDate = setMonth(displayMonth, parseInt(monthIndex));
    setDisplayMonth(newDate);
  };

  const handleYearChange = (year: string) => {
    const newDate = setYear(displayMonth, parseInt(year));
    setDisplayMonth(newDate);
  };

  // Custom caption component with month/year dropdowns
  const CustomCaption = ({ displayMonth: captionMonth }: { displayMonth: Date }) => {
    const buddhistYear = captionMonth.getFullYear() + 543;
    const monthIndex = captionMonth.getMonth();

    return (
      <div className="flex justify-center items-center gap-1 py-2">
        <Select value={monthIndex.toString()} onValueChange={handleMonthChange}>
          <SelectTrigger className="h-8 w-[120px] text-sm font-medium border-none shadow-none focus:ring-0 px-2">
            <SelectValue>{THAI_MONTHS[monthIndex]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {THAI_MONTHS.map((month, idx) => (
              <SelectItem key={idx} value={idx.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={captionMonth.getFullYear().toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="h-8 w-[90px] text-sm font-medium border-none shadow-none focus:ring-0 px-2">
            <SelectValue>{buddhistYear}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year + 543}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? formatThaiDate(selectedDate) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          locale={th}
          showOutsideDays
          className={cn("p-3 pointer-events-auto")}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "hidden",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
            day_range_end: "day-range-end",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
          }}
          components={{
            Caption: CustomCaption,
            IconLeft: () => <ChevronLeft className="h-4 w-4" />,
            IconRight: () => <ChevronRight className="h-4 w-4" />,
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
