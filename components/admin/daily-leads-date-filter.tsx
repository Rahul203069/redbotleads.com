"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DailyLeadsDateFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRange = Boolean(searchParams.get("from") && searchParams.get("to"));
  const initialDate = useMemo(() => getDateInputValue(searchParams.get("from")), [searchParams]);
  const [dateValue, setDateValue] = useState(initialDate);

  useEffect(() => {
    setDateValue(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (hasRange) {
      return;
    }

    router.replace(buildHref(pathname, searchParams, getLocalDayRange(getTodayInputValue())));
  }, [hasRange, pathname, router, searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildHref(pathname, searchParams, getLocalDayRange(dateValue)));
  }

  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Calendar day</span>
        <input
          className="h-10 rounded-[12px] border border-[#27272a] bg-[#09090b] px-3 text-[13px] text-[#ffffff] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
          onChange={(event) => setDateValue(event.target.value)}
          type="date"
          value={dateValue}
        />
      </label>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
        type="submit"
      >
        <CalendarDays className="h-4 w-4" />
        Apply
      </button>
    </form>
  );
}

function buildHref(pathname: string, currentParams: URLSearchParams, range: { from: string; to: string }) {
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

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
