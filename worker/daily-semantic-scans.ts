import { randomUUID } from "node:crypto";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type DailySemanticScanStatus = "MATCHED" | "NO_MATCH";

export type DailySemanticScanInput = {
  campaignId: string;
  redditItemId: string;
  campaignRunId?: string | null;
  status: DailySemanticScanStatus;
  bestScore?: number | null;
  bestQueryId?: string | null;
  bestQueryText?: string | null;
};

export async function upsertDailySemanticScan(input: DailySemanticScanInput) {
  await upsertDailySemanticScans([input]);
}

export async function upsertDailySemanticScans(inputs: DailySemanticScanInput[]) {
  if (inputs.length === 0) {
    return;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "CampaignDailySemanticScan" (
        "id",
        "campaignId",
        "redditItemId",
        "campaignRunId",
        "status",
        "bestScore",
        "bestQueryId",
        "bestQueryText",
        "createdAt",
        "updatedAt"
      )
      VALUES ${Prisma.join(inputs.map((input) => Prisma.sql`(
        ${randomUUID()},
        ${input.campaignId},
        ${input.redditItemId},
        ${input.campaignRunId ?? null},
        CAST(${input.status} AS "CampaignDailySemanticScanStatus"),
        ${input.bestScore ?? null},
        ${input.bestQueryId ?? null},
        ${input.bestQueryText ?? null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )`))}
      ON CONFLICT ("campaignId", "redditItemId")
      DO UPDATE SET
        "status" = EXCLUDED."status",
        "campaignRunId" = COALESCE(EXCLUDED."campaignRunId", "CampaignDailySemanticScan"."campaignRunId"),
        "bestScore" = EXCLUDED."bestScore",
        "bestQueryId" = EXCLUDED."bestQueryId",
        "bestQueryText" = EXCLUDED."bestQueryText",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
  );
}
