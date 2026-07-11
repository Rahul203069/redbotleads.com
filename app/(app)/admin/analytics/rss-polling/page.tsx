import Link from "next/link";
import { redirect } from "next/navigation";


import { RssPollLogCopyButton } from "@/components/admin/rss-poll-log-copy-button";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import type { Prisma, SubredditRssPollSource, SubredditRssPollStatus } from "@/generated/prisma/client";

type SearchParams = {
  source?: string;
  status?: string;
  subreddit?: string;
  window?: string;
};

const DEFAULT_LIMIT = 200;
const sourceOptions = ["ALL", "SUBREDDIT_DAILY_INGEST", "RSS_POLL"] as const;
const statusOptions = [
  "ALL",
  "FETCHING",
  "SUCCESS",
  "RATE_LIMIT_RETRYING",
  "RATE_LIMITED",
  "NOT_FOUND",
  "HTTP_ERROR",
  "NETWORK_ERROR",
  "BACKOFF_SKIPPED",
] as const;
const windowOptions = [
  { label: "24h", value: "24h", hours: 24 },
  { label: "7d", value: "7d", hours: 24 * 7 },
  { label: "30d", value: "30d", hours: 24 * 30 },
] as const;




"use client";

import { useEffect, useState } from "react";

type BrowserDateTimeProps = {
  value: string;
  className?: string;
  fallbackTimeZone?: string;
};

const DEFAULT_FALLBACK_TIME_ZONE = "Asia/Kolkata";

export function BrowserDateTime({
  value,
  className,
  fallbackTimeZone = DEFAULT_FALLBACK_TIME_ZONE,
}: BrowserDateTimeProps) {
  const [displayValue, setDisplayValue] = useState(() =>
    formatDateTime(value, fallbackTimeZone),
  );

  useEffect(() => {
    const browserTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || fallbackTimeZone;

    setDisplayValue(formatDateTime(value, browserTimeZone));
  }, [value, fallbackTimeZone]);

  return (
    <time className={className} dateTime={value} title={new Date(value).toISOString()}>
      {displayValue}
    </time>
  );
}

function formatDateTime(value: string, timeZone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}





