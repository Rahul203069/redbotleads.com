"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";

import { useCampaignLeadFilterLoading } from "@/components/campaigns/campaign-lead-filter-loading-provider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DailyLeadsDateFilter({
  defaultRange = "today",
  enableMultipleDates = false,
}: {
  defaultRange?: "all" | "last7" | "today";
  enableMultipleDates?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { isLeadFilterLoading, startLeadFilterLoading } = useCampaignLeadFilterLoading();
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

    if (searchParams.get("from") && searchParams.get("to")) {
      return normalizeDateRangeValue({
        from: getDateInputValue(searchParams.get("from")),
        to: getExclusiveToDateInputValue(searchParams.get("to")),
      });
    }

    if (defaultRange === "today") {
      const today = getTodayInputValue();
      return { from: today, to: today };
    }

    return {};
  }, [defaultRange, enableMultipleDates, isAllTime, searchParams, selectedDateStarts]);
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
  const isNavigating = isPending || isLeadFilterLoading;

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
    if (hasRange || defaultRange === "today") {
      return;
    }

    router.replace(
      defaultRange === "all"
        ? buildAllTimeHref(pathname, searchParams)
        : buildHref(pathname, searchParams, getLocalRecentDateRange(7)),
    );
  }, [defaultRange, hasRange, pathname, router, searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeDateValue = clampDateInputToToday(dateValue);
    const range = getLocalDayRange(safeDateValue);
    const href = buildHref(pathname, searchParams, range);

    if (isCurrentHref(pathname, searchParams, href)) {
      return;
    }

    setDateValue(safeDateValue);
    setPendingRange("day");
    startLeadFilterLoading(getLeadDateFilterKey(range));
    startTransition(() => {
      router.push(href);
    });
  }

  function handleToday() {
    if (isToday && !hasRange) {
      return;
    }

    const range = getLocalDayRange(todayValue);
    const href = buildHref(pathname, searchParams, range);

    if (isCurrentHref(pathname, searchParams, href)) {
      return;
    }

    setPendingRange("today");
    setSelectedDateRange({ from: todayValue, to: todayValue });
    startLeadFilterLoading(getLeadDateFilterKey(range));
    startTransition(() => {
      router.push(href);
    });
  }

  function handleAllTime() {
    const href = buildAllTimeHref(pathname, searchParams);

    if (isCurrentHref(pathname, searchParams, href)) {
      return;
    }

    setPendingRange("all");
    setSelectedDateRange({});
    startLeadFilterLoading(getLeadDateFilterKey({ range: "all" }));
    startTransition(() => {
      router.push(href);
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
    const range = getLocalDateRange(from, to);
    const href = buildHref(pathname, searchParams, range);

    if (isCurrentHref(pathname, searchParams, href)) {
      return;
    }

    setPendingRange("range");
    startLeadFilterLoading(getLeadDateFilterKey(range));
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <div aria-busy={isNavigating} className="flex w-full flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex w-fit rounded-full bg-[#121212] p-1 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <button className={getQuickButtonClass(activeRange === "today", isNavigating && pendingRange === "today")} onClick={handleToday} type="button">
          {isNavigating && pendingRange === "today" ? (
            <>
              <LoadingDot />
              Today
            </>
          ) : (
            "Today"
          )}
        </button>
        <button className={getQuickButtonClass(activeRange === "all", isNavigating && pendingRange === "all")} onClick={handleAllTime} type="button">
          {isNavigating && pendingRange === "all" ? (
            <>
              <LoadingDot />
              All time
            </>
          ) : (
            "All time"
          )}
        </button>
      </div>

      {enableMultipleDates ? (
        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Date</span>
            <DatePicker
              applyDisabled={!selectedDateRange.from || (isNavigating && pendingRange === "range")}
              applyLabel={isNavigating && pendingRange === "range" ? "Applying" : getRangeApplyLabel(selectedDateRange)}
              isApplying={isNavigating && pendingRange === "range"}
              mode="range"
              onApply={handleApplyRange}
              onChange={setSelectedDateRange}
              value={selectedDateRange}
            />
          </label>
        </div>
      ) : (
        <form className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Date</span>
            <DatePicker mode="single" value={dateValue} onChange={setDateValue} />
          </label>
          <button
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-[background-color,transform,opacity] duration-150 hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] active:translate-y-px disabled:opacity-80 sm:w-auto"
            disabled={isNavigating && pendingRange === "day"}
            type="submit"
          >
            {isNavigating && pendingRange === "day" ? (
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

function isCurrentHref(pathname: string, currentParams: { toString(): string }, href: string) {
  const currentQuery = currentParams.toString();
  const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;

  return currentHref === href;
}

function getLeadDateFilterKey(filter: {
  date?: string[];
  from?: string;
  range?: string;
  to?: string;
}) {
  return [
    filter.range ?? "",
    filter.from ?? "",
    filter.to ?? "",
    ...(filter.date ?? []),
  ].join("|");
}

type DateRangeInputValue = {
  from?: string;
  to?: string;
};

type DatePickerProps =
  | {
      applyDisabled?: boolean;
      applyLabel?: string;
      isApplying?: boolean;
      mode: "range";
      onApply?: () => void;
      onChange: (value: DateRangeInputValue) => void;
      value: DateRangeInputValue;
    }
  | {
      mode: "single";
      onChange: (value: string) => void;
      value: string;
    };

function DatePicker(props: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const today = getTodayDate();
  const selectedDate = props.mode === "single" ? parseDateInputValue(props.value) : null;
  const selectedRange = props.mode === "range" ? parseDateRangeInputValue(props.value) : undefined;
  const selectedRangeLabel = props.mode === "range" ? formatRangeLabel(props.value) : "";
  const selectedRangeTitle = props.mode === "range" ? getRangeSummaryTitle(props.value) : "";

  function handlePopoverApply() {
    if (props.mode !== "range" || props.applyDisabled) {
      return;
    }

    props.onApply?.();
    setIsOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex h-10 w-full items-center justify-between gap-3 rounded-[12px] border border-[#27272a] bg-[#09090b] px-3 text-left text-[13px] font-medium text-[#ffffff] outline-none transition-colors hover:border-[#3f3f46] hover:bg-[#111113] focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10 ${props.mode === "range" ? "sm:w-[220px]" : "sm:w-[184px]"}`}
          type="button"
        >
          <span className="truncate">{props.mode === "range" ? formatRangeLabel(props.value) : formatDisplayDate(selectedDate ?? new Date())}</span>
          <CalendarDays className="h-4 w-4 text-[#b3b3b3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(calc(100vw-2rem),336px)] overflow-hidden rounded-[22px] border-white/10 bg-[#101010] p-0 shadow-[0_22px_80px_rgba(0,0,0,0.65)]"
      >
        {props.mode === "range" ? (
          <div className="flex flex-col">
            <Calendar
              className="px-4 pb-3 pt-4"
              disabled={{ after: today }}
              mode="range"
              onSelect={(range) => {
                props.onChange(normalizeDatePickerRange(range, today));
              }}
              selected={selectedRange}
            />
            <div className="mx-3 mb-3 flex flex-col gap-3 rounded-[18px] border border-white/8 bg-[#080808] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71717a]">{selectedRangeTitle}</p>
                <p className="mt-1 truncate text-[13px] font-semibold text-[#ffffff]">{selectedRangeLabel}</p>
              </div>
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-[background-color,transform,opacity] duration-150 hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
                disabled={props.applyDisabled}
                onClick={handlePopoverApply}
                type="button"
              >
                {props.isApplying ? (
                  <>
                    <LoadingDot />
                    {props.applyLabel ?? "Applying"}
                  </>
                ) : (
                  props.applyLabel ?? "Apply"
                )}
              </button>
            </div>
          </div>
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
    return "Choose date";
  }

  const from = parseDateInputValue(value.from);
  const to = parseDateInputValue(value.to ?? value.from);

  if (isSameLocalDay(from, to)) {
    return formatDisplayDate(from);
  }

  const dayCount = getInclusiveDayCount(from, to);

  return `${formatDisplayDate(from)} - ${formatDisplayDate(to)} (${dayCount} days)`;
}

function getRangeApplyLabel(value: DateRangeInputValue) {
  return isSingleDateSelection(value) ? "Apply date" : "Apply range";
}

function getRangeSummaryTitle(value: DateRangeInputValue) {
  return isSingleDateSelection(value) ? "Selected date" : "Selected range";
}

function isSingleDateSelection(value: DateRangeInputValue) {
  if (!value.from) {
    return true;
  }

  return (value.to ?? value.from) === value.from;
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

function getLocalRecentDateRange(days: number) {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - Math.max(0, days - 1));

  return getLocalDateRange(formatDateInput(from), formatDateInput(today));
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
