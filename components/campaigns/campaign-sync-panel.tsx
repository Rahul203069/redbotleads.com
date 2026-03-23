"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { getCampaignSyncStatuses } from "@/actions/campaigns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const stageOrder = ["QUEUED", "FETCHING_POSTS", "CLASSIFYING", "COMPLETED"] as const;

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
}: {
  campaignId: string;
  initialSync: CampaignSync;
}) {
  const [isPending, startTransition] = useTransition();
  const [sync, setSync] = useState<CampaignSync>(initialSync);

  const isLive = sync?.status === "QUEUED" || sync?.status === "PROCESSING";
  const stats = sync?.statsJson;

  const visibleStats = useMemo(
    () =>
      [
        { label: "Posts fetched", value: stats?.fetchedPosts },
        { label: "Promising posts", value: stats?.promisingPosts },
        { label: "Matched items", value: stats?.matchedItems },
        { label: "Leads created", value: stats?.createdLeads },
        { label: "Leads embedded", value: stats?.embeddedLeads },
        { label: "Semantic checked", value: stats?.semanticCheckedLeads },
        { label: "Semantic passed", value: stats?.semanticPassedLeads },
        { label: "Semantic filtered", value: stats?.semanticFilteredLeads },
        { label: "Leads classified", value: stats?.classifiedLeads },
        { label: "Duration", value: typeof stats?.durationMs === "number" ? formatDuration(stats.durationMs) : undefined },
      ].filter((item) => item.value !== undefined),
    [stats],
  );

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
    <Card className="overflow-hidden border-[#27272a] bg-[linear-gradient(180deg,rgba(17,17,19,0.98),rgba(9,9,11,0.98))]">
      <CardHeader className="border-b border-[#27272a] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-[1.65rem]">Campaign sync</CardTitle>
            <CardDescription>
              Live worker state from the database. This updates while ingestion and classification are running.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={sync?.status ?? "IDLE"} />
            <StageBadge stage={sync?.stage ?? "NONE"} />
            {isPending && isLive ? <span className="text-xs uppercase tracking-[0.22em] text-[#71717a]">Refreshing</span> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="rounded-[24px] border border-[#27272a] bg-[#111113]/80 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.26em] text-[#d4d4d8]">Current update</p>
              <p className="mt-3 text-base leading-7 text-[#fafafa]">
                {sync?.message ?? "No sync activity yet. Create or activate a campaign to queue work."}
              </p>
              {sync?.lastError ? <p className="mt-3 text-sm leading-6 text-[#fca5a5]">{sync.lastError}</p> : null}
            </div>
            <div className="grid min-w-full gap-3 text-sm lg:min-w-[290px]">
              <TimeRow label="Queued" value={sync?.queuedAt} />
              <TimeRow label="Started" value={sync?.startedAt} />
              <TimeRow label="Heartbeat" value={sync?.lastHeartbeat} />
              <TimeRow label="Finished" value={sync?.completedAt ?? sync?.failedAt} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {stageOrder.map((stage, index) => (
            <StageStep key={stage} stage={stage} sync={sync} index={index + 1} />
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleStats.length > 0 ? (
            visibleStats.map((stat) => <StatTile key={stat.label} label={stat.label} value={String(stat.value)} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-[#27272a] bg-[#111113]/70 px-4 py-6 text-sm leading-6 text-[#a1a1aa] md:col-span-2 xl:col-span-4">
              No worker metrics stored yet for this campaign.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StageStep({
  stage,
  sync,
  index,
}: {
  stage: (typeof stageOrder)[number];
  sync: CampaignSync;
  index: number;
}) {
  const state = getStageState(stage, sync);
  const tone =
    state === "complete"
      ? "border-[#52525b] bg-[#18181b] text-[#fafafa]"
      : state === "active"
        ? "border-[#3f3f46] bg-[#141416] text-[#e4e4e7]"
        : state === "failed"
          ? "border-[#7f1d1d] bg-[#241313] text-[#fca5a5]"
          : "border-[#27272a] bg-[#111113] text-[#71717a]";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="text-[11px] uppercase tracking-[0.24em]">Step {index}</div>
      <div className="mt-3 text-sm font-medium uppercase tracking-[0.16em]">{formatStage(stage)}</div>
      <div className="mt-3 text-xs uppercase tracking-[0.2em]">
        {state === "complete" ? "Done" : state === "active" ? "In progress" : state === "failed" ? "Failed" : "Waiting"}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#27272a] bg-[#111113]/75 p-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#71717a]">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#fafafa]">{value}</div>
    </div>
  );
}

function TimeRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#27272a] pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs uppercase tracking-[0.22em] text-[#71717a]">{label}</span>
      <span className="text-sm text-[#d4d4d8]">{value ? formatDateTime(value) : "Not set"}</span>
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
      ? "border-[#52525b] bg-[#18181b] text-[#fafafa]"
      : status === "FAILED"
        ? "border-[#7f1d1d] bg-[#241313] text-[#fca5a5]"
        : status === "PROCESSING"
          ? "border-[#3f3f46] bg-[#141416] text-[#e4e4e7]"
          : "border-[#27272a] bg-[#18181b] text-[#d4d4d8]";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${tone}`}>{status}</span>;
}

function StageBadge({
  stage,
}: {
  stage: NonNullable<CampaignSync>["stage"];
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#27272a] bg-[#111113] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#a1a1aa]">
      {formatStage(stage)}
    </span>
  );
}

function getStageState(stage: (typeof stageOrder)[number], sync: CampaignSync) {
  if (!sync) {
    return "pending";
  }

  const currentIndex = stageOrder.indexOf(
    sync.stage === "FAILED" || sync.stage === "NONE" ? "QUEUED" : (sync.stage as (typeof stageOrder)[number]),
  );
  const targetIndex = stageOrder.indexOf(stage);

  if (sync.status === "FAILED" && targetIndex === currentIndex) {
    return "failed";
  }

  if (targetIndex < currentIndex || sync.status === "COMPLETED") {
    return "complete";
  }

  if (targetIndex === currentIndex && (sync.status === "QUEUED" || sync.status === "PROCESSING")) {
    return "active";
  }

  return "pending";
}

function formatStage(stage: NonNullable<CampaignSync>["stage"]) {
  if (stage === "CLASSIFYING") {
    return "PROCESSING LEADS";
  }

  return stage.replace(/_/g, " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  return `${minutes}m ${remainderSeconds}s`;
}
