"use client";

import type { ReactNode } from "react";

import type { CampaignInitialRssDiagnostics } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type EventRow = NonNullable<CampaignInitialRssDiagnostics>["events"][number];

export function InitialRssDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: CampaignInitialRssDiagnostics;
}) {
  return (
    <div className="flex justify-end">
      <RssRunInspectorDialog diagnostics={diagnostics} variant="button" />
    </div>
  );
}

function RssRunInspectorDialog({
  diagnostics,
  variant = "compact",
}: {
  diagnostics: CampaignInitialRssDiagnostics;
  variant?: "compact" | "button";
}) {
  const events = diagnostics?.events ?? [];
  const latestEvent = events.at(-1) ?? null;
  const successes = events.filter((event) => event.status === "SUCCESS").length;
  const rateLimits = events.filter((event) => event.status === "RATE_LIMIT_RETRYING" || event.status === "RATE_LIMITED").length;
  const errors = events.filter((event) => ["NOT_FOUND", "HTTP_ERROR", "NETWORK_ERROR"].includes(event.status)).length;
  const activeRetry = events.find((event) => event.retryUntil && new Date(event.retryUntil).getTime() > Date.now()) ?? null;
  const activeRetryUntil = activeRetry?.retryUntil ?? null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === "button" ? (
          <Button className="h-10 rounded-full bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] hover:bg-[#252525]" variant="secondary">
            View RSS run details
          </Button>
        ) : (
          <button className="rounded-full bg-[#121212] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:text-[#ffffff]">
            Details
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-7xl">
        <div className="p-5 lg:p-6">
          <DialogHeader>
            <DialogTitle>Initial RSS run details</DialogTitle>
            <DialogDescription>
              Ordered fetch timeline for this campaign creation sync, including timing gaps, HTTP status, retry waits, and per-subreddit outcomes.
            </DialogDescription>
          </DialogHeader>

          {!diagnostics ? (
            <div className="mt-5 rounded-[18px] border border-dashed border-[#3f3f46] bg-[#121212] p-4 text-[13px] leading-5 text-[#b3b3b3]">
              Initial RSS diagnostics are tracked from this release forward.
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Run summary</p>
                    <p className="mt-1 text-[13px] leading-5 text-[#cbcbcb]">
                      Subreddit fetch timeline for the first sync queued when this campaign was created.
                    </p>
                    {activeRetry && activeRetryUntil ? (
                      <p className="mt-3 text-[13px] font-semibold text-[#f8c15c]">
                        r/{activeRetry.subreddit} is waiting before retry until {formatDateTime(activeRetryUntil)}.
                      </p>
                    ) : null}
                  </div>
                  <StatusPill status={diagnostics.run.status} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Metric label="Run status" value={formatStatus(diagnostics.run.status)} />
                <Metric label="Subreddits" value={String(new Set(events.map((event) => event.subreddit)).size)} />
                <Metric label="Attempts" value={String(events.length)} />
                <Metric label="Successes" value={String(successes)} />
                <Metric label="429s" value={String(events.filter((event) => event.httpStatus === 429).length)} />
                <Metric label="Errors" value={String(errors)} />
                <Metric label="Rate limits" value={String(rateLimits)} />
                <Metric label="Last subreddit" value={latestEvent ? `r/${latestEvent.subreddit}` : "None"} />
                <Metric label="Created leads" value={String(events.reduce((sum, event) => sum + (event.createdLeads ?? 0), 0))} />
              </div>

              <div className="overflow-hidden rounded-[18px] bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                {events.length === 0 ? (
                  <div className="p-4 text-[13px] leading-5 text-[#b3b3b3]">The first run is queued, but no RSS fetch attempt has started yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] border-collapse text-left text-[12px]">
                      <thead className="bg-[#181818] text-[10px] uppercase tracking-[0.16em] text-[#b3b3b3]">
                        <tr>
                          <Th>Subreddit</Th>
                          <Th>Status</Th>
                          <Th>Requested</Th>
                          <Th>Gap</Th>
                          <Th>HTTP</Th>
                          <Th>Slot wait</Th>
                          <Th>Next planned</Th>
                          <Th>Retry</Th>
                          <Th>Fetched</Th>
                          <Th>Matched</Th>
                          <Th>Leads</Th>
                          <Th>Detail</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272a]">
                        {events.map((event, index) => (
                          <tr className="text-[#cbcbcb]" key={event.id}>
                            <Td>
                              <div className="font-semibold text-[#ffffff]">r/{event.subreddit}</div>
                              <div className="mt-1 text-[11px] text-[#8f8f8f]">#{event.sequence + 1} attempt {event.attempt + 1}</div>
                            </Td>
                            <Td>
                              <StatusPill status={event.status} />
                            </Td>
                            <Td>{formatDateTime(event.requestedAt)}</Td>
                            <Td>{formatGap(events[index - 1], event)}</Td>
                            <Td>{event.httpStatus ? `${event.httpStatus} ${event.statusText ?? ""}`.trim() : "Pending"}</Td>
                            <Td>{formatDuration(event.waitMs)}</Td>
                            <Td>{event.nextRequestAt ? formatDateTime(event.nextRequestAt) : "Not set"}</Td>
                            <Td>{event.retryUntil ? formatDateTime(event.retryUntil) : "-"}</Td>
                            <Td>{event.fetchedPosts ?? "-"}</Td>
                            <Td>{event.matchedItems ?? "-"}</Td>
                            <Td>{event.createdLeads ?? "-"}</Td>
                            <Td>
                              <EventDetail event={event} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventDetail({ event }: { event: EventRow }) {
  if (event.retryUntil) {
    return <span className="text-[#f8c15c]">Retry at {formatDateTime(event.retryUntil)}</span>;
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
  const tone = getStatusTone(status);

  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone}`}>
      {formatStatus(status)}
    </span>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function getStatusTone(status: string) {
  if (status === "SUCCESS" || status === "COMPLETED") {
    return "bg-[#12351f] text-[#1ed760]";
  }

  if (status === "RATE_LIMIT_RETRYING" || status === "PROCESSING" || status === "QUEUED") {
    return "bg-[#332714] text-[#f8c15c]";
  }

  if (status === "RATE_LIMITED" || status === "NOT_FOUND" || status === "HTTP_ERROR" || status === "NETWORK_ERROR" || status === "FAILED") {
    return "bg-[#35161c] text-[#f3727f]";
  }

  return "bg-[#1f1f1f] text-[#cbcbcb]";
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
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

function formatGap(previous: EventRow | undefined, current: EventRow) {
  if (!previous) {
    return "First";
  }

  return formatDuration(new Date(current.requestedAt).getTime() - new Date(previous.requestedAt).getTime());
}
