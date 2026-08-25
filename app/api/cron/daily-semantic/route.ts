import { handleHourlySemanticCronRequest } from "@/lib/hourly-semantic-cron";
import { LEGACY_DAILY_SEMANTIC_CRON_PATH } from "@/lib/semantic-cron-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compatibility alias for existing probes and operational bookmarks.
export async function GET(request: Request) {
  return handleHourlySemanticCronRequest(request, LEGACY_DAILY_SEMANTIC_CRON_PATH);
}
