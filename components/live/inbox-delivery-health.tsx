"use client";

import {
  AlertTriangle,
  CheckCheck,
  Clock3,
  ExternalLink,
  Send,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { NotificationHandlingButton } from "@/components/live/notification-handling-actions";
import { useToast } from "@/components/ui/use-toast";
import type { LiveNotificationHealth, LiveNotificationIssue } from "@/lib/live-leads";

export function InboxDeliveryHealth({
  health,
  includesDemo,
  telegramConnectedAt,
  telegramUsername,
  timeZone,
}: {
  health: LiveNotificationHealth;
  includesDemo: boolean;
  telegramConnectedAt: string | null;
  telegramUsername: string | null;
  timeZone: string;
}) {
  const [dismissedDemoIds, setDismissedDemoIds] = useState<string[]>([]);
  const { toast } = useToast();
  const visibleIssues = useMemo(
    () => health.issues.filter((issue) => !dismissedDemoIds.includes(issue.id)),
    [dismissedDemoIds, health.issues],
  );
  const dismissedDemoIssues = health.issues.filter((issue) => dismissedDemoIds.includes(issue.id));
  const pendingCount = Math.max(
    0,
    health.pendingCount - dismissedDemoIssues.filter((issue) => issue.status === "PENDING").length,
  );
  const failedCount = Math.max(
    0,
    health.failedCount - dismissedDemoIssues.filter((issue) => issue.status === "FAILED").length,
  );
  const telegramConnected = Boolean(telegramConnectedAt);
  const telegramLabel = telegramUsername
    ? telegramUsername.startsWith("@") ? telegramUsername : `@${telegramUsername}`
    : "Telegram chat connected";

  function dismissDemoIssue(issue: LiveNotificationIssue) {
    setDismissedDemoIds((current) => current.includes(issue.id) ? current : [...current, issue.id]);
    toast({
      title: "Demo alert handled",
      description: "This frontend-only delivery issue was cleared locally. Your database was not changed.",
    });
  }

  return (
    <section
      className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] sm:p-5 lg:p-6"
      id="delivery-health"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Send aria-hidden="true" className="h-4 w-4 text-[#55e982]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#55e982]">Instant alert health</p>
            {includesDemo ? (
              <span className="rounded-full bg-[#1ed760]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#73f5a0]">
                Demo included
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-[21px] font-bold tracking-[-0.03em] text-white sm:text-[24px]">
            {telegramConnected ? "Telegram alerts are connected" : "Connect Telegram for instant leads"}
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-[#a7a7a7]">
            {telegramConnected
              ? `${telegramLabel} receives qualified opportunities while they are still fresh. Reviewing a lead automatically handles its alert.`
              : "Your Inbox remains available here. Connect Telegram when you want new qualified opportunities delivered immediately."}
          </p>
        </div>
        <Link
          className={`inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 sm:w-auto ${telegramConnected ? "bg-[#1f1f1f] text-white hover:bg-[#292929]" : "bg-[#1ed760] text-[#0d160f] hover:bg-[#3be477]"}`}
          href="/settings/notifcation"
        >
          <Settings2 aria-hidden="true" className="h-4 w-4" />
          {telegramConnected ? "Manage Telegram" : "Connect Telegram"}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <HealthMetric
          label="Telegram"
          tone={telegramConnected ? "good" : "muted"}
          value={telegramConnected ? "Connected" : "Optional"}
        />
        <HealthMetric label="Pending" tone={pendingCount > 0 ? "warning" : "muted"} value={String(pendingCount)} />
        <HealthMetric label="Failed" tone={failedCount > 0 ? "danger" : "muted"} value={String(failedCount)} />
      </div>

      <div className="mt-5 border-t border-white/[0.07] pt-5">
        {visibleIssues.length ? (
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffb36b]">Needs attention</p>
                <h3 className="mt-1 text-[17px] font-bold text-white">Recent delivery issues</h3>
              </div>
              <p className="text-[11px] text-[#777]">Only pending or failed alerts appear here.</p>
            </div>
            <div className="mt-4 grid gap-3">
              {visibleIssues.map((issue) => (
                <DeliveryIssueCard
                  issue={issue}
                  key={issue.id}
                  onHandleDemo={() => dismissDemoIssue(issue)}
                  timeZone={timeZone}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-[18px] border border-[#1ed760]/15 bg-[#111811] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1ed760]/10 text-[#73f5a0]">
                <CheckCheck aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-white">Delivery is healthy</p>
                <p className="mt-1 text-[12px] leading-5 text-[#9f9f9f]">No unhandled pending or failed alerts need attention.</p>
              </div>
            </div>
            <LastSent value={health.lastSentAt} timeZone={timeZone} />
          </div>
        )}
        {visibleIssues.length && health.lastSentAt ? (
          <div className="mt-4 flex justify-end">
            <LastSent value={health.lastSentAt} timeZone={timeZone} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DeliveryIssueCard({
  issue,
  onHandleDemo,
  timeZone,
}: {
  issue: LiveNotificationIssue;
  onHandleDemo: () => void;
  timeZone: string;
}) {
  const title = issue.lead.redditItem.title || issue.lead.redditItem.body || "Reddit lead";

  return (
    <article className={`rounded-[18px] border p-4 ${issue.status === "FAILED" ? "border-[#f3727f]/25 bg-[#1d1214]" : "border-[#ffd66e]/20 bg-[#1c1910]"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DeliveryStatusBadge status={issue.status} />
            <span className="rounded-full bg-[#111111] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#c7c7c7]">{issue.channel}</span>
            {issue.isDemo ? <span className="rounded-full bg-[#1ed760]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#73f5a0]">Demo</span> : null}
          </div>
          <h4 className="mt-3 text-[14px] font-bold leading-6 text-white [overflow-wrap:anywhere]">{title}</h4>
          <p className="mt-1 text-[11px] leading-5 text-[#8f8f8f]">
            {issue.campaignDisplayName} · r/{issue.lead.redditItem.subreddit} · {issue.lead.score}% match
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#737373]">
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
            Created {formatDateTime(issue.createdAt, timeZone)}
          </p>
          {issue.error ? (
            <p className="mt-3 flex items-start gap-2 rounded-[12px] bg-black/20 p-3 text-[11px] leading-5 text-[#ffb0b8]">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {issue.error}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-[#1ed760] px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0d160f] transition-colors hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70"
            href={buildLeadHref(issue)}
          >
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            Open lead
          </Link>
          {issue.isDemo ? (
            <button
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-[#1f1f1f] px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70"
              onClick={onHandleDemo}
              type="button"
            >
              <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Mark handled
            </button>
          ) : (
            <NotificationHandlingButton notificationId={issue.id} />
          )}
        </div>
      </div>
    </article>
  );
}

function HealthMetric({ label, tone, value }: { label: string; tone: "danger" | "good" | "muted" | "warning"; value: string }) {
  const color = tone === "good"
    ? "text-[#73f5a0]"
    : tone === "warning"
      ? "text-[#ffd66e]"
      : tone === "danger"
        ? "text-[#ff9aa5]"
        : "text-white";

  return (
    <div className="rounded-[18px] bg-[#111111] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#777]">{label}</p>
      <p className={`mt-2 text-[18px] font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DeliveryStatusBadge({ status }: { status: "FAILED" | "PENDING" }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] ${status === "FAILED" ? "bg-[#3a151b] text-[#ff9aa5]" : "bg-[#3b2d10] text-[#ffd66e]"}`}>
      {status}
    </span>
  );
}

function LastSent({ value, timeZone }: { value: string | null; timeZone: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777]">
      {value ? `Last alert sent ${formatDateTime(value, timeZone)}` : "No successful alerts yet"}
    </p>
  );
}

function buildLeadHref(issue: LiveNotificationIssue) {
  const params = new URLSearchParams({
    campaign: issue.lead.campaignId,
    lead: issue.lead.id,
    status: "ALL",
  });
  return `/inbox?${params.toString()}#lead-${issue.lead.id}`;
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
