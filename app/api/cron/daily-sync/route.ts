import { NextResponse } from "next/server";

import { enqueueDueDailyCampaignSyncs } from "@/lib/daily-sync";

const CRON_PATH = "/api/cron/daily-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET?.trim();

  console.info("Daily sync cron request received", {
    path: CRON_PATH,
    hasCronSecret: Boolean(expectedSecret),
    userAgent: request.headers.get("user-agent"),
  });

  if (expectedSecret) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${expectedSecret}`) {
      console.warn("Daily sync cron request rejected", {
        path: CRON_PATH,
        reason: authorization ? "invalid_authorization" : "missing_authorization",
      });

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("Daily sync cron request cannot run because CRON_SECRET is not configured", {
      path: CRON_PATH,
    });

    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  try {
    const result = await enqueueDueDailyCampaignSyncs();

    console.info("Daily sync cron completed", {
      path: CRON_PATH,
      queued: result.queued,
      failed: result.failed,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily sync cron failed", {
      path: CRON_PATH,
      error: error instanceof Error ? error.message : "Daily sync scheduler failed.",
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Daily sync scheduler failed.",
      },
      { status: 500 },
    );
  }
}