export default async function AdminRssPollingLogsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const params = await Promise.resolve(searchParams ?? {});
  const selectedSource = sourceOptions.includes(params.source as (typeof sourceOptions)[number]) ? params.source : "ALL";
  const selectedStatus = statusOptions.includes(params.status as (typeof statusOptions)[number]) ? params.status : "ALL";
  const selectedWindow = windowOptions.find((option) => option.value === params.window) ?? windowOptions[1];
  const subredditFilter = normalizeSubredditName(params.subreddit ?? "");
  const since = getWindowStart(selectedWindow.hours);

  const where: Prisma.SubredditRssPollEventWhereInput = {
    requestedAt: {
      gte: since,
    },
    ...(selectedSource !== "ALL" ? { source: selectedSource as SubredditRssPollSource } : {}),
    ...(selectedStatus !== "ALL" ? { status: selectedStatus as SubredditRssPollStatus } : {}),
    ...(subredditFilter ? { subreddit: { contains: subredditFilter, mode: "insensitive" as const } } : {}),
  };

  const [events, aggregateEvents] = await Promise.all([
    prisma.subredditRssPollEvent.findMany({
      where,
      orderBy: {
        requestedAt: "desc",
      },
      take: DEFAULT_LIMIT,
    }),
    prisma.subredditRssPollEvent.findMany({
      where,
      select: {
        status: true,
        httpStatus: true,
        fetchedPosts: true,
        createdPosts: true,
        queuedEmbeddings: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
      take: 2000,
    }),
  ]);

  const visiblePayload = {
    filters: {
      source: selectedSource,
      status: selectedStatus,
      subreddit: subredditFilter || null,
      window: selectedWindow.value,
      limit: DEFAULT_LIMIT,
    },
    events: events.map(serializeEvent),
  };
  const successes = aggregateEvents.filter((event) => event.status === "SUCCESS").length;
  const rateLimits = aggregateEvents.filter((event) => event.status === "RATE_LIMIT_RETRYING" || event.status === "RATE_LIMITED").length;
  const errors = aggregateEvents.filter((event) => ["NOT_FOUND", "HTTP_ERROR", "NETWORK_ERROR"].includes(event.status)).length;
  const backoffSkips = aggregateEvents.filter((event) => event.status === "BACKOFF_SKIPPED").length;

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">Admin RSS polling</p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">RSS request logs</h1>
            <p className="mt-3 max-w-[78ch] text-[15px] leading-6 text-[#cbcbcb]">
              Subreddit-level RSS fetch timeline for daily ingestion and polling workers, including wait slots, Reddit rate-limit headers, retries, errors, and stored post counts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <RssPollLogCopyButton payload={visiblePayload} />
            <Link
              className="inline-flex h-9 items-center rounded-full bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
              href="/admin/analytics"
            >
              Back to analytics
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Attempts" value={String(aggregateEvents.length)} />
        <Metric label="Successes" value={String(successes)} />
        <Metric label="429s" value={String(aggregateEvents.filter((event) => event.httpStatus === 429).length)} />
        <Metric label="Rate limits" value={String(rateLimits)} />
        <Metric label="Errors" value={String(errors)} />
        <Metric label="Backoff skips" value={String(backoffSkips)} />
        <Metric label="Fetched posts" value={String(sumNullable(aggregateEvents.map((event) => event.fetchedPosts)))} />
        <Metric label="Created posts" value={String(sumNullable(aggregateEvents.map((event) => event.createdPosts)))} />
        <Metric label="Queued embeds" value={String(sumNullable(aggregateEvents.map((event) => event.queuedEmbeddings)))} />
      </section>

      <section className="rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
          <FilterGroup label="Source">
            {sourceOptions.map((source) => (
              <FilterLink
                active={selectedSource === source}
                href={buildLogsHref({ params, source })}
                key={source}
                label={formatStatus(source)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            {statusOptions.map((status) => (
              <FilterLink
                active={selectedStatus === status}
                href={buildLogsHref({ params, status })}
                key={status}
                label={formatStatus(status)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Window">
            {windowOptions.map((option) => (
              <FilterLink
                active={selectedWindow.value === option.value}
                href={buildLogsHref({ params, window: option.value })}
                key={option.value}
                label={option.label}
              />
            ))}
          </FilterGroup>
          <form action="/admin/analytics/rss-polling" className="rounded-[18px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <input name="source" type="hidden" value={selectedSource} />
            <input name="status" type="hidden" value={selectedStatus} />
            <input name="window" type="hidden" value={selectedWindow.value} />
            <label className="grid gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Subreddit</span>
              <div className="flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-[12px] border border-[#27272a] bg-[#09090b] px-3 text-[13px] text-[#ffffff] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
                  defaultValue={subredditFilter}
                  name="subreddit"
                  placeholder="smallbusiness"
                />
                <button className="h-10 rounded-full bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] hover:bg-[#252525]" type="submit">
                  Filter
                </button>
              </div>
            </label>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        {events.length === 0 ? (
          <div className="p-5 text-[13px] leading-5 text-[#b3b3b3]">No RSS polling logs matched these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] border-collapse text-left text-[12px]">
              <thead className="bg-[#181818] text-[10px] uppercase tracking-[0.16em] text-[#b3b3b3]">
                <tr>
                  <Th>Subreddit</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th>Requested (local)</Th>
                  <Th>Gap</Th>
                  <Th>HTTP</Th>
                  <Th>RL used</Th>
                  <Th>RL remaining</Th>
                  <Th>RL reset</Th>
                  <Th>Slot wait</Th>
                  <Th>Next planned</Th>
                  <Th>Retry</Th>
                  <Th>Fetched</Th>
                  <Th>Existing</Th>
                  <Th>Created</Th>
                  <Th>Embeds</Th>
                  <Th>Backoff</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {events.map((event, index) => (
                  <tr className="text-[#cbcbcb]" key={event.id}>
                    <Td>
                      <div className="font-semibold text-[#ffffff]">r/{event.subreddit}</div>
                      <div className="mt-1 text-[11px] text-[#8f8f8f]">attempt {event.attempt + 1}</div>
                    </Td>
                    <Td>{formatStatus(event.source)}</Td>
                    <Td>
                      <StatusPill status={event.status} />
                    </Td>
                    <Td><BrowserDateTime value={event.requestedAt.toISOString()} /></Td>
                    <Td>{formatGap(events[index + 1], event)}</Td>
                    <Td>{event.httpStatus ? `${event.httpStatus} ${event.statusText ?? ""}`.trim() : "-"}</Td>
                    <Td>{event.ratelimitUsed ?? "-"}</Td>
                    <Td>{event.ratelimitRemaining ?? "-"}</Td>
                    <Td>{event.ratelimitReset ?? "-"}</Td>
                    <Td>{formatDuration(event.waitMs)}</Td>
                    <Td>{event.nextRequestAt ? <BrowserDateTime value={event.nextRequestAt.toISOString()} /> : "Not set"}</Td>
                    <Td>{event.retryUntil ? <BrowserDateTime value={event.retryUntil.toISOString()} /> : "-"}</Td>
                    <Td>{event.fetchedPosts ?? "-"}</Td>
                    <Td>{event.existingPosts ?? "-"}</Td>
                    <Td>{event.createdPosts ?? "-"}</Td>
                    <Td>{event.queuedEmbeddings ?? "-"}</Td>
                    <Td>{event.backoffUntil ? <BrowserDateTime value={event.backoffUntil.toISOString()} /> : "-"}</Td>
                    <Td>
                      <EventDetail event={event} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-[18px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
        active ? "bg-[#1ed760] text-[#121212]" : "bg-[#1f1f1f] text-[#b3b3b3] hover:text-[#ffffff]"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}

function EventDetail({
  event,
}: {
  event: {
    durationMs: number | null;
    errorMessage: string | null;
    retryAfter: string | null;
    retryUntil: Date | null;
  };
}) {
  if (event.retryUntil || event.retryAfter) {
    return (
      <span className="text-[#f8c15c]">
        {event.retryUntil ? (
          <>
            Retry at <BrowserDateTime value={event.retryUntil.toISOString()} />
          </>
        ) : (
          `Retry after ${event.retryAfter}`
        )}
      </span>
    );
  }

  if (event.errorMessage) {
    return <span className="text-[#f3727f]">{event.errorMessage}</span>;
  }

  if (event.durationMs !== null) {
    return <span>{formatDuration(event.durationMs)}</span>;
  }

  return <span>In progress</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</div>
      <div className="mt-2 truncate text-[18px] font-bold leading-none text-[#ffffff]">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getStatusTone(status)}`}>
      {formatStatus(status)}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function getStatusTone(status: string) {
  if (status === "SUCCESS") {
    return "bg-[#12351f] text-[#1ed760]";
  }

  if (status === "RATE_LIMIT_RETRYING" || status === "FETCHING") {
    return "bg-[#332714] text-[#f8c15c]";
  }

  if (status === "RATE_LIMITED" || status === "NOT_FOUND" || status === "HTTP_ERROR" || status === "NETWORK_ERROR") {
    return "bg-[#35161c] text-[#f3727f]";
  }

  if (status === "BACKOFF_SKIPPED") {
    return "bg-[#1f1f1f] text-[#f8c15c]";
  }

  return "bg-[#1f1f1f] text-[#cbcbcb]";
}

function buildLogsHref({
  params,
  source,
  status,
  window,
}: {
  params: SearchParams;
  source?: string;
  status?: string;
  window?: string;
}) {
  const next = new URLSearchParams();
  const nextSource = source ?? params.source;
  const nextStatus = status ?? params.status;
  const nextWindow = window ?? params.window;
  const subreddit = normalizeSubredditName(params.subreddit ?? "");

  if (nextSource && nextSource !== "ALL") next.set("source", nextSource);
  if (nextStatus && nextStatus !== "ALL") next.set("status", nextStatus);
  if (nextWindow && nextWindow !== "7d") next.set("window", nextWindow);
  if (subreddit) next.set("subreddit", subreddit);

  const query = next.toString();
  return query ? `/admin/analytics/rss-polling?${query}` : "/admin/analytics/rss-polling";
}

function serializeEvent(event: {
  id: string;
  subreddit: string;
  source: string;
  attempt: number;
  jobId: string | null;
  status: string;
  requestedAt: Date;
  fetchStartedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  waitMs: number | null;
  nextRequestDelayMs: number | null;
  nextRequestAt: Date | null;
  httpStatus: number | null;
  statusText: string | null;
  errorMessage: string | null;
  ratelimitUsed: string | null;
  ratelimitRemaining: string | null;
  ratelimitReset: string | null;
  retryAfter: string | null;
  retryAfterMs: number | null;
  retryWaitMs: number | null;
  retryUntil: Date | null;
  fetchedPosts: number | null;
  existingPosts: number | null;
  createdPosts: number | null;
  queuedEmbeddings: number | null;
  backoffUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...event,
    requestedAt: event.requestedAt.toISOString(),
    fetchStartedAt: event.fetchStartedAt?.toISOString() ?? null,
    completedAt: event.completedAt?.toISOString() ?? null,
    nextRequestAt: event.nextRequestAt?.toISOString() ?? null,
    retryUntil: event.retryUntil?.toISOString() ?? null,
    backoffUntil: event.backoffUntil?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function formatDuration(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${value}ms`;
}

function formatGap(previous: { requestedAt: Date } | undefined, current: { requestedAt: Date }) {
  if (!previous) {
    return "First";
  }

  return formatDuration(current.requestedAt.getTime() - previous.requestedAt.getTime());
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function sumNullable(values: Array<number | null>) {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function getWindowStart(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}