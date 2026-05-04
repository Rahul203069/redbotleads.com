"use client";

import { useEffect, useState, useTransition } from "react";

import { getCampaignSyncStatuses } from "@/actions/campaigns";

type CampaignSync = {
  status: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: "NONE" | "QUEUED" | "FETCHING_POSTS" | "FETCHING_COMMENTS" | "CLASSIFYING" | "NOTIFYING" | "COMPLETED" | "FAILED";
  message: string | null;
  lastError: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lastHeartbeat: string | null;
  updatedAt: string;
  statsJson: {
    fetchedPosts?: number;
    promisingPosts?: number;
    fetchedComments?: number;
    matchedItems?: number;
    createdLeads?: number;
    embeddedLeads?: number;
    semanticCheckedLeads?: number;
    semanticPassedLeads?: number;
    semanticFilteredLeads?: number;
    classifiedLeads?: number;
    durationMs?: number;
  } | null;
} | null;

function isStatsJson(
  value: unknown,
): value is NonNullable<NonNullable<CampaignSync>["statsJson"]> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSync(sync: unknown): CampaignSync {
  if (!sync || typeof sync !== "object") {
    return null;
  }

  const value = sync as Record<string, unknown>;

  return {
    status: value.status as NonNullable<CampaignSync>["status"],
    stage: value.stage as NonNullable<CampaignSync>["stage"],
    message: typeof value.message === "string" ? value.message : null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
    queuedAt: typeof value.queuedAt === "string" ? value.queuedAt : null,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
    failedAt: typeof value.failedAt === "string" ? value.failedAt : null,
    lastHeartbeat: typeof value.lastHeartbeat === "string" ? value.lastHeartbeat : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    statsJson: isStatsJson(value.statsJson) ? value.statsJson : null,
  };
}

export function CampaignSyncPanel({
  campaignId,
  initialSync,
  nextSyncLabel,
  summaryMetrics,
}: {
  campaignId: string;
  initialSync: CampaignSync;
  nextSyncLabel: string;
  summaryMetrics: {
    lastSync: string;
    nextSync: string;
    leadCount: number;
    highIntentCount: number;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [sync, setSync] = useState<CampaignSync>(initialSync);

  const isLive = sync?.status === "QUEUED" || sync?.status === "PROCESSING";
  const progress = getProgress(sync);

  useEffect(() => {
    setSync(initialSync);
  }, [initialSync]);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const poll = () => {
      startTransition(async () => {
        const [latest] = await getCampaignSyncStatuses([campaignId]);
        setSync(normalizeSync(latest?.sync ?? null));
      });
    };

    poll();
    const intervalId = window.setInterval(poll, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [campaignId, isLive]);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Last sync" value={summaryMetrics.lastSync} />
        <MetricCard label="Next sync" value={summaryMetrics.nextSync} />
        <MetricCard label="Leads found" value={String(summaryMetrics.leadCount)} />
        <MetricCard label="Strong matches" value={String(summaryMetrics.highIntentCount)} />
      </div>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
              Current message
            </p>
            <h2 className="mt-2 text-[24px] font-bold tracking-tight text-[#ffffff]">Worker progress</h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
              {sync?.message ?? "No sync activity yet. Activate or manually run the campaign to start processing."}
            </p>
            {sync?.lastError ? (
              <p className="mt-3 text-[14px] leading-6 text-[#f3727f]">{sync.lastError}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={sync?.status ?? "IDLE"} />
            {isPending && isLive ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                Refreshing
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-[20px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                Processing
              </p>
              <p className="mt-2 text-[28px] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">
                {progress}%
              </p>
            </div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
              {getProgressLabel(sync, nextSyncLabel)}
            </p>
          </div>

          <div className="mt-4 h-2 rounded-full bg-[#121212]">
            <div
              className={`h-2 rounded-full transition-all ${
                sync?.status === "FAILED" ? "bg-[#f3727f]" : "bg-[#1ed760]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#181818] px-5 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">{label}</div>
      <div className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{value}</div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: NonNullable<CampaignSync>["status"];
}) {
  const tone =
    status === "COMPLETED"
      ? "bg-[#121212] text-[#1ed760]"
      : status === "FAILED"
        ? "bg-[#121212] text-[#f3727f]"
        : status === "PROCESSING"
          ? "bg-[#121212] text-[#ffffff]"
          : "bg-[#121212] text-[#cbcbcb]";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {status}
    </span>
  );
}

function getProgress(sync: CampaignSync) {
  if (!sync) {
    return 0;
  }

  if (sync.status === "COMPLETED") {
    return 100;
  }

  if (sync.status === "FAILED") {
    return sync.stage === "CLASSIFYING" ? 82 : sync.stage === "FETCHING_POSTS" ? 45 : 12;
  }

  if (sync.status === "QUEUED") {
    return 12;
  }

  if (sync.stage === "FETCHING_POSTS") {
    return 45;
  }

  if (sync.stage === "CLASSIFYING") {
    return 82;
  }

  return 0;
}

function getProgressLabel(sync: CampaignSync, nextSyncLabel: string) {
  if (!sync || sync.status === "IDLE") {
    return nextSyncLabel;
  }

  if (sync.status === "FAILED") {
    return "Needs attention";
  }

  if (sync.status === "COMPLETED") {
    return "Finished";
  }

  if (sync.status === "QUEUED") {
    return "Queued";
  }

  if (sync.stage === "FETCHING_POSTS") {
    return "Fetching";
  }

  if (sync.stage === "CLASSIFYING") {
    return "Classifying";
  }

  return "Running";
}
