import { prisma } from "@/lib/prisma";

import {
  markCampaignCompleted,
  updateCampaignProgress,
  type SyncStats,
} from "./campaign-sync";
import { markCampaignRunCompleted, markCampaignRunProcessing } from "./campaign-runs";

const LEAD_PROCESSING_CAUGHT_UP_MESSAGE =
  "Lead processing caught up; RSS ingestion is still polling remaining subreddits.";

type FinalizeCampaignLeadProcessingOptions = {
  campaignId: string;
  campaignRunId?: string;
  stats?: SyncStats;
  completeMessage: string;
  pendingMessage?: (remainingLeads: number) => string;
};

type RssIngestionCompletionStats = SyncStats & {
  rssIngestionCompleted: true;
  rssIngestionCompletedAt: string;
};

export function withRssIngestionCompleted(stats: SyncStats): RssIngestionCompletionStats {
  return {
    ...stats,
    rssIngestionCompleted: true,
    rssIngestionCompletedAt: new Date().toISOString(),
  };
}

export async function finalizeCampaignLeadProcessing({
  campaignId,
  campaignRunId,
  stats,
  completeMessage,
  pendingMessage = (remainingLeads) =>
    `${remainingLeads} lead${remainingLeads === 1 ? "" : "s"} still waiting for AI scoring.`,
}: FinalizeCampaignLeadProcessingOptions) {
  const remainingLeads = await countPendingLeadProcessing(campaignId);

  if (remainingLeads > 0) {
    const message = pendingMessage(remainingLeads);
    await updateCampaignProgress(campaignId, "CLASSIFYING", message, stats);
    await markCampaignRunProcessing(campaignRunId, message, stats);
    return {
      completed: false,
      reason: "pending_leads" as const,
      remainingLeads,
    };
  }

  const rssIngestionCompleted = await isRssIngestionCompleted(campaignRunId);

  if (!rssIngestionCompleted) {
    await updateCampaignProgress(
      campaignId,
      "CLASSIFYING",
      LEAD_PROCESSING_CAUGHT_UP_MESSAGE,
      stats,
    );
    await markCampaignRunProcessing(
      campaignRunId,
      LEAD_PROCESSING_CAUGHT_UP_MESSAGE,
      stats,
    );
    return {
      completed: false,
      reason: "rss_ingestion_active" as const,
      remainingLeads,
    };
  }

  await markCampaignCompleted(campaignId, completeMessage, stats);
  await markCampaignRunCompleted(campaignRunId, completeMessage, stats);

  return {
    completed: true,
    reason: "completed" as const,
    remainingLeads,
  };
}

async function countPendingLeadProcessing(campaignId: string) {
  return prisma.lead.count({
    where: {
      campaignId,
      ai: null,
    },
  });
}

async function isRssIngestionCompleted(campaignRunId: string | null | undefined) {
  if (!campaignRunId) {
    return true;
  }

  const run = await prisma.campaignRun.findUnique({
    where: {
      id: campaignRunId,
    },
    select: {
      statsJson: true,
    },
  });

  return isJsonObject(run?.statsJson) && run.statsJson.rssIngestionCompleted === true;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
