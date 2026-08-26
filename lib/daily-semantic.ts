import { getSemanticScanScheduleBucket } from "@/lib/daily-semantic-schedule";
import { prisma } from "@/lib/prisma";
import { dailySemanticMaxCampaignsPerCron } from "@/worker/config";
import { enqueueDailySemanticCampaign } from "@/worker/queues";

type ScheduledSemanticEnqueueOptions = {
  cronRunId?: string;
  now?: Date;
  batchSize?: number;
};

export async function enqueueScheduledSemanticCampaigns(options?: ScheduledSemanticEnqueueOptions) {
  const now = options?.now ?? new Date();
  const batchSize = Math.max(1, options?.batchSize ?? dailySemanticMaxCampaignsPerCron);
  const queuedAt = now.toISOString();
  const scheduleBucket = getSemanticScanScheduleBucket(now);
  const queuedCampaignIds: string[] = [];
  const failures: Array<{ campaignId: string; message: string }> = [];
  let eligible = 0;
  let alreadyQueued = 0;
  let alreadyRunning = 0;
  let cursor: string | undefined;

  while (true) {
    const campaigns = await prisma.campaign.findMany({
      where: {
        isActive: true,
        semanticQueries: {
          some: {},
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: "asc",
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: batchSize,
    });

    if (campaigns.length === 0) {
      break;
    }

    eligible += campaigns.length;
    const results = await Promise.allSettled(
      campaigns.map((campaign) =>
        enqueueDailySemanticCampaign({
          campaignId: campaign.id,
          cronRunId: options?.cronRunId,
          queuedAt,
          runTrigger: "HOURLY_SEMANTIC",
          scheduleBucket,
          source: "hourly_scheduled",
        }),
      ),
    );

    results.forEach((result, index) => {
      const campaignId = campaigns[index]?.id;

      if (!campaignId) {
        return;
      }

      if (result.status === "rejected") {
        failures.push({
          campaignId,
          message: result.reason instanceof Error ? result.reason.message : "Scheduled semantic enqueue failed.",
        });
        return;
      }

      if (result.value.outcome === "queued") {
        queuedCampaignIds.push(campaignId);
      } else if (result.value.outcome === "already_queued") {
        alreadyQueued += 1;
      } else {
        alreadyRunning += 1;
      }
    });

    cursor = campaigns[campaigns.length - 1]?.id;

    if (campaigns.length < batchSize || !cursor) {
      break;
    }
  }

  return {
    scheduleBucket,
    eligible,
    queued: queuedCampaignIds.length,
    skipped: alreadyQueued + alreadyRunning,
    alreadyQueued,
    alreadyRunning,
    failed: failures.length,
    campaignIds: queuedCampaignIds,
    failures,
  };
}
