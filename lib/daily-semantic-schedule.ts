export const SEMANTIC_SCAN_INTERVAL_MS = 30 * 60 * 1000;
export const SEMANTIC_SCAN_SCHEDULE_LABEL = "Every 30 minutes";

export function getSemanticScanScheduleBucket(now = new Date()) {
  const bucketStart = Math.floor(now.getTime() / SEMANTIC_SCAN_INTERVAL_MS) * SEMANTIC_SCAN_INTERVAL_MS;

  return new Date(bucketStart).toISOString().slice(0, 16);
}

export function getNextSemanticScanAt(now = new Date()) {
  const nextBoundary =
    (Math.floor(now.getTime() / SEMANTIC_SCAN_INTERVAL_MS) + 1)
    * SEMANTIC_SCAN_INTERVAL_MS;

  return new Date(nextBoundary);
}
