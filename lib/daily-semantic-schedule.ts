export const DAILY_SEMANTIC_CRON_UTC_HOUR = 6;
export const DAILY_SEMANTIC_CRON_UTC_MINUTE = 30;
export const DAILY_SEMANTIC_SCHEDULE_LABEL = "08:30 CEST";
export const DAILY_SEMANTIC_HOBBY_WINDOW_LABEL = "08:00–08:59 CEST";

export function getNextDailySemanticCronAt(now = new Date()) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    DAILY_SEMANTIC_CRON_UTC_HOUR,
    DAILY_SEMANTIC_CRON_UTC_MINUTE,
    0,
    0,
  ));

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}
