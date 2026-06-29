"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DailySubredditDateFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const hasRange = Boolean(searchParams.get("from") && searchParams.get("to"));
  const todayValue = useMemo(() => getTodayInputValue(), []);
  const yesterdayValue = useMemo(() => getRelativeDateInputValue(-1), []);
  const initialDate = useMemo(() => clampDateInputToToday(getDateInputValue(searchParams.get("from"))), [searchParams]);
  const [dateValue, setDateValue] = useState(initialDate);
  const [pendingRange, setPendingRange] = useState<"custom" | "today" | "yesterday" | null>(null);
  const activeDate = getDateInputValue(searchParams.get("from"));
  const activeRange = pendingRange ?? (activeDate === todayValue ? "today" : activeDate === yesterdayValue ? "yesterday" : "custom");

  useEffect(() => {
    setDateValue(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setPendingRange(null);
  }, [searchParams]);

  useEffect(() => {
    if (hasRange) {
      return;
    }

    router.replace(buildHref(pathname, searchParams, getLocalDayRange(todayValue)));
  }, [hasRange, pathname, router, searchParams, todayValue]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeDateValue = clampDateInputToToday(dateValue);

    setDateValue(safeDateValue);
    setPendingRange("custom");
    startTransition(() => {
      router.push(buildHref(pathname, searchParams, getLocalDayRange(safeDateValue)));
    });
  }

  function handleQuickDate(target: "today" | "yesterday", value: string) {
    setPendingRange(target);
    setDateValue(value);
    startTransition(() => {
      router.push(buildHref(pathname, searchParams, getLocalDayRange(value)));
    });
  }

  return (
    <div aria-busy={isPending} className="flex w-full flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex w-fit rounded-full bg-[#121212] p-1 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <button className={getQuickButtonClass(activeRange === "today", isPending && pendingRange === "today")} onClick={() => handleQuickDate("today", todayValue)} type="button">
          Today
        </button>
        <button className={getQuickButtonClass(activeRange === "yesterday", isPending && pendingRange === "yesterday")} onClick={() => handleQuickDate("yesterday", yesterdayValue)} type="button">
          Yesterday
        </button>
      </div>

      <form className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Custom date</span>
          <DatePicker value={dateValue} onChange={setDateValue} />
        </label>
        <button
          className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-[background-color,transform,opacity] duration-150 hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] active:translate-y-px disabled:opacity-80 sm:w-auto"
          disabled={isPending && pendingRange === "custom"}
          type="submit"
        >
          {isPending && pendingRange === "custom" ? (
            <>
              <LoadingDot />
              Applying
            </>
          ) : (
            "Apply date"
          )}
        </button>
      </form>
    </div>
  );
}

function DatePicker({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const selectedDate = parseDateInputValue(value);
  const today = getTodayDate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex h-10 w-full items-center justify-between gap-3 rounded-[12px] border border-[#27272a] bg-[#09090b] px-3 text-left text-[13px] font-medium text-[#ffffff] outline-none transition-colors hover:border-[#3f3f46] hover:bg-[#111113] focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10 sm:w-[168px]"
          type="button"
        >
          <span>{formatDisplayDate(selectedDate)}</span>
          <CalendarDays className="h-4 w-4 text-[#b3b3b3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <Calendar
          disabled={{ after: today }}
          mode="single"
          onSelect={(date) => {
            if (date && date <= today) {
              onChange(formatDateInput(date));
            }
          }}
          selected={selectedDate}
        />
      </PopoverContent>
    </Popover>
  );
}

function buildHref(pathname: string, currentParams: { toString(): string }, range: { from: string; to: string }) {
  const next = new URLSearchParams(currentParams.toString());
  next.set("from", range.from);
  next.set("to", range.to);

  return `${pathname}?${next.toString()}`;
}

function getLocalDayRange(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const from = new Date(year, month - 1, day);
  const to = new Date(year, month - 1, day + 1);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function getDateInputValue(value: string | null) {
  if (!value) {
    return getTodayInputValue();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getTodayInputValue();
  }

  return formatDateInput(date);
}

function getTodayInputValue() {
  return formatDateInput(new Date());
}

function getRelativeDateInputValue(dayDelta: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayDelta);

  return formatDateInput(date);
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function clampDateInputToToday(value: string) {
  return parseDateInputValue(value) > getTodayDate() ? getTodayInputValue() : value;
}

function getTodayDate() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return today;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function LoadingDot() {
  return <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-[#121212]" />;
}

function getQuickButtonClass(active: boolean, pending: boolean) {
  return [
    "relative h-9 rounded-full px-5 text-[11px] font-bold uppercase tracking-[0.14em] transition-[background-color,color,transform,opacity] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] active:translate-y-px",
    active ? "bg-[#ffffff] text-[#121212]" : "text-[#b3b3b3] hover:bg-[#1f1f1f] hover:text-[#ffffff]",
    pending ? "opacity-80" : "",
  ].join(" ");
}
