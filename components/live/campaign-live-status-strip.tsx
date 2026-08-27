"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Radio,
  Settings2,
} from "lucide-react";
import Link from "next/link";

import type { CampaignLeadSyncStatus } from "@/lib/campaign-lead-empty-state";
import { formatLeadRelativeTime } from "@/lib/campaign-lead-inbox";
import type { LiveNotificationHealth } from "@/lib/live-leads";

export function CampaignLiveStatusStrip({
  campaignId,
  campaignIsActive,
  health,
  isRefreshing,
  lastCheckedAt,
  lastRefreshedAt,
  refreshFailed,
  syncStatus,
  telegramConnectedAt,
  telegramUsername,
  timeZone,
}: {
  campaignId: string;
  campaignIsActive: boolean;
  health: LiveNotificationHealth | null;
  isRefreshing: boolean;
  lastCheckedAt: string | null;
  lastRefreshedAt: string | null;
  refreshFailed: boolean;
  syncStatus: CampaignLeadSyncStatus;
  telegramConnectedAt: string | null;
  telegramUsername: string | null;
  timeZone: string;
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const isSyncing = syncStatus === "QUEUED" || syncStatus === "PROCESSING";
  const telegramConnected = Boolean(telegramConnectedAt);
  const telegramLabel = telegramUsername
    ? telegramUsername.startsWith("@") ? telegramUsername : `@${telegramUsername}`
    : "Telegram";
  const pendingCount = health?.pendingCount ?? 0;
  const failedCount = health?.failedCount ?? 0;
  const isScanning = campaignIsActive && (isSyncing || isRefreshing);
  const statusTitle = !campaignIsActive
    ? "Monitoring paused"
    : isSyncing
      ? "Checking Reddit for new posts…"
      : isRefreshing
        ? "Refreshing live feed…"
        : refreshFailed
          ? "Refresh delayed · Retrying automatically"
          : "Live monitoring active";
  const statusDetail = !campaignIsActive
    ? "Automatic checks will resume when this campaign is active."
    : isSyncing
      ? "The monitoring pipeline is processing a fresh Reddit check."
      : isRefreshing
        ? "Fetching the latest qualified posts. Your current feed stays visible."
        : refreshFailed
          ? "Your existing posts are still available while the next refresh is scheduled."
          : "New qualified posts appear here automatically while this page is open.";

  useEffect(() => {
    const firstTickId = window.setTimeout(() => setNowMs(Date.now()), 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(firstTickId);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section
      aria-label="Live monitoring and alert status"
      className="rounded-[20px] border border-white/[0.07] bg-[#181818] px-4 py-4 sm:px-5"
      id="delivery-health"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${campaignIsActive ? refreshFailed ? "bg-[#3b2d10] text-[#ffd66e]" : "bg-[#1ed760]/12 text-[#55e982]" : "bg-[#252525] text-[#8f8f8f]"}`}>
            {isScanning ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : refreshFailed && campaignIsActive ? (
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Radio aria-hidden="true" className="h-4 w-4" />
            )}
            {campaignIsActive && !refreshFailed ? (
              <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[#181818] bg-[#55e982] motion-reduce:animate-none" />
            ) : null}
          </span>
          <div className="min-w-0">
            <h2 aria-live="polite" className="text-[14px] font-bold text-white">{statusTitle}</h2>
            <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">
              {statusDetail}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-[#737373]">
              <span>
                {lastRefreshedAt && nowMs !== null
                  ? `Feed updated ${formatLeadRelativeTime(lastRefreshedAt, nowMs)}`
                  : "Waiting for the first feed refresh"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {lastCheckedAt ? `Reddit checked ${formatDateTime(lastCheckedAt, timeZone)}` : "Waiting for the first Reddit check"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <StatusPill
            icon={telegramConnected ? CheckCircle2 : BellRing}
            label={telegramConnected ? `${telegramLabel} connected` : "Telegram not connected"}
            tone={telegramConnected ? "good" : "muted"}
          />
          <StatusPill
            icon={Clock3}
            label={`${pendingCount} pending`}
            tone={pendingCount > 0 ? "warning" : "muted"}
          />
          <StatusPill
            icon={AlertTriangle}
            label={`${failedCount} failed`}
            tone={failedCount > 0 ? "danger" : "muted"}
          />
          <Link
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#252525] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors duration-200 hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70"
            href={`/settings/notifcation?campaignId=${encodeURIComponent(campaignId)}`}
          >
            <Settings2 aria-hidden="true" className="h-4 w-4" />
            Alerts
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof BellRing;
  label: string;
  tone: "danger" | "good" | "muted" | "warning";
}) {
  const toneClass = tone === "good"
    ? "bg-[#1ed760]/10 text-[#73f5a0]"
    : tone === "warning"
      ? "bg-[#3b2d10] text-[#ffd66e]"
      : tone === "danger"
        ? "bg-[#3a151b] text-[#ff9aa5]"
        : "bg-[#111111] text-[#a7a7a7]";

  return (
    <span className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3.5 text-[10px] font-bold uppercase tracking-[0.1em] ${toneClass}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}
