export const HOURLY_SEMANTIC_CRON_PATH = "/api/cron/hourly-semantic";
export const LEGACY_DAILY_SEMANTIC_CRON_PATH = "/api/cron/daily-semantic";
export const SEMANTIC_CRON_PATHS = [
  HOURLY_SEMANTIC_CRON_PATH,
  LEGACY_DAILY_SEMANTIC_CRON_PATH,
] as const;
