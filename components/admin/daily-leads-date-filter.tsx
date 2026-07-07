"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DailyLeadsDateFilter({
  defaultRange = "today",
  enableMultipleDates = false,
}: {
  defaultRange?: "all" | "today";
  enableMultipleDates?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const isAllTime = searchParams.get("range") === "all";
  const selectedDateStarts = useMemo(() => normalizeDateStartParams(searchParams.getAll("date")), [searchParams]);
  const hasSelectedDates = enableMultipleDates && selectedDateStarts.length > 0;
  const hasSelectedRange = enableMultipleDates && Boolean(searchParams.get("from") && searchParams.get("to"));
  const hasRange = isAllTime || hasSelectedDates || hasSelectedRange || Boolean(searchParams.get("from") && searchParams.get("to"));
  const initialDate = useMemo(() => clampDateInputToToday(getDateInputValue(searchParams.get("from"))), [searchParams]);
  const initialDateRangeValue = useMemo(() => {
    if (!enableMultipleDates || isAllTime) {
      return {};
    }

    if (selectedDateStarts.length > 0) {
      const dateValues = selectedDateStarts.map(getDateInputValue);
      return normalizeDateRangeValue({
        from: dateValues[0],
        to: dateValues[dateValues.length - 1],
      });
    }

    return searchParams.get("from") && searchParams.get("to")
      ? normalizeDateRangeValue({
          from: getDateInputValue(searchParams.get("from")),
          to: getExclusiveToDateInputValue(searchParams.get("to")),
        })
      : {};
  }, [enableMultipleDates, isAllTime, searchParams, selectedDateStarts]);
  const todayValue = useMemo(() => getTodayInputValue(), []);
  const [dateValue, setDateValue] = useState(initialDate);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeInputValue>(initialDateRangeValue);
  const [pendingRange, setPendingRange] = useState<"all" | "day" | "range" | "today" | null>(null);
  const isToday = enableMultipleDates
    ? !isAllTime
      && selectedDateRange.from === todayValue
      && (selectedDateRange.to ?? selectedDateRange.from) === todayValue
    : !isAllTime && getDateInputValue(searchParams.get("from")) === todayValue;
  const activeRange = pendingRange ?? (isAllTime ? "all" : isToday ? "today" : hasSelectedDates || hasSelectedRange ? "range" : "day");

  useEffect(() => {
    setDateValue(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setSelectedDateRange(initialDateRangeValue);
  }, [initialDateRangeValue]);

  useEffect(() => {
    setPendingRange(null);
  }, [searchParams]);

  useEffect(() => {
    if (!enableMultipleDates || isAllTime || selectedDateStarts.length === 0) {
      return;
    }

    const dateValues = selectedDateStarts.map(getDateInputValue);
    const safeDateRange = normalizeDateRangeValue({
      from: dateValues[0],
      to: dateValues[dateValues.length - 1],
    });

    if (!safeDateRange.from) {
      return;
    }

    router.replace(buildHref(pathname, searchParams, getLocalDateRange(safeDateRange.from, safeDateRange.to ?? safeDateRange.from)));
  }, [enableMultipleDates, isAllTime, pathname, router, searchParams, selectedDateStarts]);

  useEffect(() => {
    if (hasRange) {
      return;
    }

    router.replace(
      defaultRange === "all"
        ? buildAllTimeHref(pathname, searchParams)
        : buildHref(pathname, searchParams, getLocalDayRange(getTodayInputValue())),
    );
  }, [defaultRange, hasRange, pathname, router, searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeDateValue = clampDateInputToToday(dateValue);
    setDateValue(safeDateValue);
    setPendingRange("day");
    startTransition(() => {
      router.push(buildHref(pathname, searchParams, getLocalDayRange(safeDateValue)));
    });
  }

  function handleToday() {
    setPendingRange("today");
    setSelectedDateRange({ from: todayValue, to: todayValue });
    startTransition(() => {
      router.push(buildHref(pathname, searchParams, getLocalDayRange(todayValue)));
    });
  }

  function handleAllTime() {
    setPendingRange("all");
    setSelectedDateRange({});
    startTransition(() => {
      router.push(buildAllTimeHref(pathname, searchParams));
    });
  }

  function handleApplyRange() {
    const safeDateRange = normalizeDateRangeValue(selectedDateRange);
    setSelectedDateRange(safeDateRange);

    if (!safeDateRange.from) {
      return;
    }

    const from = safeDateRange.from;
    const to = safeDateRange.to ?? safeDateRange.from;

    setPendingRange("range");
    startTransition(() => {
      router.push(buildHref(pathname, searchParams, getLocalDateRange(from, to)));
    });
  }

  return (
    <div aria-busy={isPending} className="flex w-full flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex w-fit rounded-full bg-[#121212] p-1 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <button className={getQuickButtonClass(activeRange === "today", isPending && pendingRange === "today")} onClick={handleToday} type="button">
          Today
        </button>
        <button className={getQuickButtonClass(activeRange === "all", isPending && pendingRange === "all")} onClick={handleAllTime} type="button">
          All time
        </button>
      </div>

      {enableMultipleDates ? (
        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Range</span>
            <DatePicker mode="range" value={selectedDateRange} onChange={setSelectedDateRange} />
          </label>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {selectedDateRange.from ? (
              <div className="flex max-w-full flex-wrap gap-2 sm:max-w-[280px]">
                <button
                  className="inline-flex min-h-8 items-center rounded-full bg-[#121212] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#1f1f1f]"
                  onClick={() => setSelectedDateRange({})}
                  type="button"
                >
                  {formatRangeLabel(selectedDateRange)}
                </button>
              </div>
            ) : null}
            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-[background-color,transform,opacity] duration-150 hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] active:translate-y-px disabled:opacity-50 sm:w-auto"
              disabled={!selectedDateRange.from || (isPending && pendingRange === "range")}
              onClick={handleApplyRange}
              type="button"
            >
              {isPending && pendingRange === "range" ? (
                <>
                  <LoadingDot />
                  Applying
                </>
              ) : (
                "Apply"
              )}
            </button>
          </div>
        </div>
      ) : (
        <form className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Date</span>
            <DatePicker mode="single" value={dateValue} onChange={setDateValue} />
          </label>
          <button
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-[background-color,transform,opacity] duration-150 hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] active:translate-y-px disabled:opacity-80 sm:w-auto"
            disabled={isPending && pendingRange === "day"}
            type="submit"
          >
            {isPending && pendingRange === "day" ? (
              <>
                <LoadingDot />
                Applying
              </>
            ) : (
              "Apply"
            )}
          </button>
        </form>
      )}
    </div>
  );
}

