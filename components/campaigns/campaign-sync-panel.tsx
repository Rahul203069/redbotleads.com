"use client";

const SHOW_WORKER_PROGRESS_CARD = false;

export type CampaignSync = {
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

export function CampaignSyncPanel({
  sync,
  nextSyncLabel,
  summaryMetrics,
}: {
  sync: CampaignSync;
  nextSyncLabel: string;
  summaryMetrics: {
    lastSync: string;
    nextSync: string;
    leadCount: number;
    highIntentCount: number;
  };
}) {
  const progress = getProgress(sync);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Last sync" value={summaryMetrics.lastSync} />
        <MetricCard label="Next sync" value={summaryMetrics.nextSync} />
        <MetricCard label="Leads found" value={String(summaryMetrics.leadCount)} />
        <MetricCard label="Strong matches" value={String(summaryMetrics.highIntentCount)} />
      </div>

      {SHOW_WORKER_PROGRESS_CARD ? (
        <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
          <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-[24px] font-bold tracking-tight text-[#ffffff]">Worker progress</h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
                {sync?.message ?? "No sync activity yet. Activate or manually run the campaign to start processing."}
              </p>
              {sync?.lastError ? (
                <p className="mt-3 text-[14px] leading-6 text-[#f3727f]">{sync.lastError}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                <InlineStat label="Posts scraped" value={String(sync?.statsJson?.fetchedPosts ?? 0)} />
                <InlineStat label="Leads filtered" value={String(sync?.statsJson?.semanticPassedLeads ?? 0)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={sync?.status ?? "IDLE"} />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-3">
                <p className="text-[28px] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{progress}%</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Processing</p>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                {getProgressLabel(sync, nextSyncLabel)}
              </p>
            </div>

            <div className="mt-3 h-2 rounded-full bg-[#121212]">
              <div
                className={`h-2 rounded-full transition-all ${
                  sync?.status === "FAILED" ? "bg-[#f3727f]" : "bg-[#1ed760]"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>
      ) : null}
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

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <span className="text-[#ffffff]">{value}</span>
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
