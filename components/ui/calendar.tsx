"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-1", className)}
      classNames={{
        root: "relative",
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "flex items-center justify-center pt-1",
        caption_label: "text-[13px] font-bold text-[#ffffff]",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1f1f1f] text-[#b3b3b3] transition-colors hover:bg-[#252525] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
        button_next:
          "absolute right-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1f1f1f] text-[#b3b3b3] transition-colors hover:bg-[#252525] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "w-9 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717a]",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-[13px] focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1f1f1f] text-[#b3b3b3] transition-colors hover:bg-[#252525] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
        selected:
          "[&>button]:bg-[#1ed760] [&>button]:text-[#121212] [&>button]:hover:bg-[#3be477] [&>button]:hover:text-[#121212]",
        today: "[&>button]:bg-[#1f1f1f] [&>button]:text-[#ffffff]",
        outside: "[&>button]:text-[#52525b] [&>button]:opacity-60",
        disabled: "[&>button]:text-[#3f3f46] [&>button]:opacity-50",
        range_start:
          "[&>button]:bg-[#1ed760] [&>button]:text-[#121212] [&>button]:hover:bg-[#3be477] [&>button]:hover:text-[#121212]",
        range_end:
          "[&>button]:bg-[#1ed760] [&>button]:text-[#121212] [&>button]:hover:bg-[#3be477] [&>button]:hover:text-[#121212]",
        range_middle:
          "[&>button]:bg-[#14532d] [&>button]:text-[#ffffff] [&>button]:hover:bg-[#166534] [&>button]:hover:text-[#ffffff]",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
