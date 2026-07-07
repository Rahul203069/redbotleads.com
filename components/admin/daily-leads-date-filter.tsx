"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const hasRange = isAllTime || hasSelectedDates || Boolean(searchParams.get("from") && searchParams.get("to"));
  const initialDate = useMemo(() => clampDateInputToToday(getDateInputValue(searchParams.get("from"))), [searchParams]);
  const initialSelectedDateValues = useMemo(() => {
    if (!enableMultipleDates || isAllTime) {
      return [];
    }

    if (selectedDateStarts.length > 0) {
      return selectedDateStarts.map(getDateInputValue);
    }

    return searchParams.get("from") && searchParams.get("to") ? [initialDate] : [];
  }, [enableMultipleDates, initialDate, isAllTime, searchParams, selectedDateStarts]);
  const todayValue = useMemo(() => getTodayInputValue(), []);
  const [dateValue, setDateValue] = useState(initialDate);
  const [selectedDateValues, setSelectedDateValues] = useState(initialSelectedDateValues);
  const [pendingRange, setPendingRange] = useState<"all" | "day" | "dates" | "today" | null>(null);
  const isToday = enableMultipleDates
    ? !isAllTime
      && selectedDateValues.length === 1
      && selectedDateValues[0] === todayValue
    : !isAllTime && getDateInputValue(searchParams.get("from")) === todayValue;
  const activeRange = pendingRange ?? (isAllTime ? "all" : isToday ? "today" : hasSelectedDates ? "dates" : "day");

  useEffect(() => {
    setDateValue(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setSelectedDateValues(initialSelectedDateValues);
  }, [initialSelectedDateValues]);

  useEffect(() => {
    setPendingRange(null);
  }, [searchParams]);

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
    setSelectedDateValues([todayValue]);
    startTransition(() => {
      router.push(
        enableMultipleDates
          ? buildMultipleDatesHref(pathname, searchParams, [todayValue])
          : buildHref(pathname, searchParams, getLocalDayRange(todayValue)),
      );
    });
  }

  function handleAllTime() {
    setPendingRange("all");
    setSelectedDateValues([]);
    startTransition(() => {
      router.push(buildAllTimeHref(pathname, searchParams));
    });
  }

  function handleApplyDates() {
    const safeDateValues = normalizeDateInputValues(selectedDateValues);
    setSelectedDateValues(safeDateValues);

    if (safeDateValues.length === 0) {
      return;
    }

    setPendingRange("dates");
    startTransition(() => {
      router.push(buildMultipleDatesHref(pathname, searchParams, safeDateValues));
    });
  }

  function handleDateRemove(value: string) {
    setSelectedDateValues((current) => current.filter((item) => item !== value));
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
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Dates</span>
            <DatePicker mode="multiple" value={selectedDateValues} onChange={setSelectedDateValues} />
          </label>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {selectedDateValues.length > 0 ? (
              <div className="flex max-w-full flex-wrap gap-2 sm:max-w-[280px]">
                {selectedDateValues.slice(0, 5).map((value) => (
                  <button
                    className="inline-flex min-h-8 items-center rounded-full bg-[#121212] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#1f1f1f]"
                    key={value}
                    onClick={() => handleDateRemove(value)}
                    type="button"
                  >
                    {formatShortDisplayDate(parseDateInputValue(value))}
                  </button>
                ))}
                {selectedDateValues.length > 5 ? (
                  <span className="inline-flex min-h-8 items-center rounded-full bg-[#121212] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                    +{selectedDateValues.length - 5}
                  </span>
                ) : null}
              </div>
            ) : null}
            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-[background-color,transform,opacity] duration-150 hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] active:translate-y-px disabled:opacity-50 sm:w-auto"
              disabled={selectedDateValues.length === 0 || (isPending && pendingRange === "dates")}
              onClick={handleApplyDates}
              type="button"
            >
              {isPending && pendingRange === "dates" ? (
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

function buildMultipleDatesHref(pathname: string, currentParams: { toString(): string }, dateValues: string[]) {
  const next = new URLSearchParams(currentParams.toString());
  next.delete("range");
  next.delete("from");
  next.delete("to");
  next.delete("date");
  next.delete("page");

  normalizeDateInputValues(dateValues).forEach((value) => {
    next.append("date", getLocalDayRange(value).from);
  });

  return `${pathname}?${next.toString()}`;
}

type DatePickerProps =
  | {
      mode: "multiple";
      onChange: (value: string[]) => void;
      value: string[];
    }
  | {
      mode: "single";
      onChange: (value: string) => void;
      value: string;
    };

function DatePicker(props: DatePickerProps) {
  const today = getTodayDate();
  const selectedDate = props.mode === "single" ? parseDateInputValue(props.value) : null;
  const selectedDates = props.mode === "multiple" ? props.value.map(parseDateInputValue) : [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex h-10 w-full items-center justify-between gap-3 rounded-[12px] border border-[#27272a] bg-[#09090b] px-3 text-left text-[13px] font-medium text-[#ffffff] outline-none transition-colors hover:border-[#3f3f46] hover:bg-[#111113] focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10 sm:w-[184px]"
          type="button"
        >
          <span>{props.mode === "multiple" ? formatMultiDateLabel(props.value) : formatDisplayDate(selectedDate ?? new Date())}</span>
          <CalendarDays className="h-4 w-4 text-[#b3b3b3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        {props.mode === "multiple" ? (
          <Calendar
            disabled={{ after: today }}
            mode="multiple"
            onSelect={(dates) => {
              props.onChange(normalizeDateInputValues((dates ?? []).filter((date) => date <= today).map(formatDateInput)));
            }}
            selected={selectedDates}
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

function formatShortDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMultiDateLabel(values: string[]) {
  if (values.length === 0) {
    return "Choose dates";
  }

  if (values.length === 1) {
    return formatDisplayDate(parseDateInputValue(values[0]));
  }

  return `${values.length} days selected`;
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
  const [year, month, day] = dateValue.split("-").map(Number);
  const from = new Date(year, month - 1, day);
  const to = new Date(year, month - 1, day + 1);

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
