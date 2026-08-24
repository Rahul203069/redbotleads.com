"use client";

import { AlertTriangle, BellRing, CheckCircle2, Clock3, Settings2 } from "lucide-react";
import Link from "next/link";

import type { CampaignLeadSyncStatus } from "@/lib/campaign-lead-empty-state";
import type { LiveNotificationHealth } from "@/lib/live-leads";

export function CampaignLiveStatusStrip({
  campaignIsActive,
  health,
  lastCheckedAt,
  syncStatus,
  telegramConnectedAt,
  telegramUsername,
  timeZone,
}: {
  campaignIsActive: boolean;
  health: LiveNotificationHealth | null;
  lastCheckedAt: string | null;
  syncStatus: CampaignLeadSyncStatus;
  telegramConnectedAt: string | null;
  telegramUsername: string | null;
  timeZone: string;
}) {
  const isSyncing = syncStatus === "QUEUED" || syncStatus === "PROCESSING";
  const telegramConnected = Boolean(telegramConnectedAt);
  const telegramLabel = telegramUsername
    ? telegramUsername.startsWith("@") ? telegramUsername : `@${telegramUsername}`
    : "Telegram";
  const pendingCount = health?.pendingCount ?? 0;
  const failedCount = health?.failedCount ?? 0;

  return (
    <section
      aria-label="Live monitoring and alert status"
      className="rounded-[20px] border border-white/[0.07] bg-[#181818] px-4 py-4 sm:px-5"
      id="delivery-health"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${campaignIsActive ? "bg-[#1ed760]/12 text-[#55e982]" : "bg-[#252525] text-[#8f8f8f]"}`}>
            <BellRing aria-hidden="true" className="h-4 w-4" />
            {campaignIsActive ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#181818] bg-[#55e982]" /> : null}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-[14px] font-bold text-white">
                {campaignIsActive ? isSyncing ? "Checking Reddit now" : "Live monitoring active" : "Monitoring paused"}
              </h2>
              <span className="text-[11px] text-[#737373]">·</span>
              <p className="text-[11px] text-[#a7a7a7]">
                {lastCheckedAt ? `Last checked ${formatDateTime(lastCheckedAt, timeZone)}` : "Waiting for the first check"}
              </p>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">
              New qualified leads appear here automatically. You can keep this page open.
            </p>
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
            href="/settings/notifcation"
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
