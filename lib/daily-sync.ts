import { BETA_OWNER_EMAILS, isOwnerEmail } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { enqueueDailyIngest, ensureIngestionQueueReady } from "@/worker/queues";

const DAILY_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_SYNC_BATCH_SIZE = 25;

export async function enqueueDueDailyCampaignSyncs(options?: {
  now?: Date;
  batchSize?: number;
}) {
  const now = options?.now ?? new Date();
  const cutoff = new Date(now.getTime() - DAILY_SYNC_INTERVAL_MS);
  const batchSize = options?.batchSize ?? DEFAULT_DAILY_SYNC_BATCH_SIZE;

  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      user: {
        email: {
          in: [...BETA_OWNER_EMAILS],
          mode: "insensitive",
        },
      },
    },
    select: {
      id: true,
      user: {
        select: {
          email: true,
        },
      },
      sync: {
        select: {
          status: true,
          completedAt: true,
          failedAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
  });

  const dueCampaigns = campaigns
    .filter((campaign) => isOwnerEmail(campaign.user.email))
    .filter((campaign) => {
      if (!campaign.sync) {
        return true;
      }

      if (campaign.sync.status === "QUEUED" || campaign.sync.status === "PROCESSING") {
        return false;
      }

      const lastSyncAt = campaign.sync.completedAt ?? campaign.sync.failedAt ?? campaign.sync.updatedAt;
      return lastSyncAt.getTime() <= cutoff.getTime();
    })
    .slice(0, batchSize);

  if (dueCampaigns.length === 0) {
    return {
      queued: 0,
      skipped: campaigns.length,
      failed: 0,
      campaignIds: [] as string[],
      failures: [] as Array<{ campaignId: string; message: string }>,
    };
  }

  await ensureIngestionQueueReady();

  const results = await Promise.allSettled(
    dueCampaigns.map((campaign) =>
      enqueueDailyIngest(
        {
          campaignId: campaign.id,
          trigger: "daily_sync",
        },
        { skipHealthChecks: true },
      ),
    ),
  );

  const queuedCampaignIds: string[] = [];
  const failures: Array<{ campaignId: string; message: string }> = [];

  results.forEach((result, index) => {
    const campaignId = dueCampaigns[index]?.id;

    if (!campaignId) {
      return;
    }

    if (result.status === "fulfilled") {
      queuedCampaignIds.push(campaignId);
      return;
    }

    failures.push({
      campaignId,
      message: result.reason instanceof Error ? result.reason.message : "Daily sync enqueue failed.",
    });
  });

  return {
    queued: queuedCampaignIds.length,
    skipped: campaigns.length - dueCampaigns.length,
    failed: failures.length,
    campaignIds: queuedCampaignIds,
    failures,
  };
}
