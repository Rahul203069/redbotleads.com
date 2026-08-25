export const HOURLY_SEMANTIC_INTERVAL_MS = 60 * 60 * 1000;
export const HOURLY_SEMANTIC_SCHEDULE_LABEL = "Every hour";

export function getHourlySemanticScheduleBucket(now = new Date()) {
  return now.toISOString().slice(0, 13);
}

export function getNextHourlySemanticCronAt(now = new Date()) {
  const nextBoundary =
    (Math.floor(now.getTime() / HOURLY_SEMANTIC_INTERVAL_MS) + 1)
    * HOURLY_SEMANTIC_INTERVAL_MS;

  return new Date(nextBoundary);
}
