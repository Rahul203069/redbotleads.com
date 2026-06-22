import { prisma } from "@/lib/prisma";

import { markCampaignCompleted, markCampaignFailed } from "./campaign-sync";
import {
  classificationQueue,
  embeddingQueue,
  ingestionQueue,
  semanticQueue,
} from "./queues";

const LIVE_JOB_STATES = ["waiting", "active", "delayed", "prioritized"] as const;
const STALE_SYNC_THRESHOLD_MS = 2 * 60 * 1000;
const MAX_JOBS_TO_SCAN_PER_QUEUE = 500;

type ReconciledSync = {
  status: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: "NONE" | "QUEUED" | "FETCHING_POSTS" | "FETCHING_COMMENTS" | "CLASSIFYING" | "NOTIFYING" | "COMPLETED" | "FAILED";
  message: string | null;
  lastError: string | null;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  lastHeartbeat: Date | null;
  statsJson: unknown;
  updatedAt: Date;
} | null;

export async function reconcileCampaignSyncState(campaignId: string): Promise<ReconciledSync> {
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      sync: {
        select: {
          status: true,
          stage: true,
          message: true,
          lastError: true,
          queuedAt: true,
          startedAt: true,
          completedAt: true,
          failedAt: true,
          lastHeartbeat: true,
          statsJson: true,
          updatedAt: true,
        },
      },
    },
  });

  const sync = campaign?.sync ?? null;

  if (!sync || (sync.status !== "PROCESSING" && sync.status !== "QUEUED")) {
    return sync;
  }

  const heartbeatAt = sync.lastHeartbeat ?? sync.updatedAt;

  if (Date.now() - heartbeatAt.getTime() < STALE_SYNC_THRESHOLD_MS) {
    return sync;
  }

  const [hasLiveJobs, hasIngestionWorkers] = await Promise.all([
    hasLiveJobsForCampaign(campaignId),
    hasLiveIngestionWorkers(),
  ]);

  if (sync.status === "QUEUED") {
    if (hasLiveJobs && hasIngestionWorkers) {
      return sync;
    }

    const staleMinutes = Math.max(
      1,
      Math.round((Date.now() - heartbeatAt.getTime()) / 60000),
    );
    const reason = hasLiveJobs
      ? "the ingestion worker is not connected"
      : "no live queue job was found";

    await markCampaignFailed(
      campaignId,
      "FAILED",
      `Sync stayed queued for ${staleMinutes} minute${staleMinutes === 1 ? "" : "s"} because ${reason}.`,
    );

    const refreshedQueued = await prisma.campaignSync.findUnique({
      where: {
        campaignId,
      },
      select: {
        status: true,
        stage: true,
        message: true,
        lastError: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
        failedAt: true,
        lastHeartbeat: true,
        statsJson: true,
        updatedAt: true,
      },
    });

    return refreshedQueued;
  }

  if (hasLiveJobs) {
    return sync;
  }

  const pendingLeadCount = await prisma.lead.count({
    where: {
      campaignId,
      ai: null,
    },
  });

  if (pendingLeadCount === 0 && sync.stage === "CLASSIFYING") {
    await markCampaignCompleted(
      campaignId,
      "Lead processing finalized after a stale sync check.",
    );
  } else {
    const staleMinutes = Math.max(
      1,
      Math.round((Date.now() - heartbeatAt.getTime()) / 60000),
    );
    const details =
      pendingLeadCount > 0
        ? ` ${pendingLeadCount} lead${pendingLeadCount === 1 ? "" : "s"} still had no AI result.`
        : "";

    const failureStage =
      sync.stage === "FETCHING_POSTS" ||
      sync.stage === "FETCHING_COMMENTS" ||
      sync.stage === "CLASSIFYING" ||
      sync.stage === "NOTIFYING"
        ? sync.stage
        : "FAILED";

    await markCampaignFailed(
      campaignId,
      failureStage,
      `Sync stalled after ${staleMinutes} minute${staleMinutes === 1 ? "" : "s"} with no live worker jobs.${details}`,
    );
  }

  const refreshed = await prisma.campaignSync.findUnique({
    where: {
      campaignId,
    },
    select: {
      status: true,
      stage: true,
      message: true,
      lastError: true,
      queuedAt: true,
      startedAt: true,
      completedAt: true,
      failedAt: true,
      lastHeartbeat: true,
      statsJson: true,
      updatedAt: true,
    },
  });

  return refreshed;
}

async function hasLiveIngestionWorkers() {
  try {
    return (await ingestionQueue.getWorkersCount()) > 0;
  } catch {
    return false;
  }
}

async function hasLiveJobsForCampaign(campaignId: string) {
  const queues = [ingestionQueue, embeddingQueue, semanticQueue, classificationQueue];
  const jobsByQueue = await Promise.all(
    queues.map((queue) =>
      queue.getJobs([...LIVE_JOB_STATES], 0, MAX_JOBS_TO_SCAN_PER_QUEUE, true),
    ),
  );

  return jobsByQueue.some((jobs) =>
    jobs.some((job) => {
      const data = job.data as Record<string, unknown> | undefined;
      return data?.campaignId === campaignId;
    }),
  );
}
