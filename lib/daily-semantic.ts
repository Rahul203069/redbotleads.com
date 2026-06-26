import { prisma } from "@/lib/prisma";
import { dailySemanticMaxCampaignsPerCron } from "@/worker/config";
import { enqueueDailySemanticCampaign } from "@/worker/queues";

export async function enqueueDailySemanticCampaigns(options?: {
  now?: Date;
  batchSize?: number;
}) {
  const now = options?.now ?? new Date();
  const batchSize = options?.batchSize ?? dailySemanticMaxCampaignsPerCron;

  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      subreddits: {
        isEmpty: false,
      },
      semanticQueries: {
        some: {},
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: batchSize,
  });

  if (campaigns.length === 0) {
    return {
      queued: 0,
      skipped: 0,
      failed: 0,
      campaignIds: [] as string[],
      failures: [] as Array<{ campaignId: string; message: string }>,
    };
  }

  const queuedAt = now.toISOString();
  const results = await Promise.allSettled(
    campaigns.map((campaign) =>
      enqueueDailySemanticCampaign({
        campaignId: campaign.id,
        queuedAt,
      }),
    ),
  );

  const queuedCampaignIds: string[] = [];
  const failures: Array<{ campaignId: string; message: string }> = [];

  results.forEach((result, index) => {
    const campaignId = campaigns[index]?.id;

    if (!campaignId) {
      return;
    }

    if (result.status === "fulfilled") {
      queuedCampaignIds.push(campaignId);
      return;
    }

    failures.push({
      campaignId,
      message: result.reason instanceof Error ? result.reason.message : "Daily semantic enqueue failed.",
    });
  });

  return {
    queued: queuedCampaignIds.length,
    skipped: Math.max(0, campaigns.length - queuedCampaignIds.length - failures.length),
    failed: failures.length,
    campaignIds: queuedCampaignIds,
    failures,
  };
}
