"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        root: "relative w-full",
        months: "flex flex-col",
        month: "space-y-4",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-[13px] font-semibold text-[#ffffff]",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[#b3b3b3] transition-colors hover:border-white/14 hover:bg-white/[0.08] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
        button_next:
          "absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[#b3b3b3] transition-colors hover:border-white/14 hover:bg-white/[0.08] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-center",
        weekday: "w-10 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717a]",
        week: "mt-1 flex w-full justify-center",
        day: "relative h-10 w-10 p-0 text-center text-[13px] focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-[#d4d4d8] transition-[background-color,color,box-shadow] duration-150 hover:bg-white/[0.08] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
        selected:
          "[&>button]:bg-[#1ed760] [&>button]:text-[#121212] [&>button]:hover:bg-[#3be477] [&>button]:hover:text-[#121212]",
        today: "[&>button]:text-[#ffffff] [&>button]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
        outside: "[&>button]:text-[#52525b] [&>button]:opacity-55",
        disabled: "[&>button]:text-[#3f3f46] [&>button]:opacity-45 [&>button]:hover:bg-transparent [&>button]:hover:text-[#3f3f46]",
        range_start:
          "[&>button]:bg-[#1ed760] [&>button]:text-[#121212] [&>button]:hover:bg-[#3be477] [&>button]:hover:text-[#121212]",
        range_end:
          "[&>button]:bg-[#1ed760] [&>button]:text-[#121212] [&>button]:hover:bg-[#3be477] [&>button]:hover:text-[#121212]",
        range_middle:
          "[&>button]:rounded-full [&>button]:bg-[#1ed760]/18 [&>button]:text-[#d9fbe5] [&>button]:hover:bg-[#1ed760]/28 [&>button]:hover:text-[#ffffff]",
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
