import { handleHourlySemanticCronRequest } from "@/lib/hourly-semantic-cron";
import { HOURLY_SEMANTIC_CRON_PATH } from "@/lib/semantic-cron-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleHourlySemanticCronRequest(request, HOURLY_SEMANTIC_CRON_PATH);
}
