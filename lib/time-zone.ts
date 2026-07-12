export const BROWSER_TIME_ZONE_COOKIE = "redbot_time_zone";
export const DEFAULT_TIME_ZONE = "UTC";

export function normalizeTimeZone(value: string | null | undefined) {
  const rawCandidate = String(value ?? "").trim();
  let candidate = rawCandidate;

  try {
    candidate = decodeURIComponent(rawCandidate);
  } catch {
    candidate = rawCandidate;
  }

  if (!candidate) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function formatDateTimeInTimeZone(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: normalizeTimeZone(timeZone),
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateInTimeZone(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function getDateKeyInTimeZone(value: Date, timeZone: string) {
  const parts = getDateTimeParts(value, timeZone);
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${padDatePart(shifted.getUTCMonth() + 1)}-${padDatePart(shifted.getUTCDate())}`;
}

export function getDayRangeInTimeZone(dateKey: string, timeZone: string) {
  return {
    from: zonedDateTimeToUtc(dateKey, timeZone),
    to: zonedDateTimeToUtc(addDaysToDateKey(dateKey, 1), timeZone),
  };
}

function zonedDateTimeToUtc(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  let result = new Date(utcMidnight - getTimeZoneOffsetMs(new Date(utcMidnight), timeZone));
  const correctedOffset = getTimeZoneOffsetMs(result, timeZone);

  if (correctedOffset !== getTimeZoneOffsetMs(new Date(utcMidnight), timeZone)) {
    result = new Date(utcMidnight - correctedOffset);
  }

  return result;
}

function getTimeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = getDateTimeParts(value, timeZone, true);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return representedAsUtc - value.getTime();
}

function getDateTimeParts(value: Date, timeZone: string, includeTime = false) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: includeTime ? "2-digit" : undefined,
    hourCycle: includeTime ? "h23" : undefined,
    minute: includeTime ? "2-digit" : undefined,
    month: "2-digit",
    second: includeTime ? "2-digit" : undefined,
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    day: parts.day,
    hour: includeTime ? parts.hour : 0,
    minute: includeTime ? parts.minute : 0,
    month: parts.month,
    second: includeTime ? parts.second : 0,
    year: parts.year,
  };
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}