function buildHref(pathname: string, currentParams: { toString(): string }, range: { from: string; to: string }) {
  const next = new URLSearchParams(currentParams.toString());
  next.delete("range");
  next.delete("date");
  next.set("from", range.from);
  next.set("to", range.to);
  next.delete("page");

  return `${pathname}?${next.toString()}`;
}

function buildAllTimeHref(pathname: string, currentParams: { toString(): string }) {
  const next = new URLSearchParams(currentParams.toString());
  next.set("range", "all");
  next.delete("date");
  next.delete("from");
  next.delete("to");
  next.delete("page");

  return `${pathname}?${next.toString()}`;
}

type DateRangeInputValue = {
  from?: string;
  to?: string;
};

type DatePickerProps =
  | {
      mode: "range";
      onChange: (value: DateRangeInputValue) => void;
      value: DateRangeInputValue;
    }
  | {
      mode: "single";
      onChange: (value: string) => void;
      value: string;
    };

function DatePicker(props: DatePickerProps) {
  const today = getTodayDate();
  const selectedDate = props.mode === "single" ? parseDateInputValue(props.value) : null;
  const selectedRange = props.mode === "range" ? parseDateRangeInputValue(props.value) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex h-10 w-full items-center justify-between gap-3 rounded-[12px] border border-[#27272a] bg-[#09090b] px-3 text-left text-[13px] font-medium text-[#ffffff] outline-none transition-colors hover:border-[#3f3f46] hover:bg-[#111113] focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10 ${props.mode === "range" ? "sm:w-[300px]" : "sm:w-[184px]"}`}
          type="button"
        >
          <span>{props.mode === "range" ? formatRangeLabel(props.value) : formatDisplayDate(selectedDate ?? new Date())}</span>
          <CalendarDays className="h-4 w-4 text-[#b3b3b3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        {props.mode === "range" ? (
          <Calendar
            disabled={{ after: today }}
            mode="range"
            onSelect={(range) => {
              props.onChange(normalizeDatePickerRange(range, today));
            }}
            selected={selectedRange}
          />
        ) : (
          <Calendar
            disabled={{ after: today }}
            mode="single"
            onSelect={(date) => {
              if (date && date <= today) {
                props.onChange(formatDateInput(date));
              }
            }}
            selected={selectedDate ?? undefined}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function parseDateRangeInputValue(value: DateRangeInputValue): DateRange | undefined {
  if (!value.from) {
    return undefined;
  }

  return {
    from: parseDateInputValue(value.from),
    to: value.to ? parseDateInputValue(value.to) : undefined,
  };
}

function normalizeDatePickerRange(value: DateRange | undefined, maxDate: Date): DateRangeInputValue {
  if (!value?.from) {
    return {};
  }

  return normalizeDateRangeValue({
    from: formatDateInput(value.from > maxDate ? maxDate : value.from),
    to: value.to ? formatDateInput(value.to > maxDate ? maxDate : value.to) : undefined,
  });
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function clampDateInputToToday(value: string) {
  return parseDateInputValue(value) > getTodayDate() ? getTodayInputValue() : value;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRangeLabel(value: DateRangeInputValue) {
  if (!value.from) {
    return "Choose range";
  }

  const from = parseDateInputValue(value.from);
  const to = parseDateInputValue(value.to ?? value.from);

  if (isSameLocalDay(from, to)) {
    return formatDisplayDate(from);
  }

  const dayCount = getInclusiveDayCount(from, to);

  return `${formatDisplayDate(from)} - ${formatDisplayDate(to)} (${dayCount} days)`;
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

function getLocalDayRange(dateValue: string) {
  return getLocalDateRange(dateValue, dateValue);
}

function getLocalDateRange(fromValue: string, toValue: string) {
  const safeRange = normalizeDateRangeValue({ from: fromValue, to: toValue });
  const [fromYear, fromMonth, fromDay] = (safeRange.from ?? fromValue).split("-").map(Number);
  const [toYear, toMonth, toDay] = (safeRange.to ?? safeRange.from ?? toValue).split("-").map(Number);
  const from = new Date(fromYear, fromMonth - 1, fromDay);
  const to = new Date(toYear, toMonth - 1, toDay + 1);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function normalizeDateStartParams(values: string[]) {
  return Array.from(new Set(values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean)))
    .filter((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date <= getTodayDate();
    })
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
}

function normalizeDateInputValues(values: string[]) {
  return Array.from(new Set(values.map(clampDateInputToToday).filter(Boolean)))
    .sort((left, right) => parseDateInputValue(left).getTime() - parseDateInputValue(right).getTime());
}

function normalizeDateRangeValue(value: DateRangeInputValue): DateRangeInputValue {
  const values = normalizeDateInputValues([value.from, value.to].filter((item): item is string => Boolean(item)));

  if (values.length === 0) {
    return {};
  }

  return {
    from: values[0],
    to: values[1] ?? values[0],
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

function getExclusiveToDateInputValue(value: string | null) {
  if (!value) {
    return getTodayInputValue();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getTodayInputValue();
  }

  return formatDateInput(new Date(date.getTime() - 1));
}

function getTodayInputValue() {
  return formatDateInput(new Date());
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

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function getInclusiveDayCount(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}
