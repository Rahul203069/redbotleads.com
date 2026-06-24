import { prisma } from "@/lib/prisma";

export type SyncStats = {
  fetchedPosts?: number;
  promisingPosts?: number;
  fetchedComments?: number;
  matchedItems?: number;
  createdLeads?: number;
  queuedEmbeddingBatches?: number;
  embeddedLeads?: number;
  semanticCheckedLeads?: number;
  semanticPassedLeads?: number;
  semanticFilteredLeads?: number;
  classifiedLeads?: number;
  classificationFailedLeads?: number;
  rssIngestionCompleted?: boolean;
  rssIngestionCompletedAt?: string;
  durationMs?: number;
};

function isSyncStats(value: unknown): value is SyncStats {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getMergedStats(campaignId: string, nextStats?: SyncStats) {
  if (!nextStats) {
    return undefined;
  }

  const existing = await prisma.campaignSync.findUnique({
    where: {
      campaignId,
    },
    select: {
      statsJson: true,
    },
  });

  const previousStats = isSyncStats(existing?.statsJson) ? existing.statsJson : undefined;
  return {
    ...previousStats,
    ...nextStats,
  };
}

export async function markCampaignQueued(campaignId: string, message: string) {
  return prisma.campaignSync.upsert({
    where: {
      campaignId,
    },
    update: {
      status: "QUEUED",
      stage: "QUEUED",
      message,
      lastError: null,
      queuedAt: new Date(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      lastHeartbeat: new Date(),
    },
    create: {
      campaignId,
      status: "QUEUED",
      stage: "QUEUED",
      message,
      queuedAt: new Date(),
      lastHeartbeat: new Date(),
    },
  });
}

export async function markCampaignProcessing(
  campaignId: string,
  stage: "FETCHING_POSTS" | "FETCHING_COMMENTS" | "CLASSIFYING" | "NOTIFYING",
  message: string,
  stats?: SyncStats,
) {
  const mergedStats = await getMergedStats(campaignId, stats);

  return prisma.campaignSync.upsert({
    where: {
      campaignId,
    },
    update: {
      status: "PROCESSING",
      stage,
      message,
      lastError: null,
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
    create: {
      campaignId,
      status: "PROCESSING",
      stage,
      message,
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
  });
}

export async function updateCampaignProgress(
  campaignId: string,
  stage: "FETCHING_POSTS" | "FETCHING_COMMENTS" | "CLASSIFYING" | "NOTIFYING",
  message: string,
  stats?: SyncStats,
) {
  const mergedStats = await getMergedStats(campaignId, stats);

  return prisma.campaignSync.upsert({
    where: {
      campaignId,
    },
    update: {
      status: "PROCESSING",
      stage,
      message,
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
    create: {
      campaignId,
      status: "PROCESSING",
      stage,
      message,
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
  });
}

export async function markCampaignCompleted(campaignId: string, message: string, stats?: SyncStats) {
  const mergedStats = await getMergedStats(campaignId, stats);

  return prisma.campaignSync.upsert({
    where: {
      campaignId,
    },
    update: {
      status: "COMPLETED",
      stage: "COMPLETED",
      message,
      lastError: null,
      completedAt: new Date(),
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
    create: {
      campaignId,
      status: "COMPLETED",
      stage: "COMPLETED",
      message,
      completedAt: new Date(),
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
  });
}

export async function markCampaignFailed(
  campaignId: string,
  stage: "FETCHING_POSTS" | "FETCHING_COMMENTS" | "CLASSIFYING" | "NOTIFYING" | "FAILED",
  errorMessage: string,
  stats?: SyncStats,
) {
  const mergedStats = await getMergedStats(campaignId, stats);

  return prisma.campaignSync.upsert({
    where: {
      campaignId,
    },
    update: {
      status: "FAILED",
      stage: stage === "FAILED" ? "FAILED" : stage,
      message: errorMessage,
      lastError: errorMessage,
      failedAt: new Date(),
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
    create: {
      campaignId,
      status: "FAILED",
      stage: stage === "FAILED" ? "FAILED" : stage,
      message: errorMessage,
      lastError: errorMessage,
      failedAt: new Date(),
      lastHeartbeat: new Date(),
      statsJson: mergedStats,
    },
  });
}
