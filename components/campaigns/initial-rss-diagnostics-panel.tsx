"use client";

import type { ReactNode } from "react";

import type { CampaignInitialRssDiagnostics } from "@/actions/campaigns";

type EventRow = NonNullable<CampaignInitialRssDiagnostics>["events"][number];

export function InitialRssDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: CampaignInitialRssDiagnostics;
}) {
  const events = diagnostics?.events ?? [];
  const latestEvent = events.at(-1) ?? null;
  const successes = events.filter((event) => event.status === "SUCCESS").length;
  const rateLimits = events.filter((event) => event.status === "RATE_LIMIT_RETRYING" || event.status === "RATE_LIMITED").length;
  const errors = events.filter((event) => ["NOT_FOUND", "HTTP_ERROR", "NETWORK_ERROR"].includes(event.status)).length;
  const activeRetry = events.find((event) => event.retryUntil && new Date(event.retryUntil).getTime() > Date.now()) ?? null;
  const activeRetryUntil = activeRetry?.retryUntil ?? null;

  return (
    <section className="rounded-[24px] bg-[#181818] p-5 text-[#ffffff] shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-[#ffffff]">Initial RSS run</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
            Subreddit fetch timeline for the first sync queued when this campaign was created.
          </p>
          {activeRetry && activeRetryUntil ? (
            <p className="mt-3 text-[13px] font-semibold text-[#f8c15c]">
              r/{activeRetry.subreddit} is waiting before retry until {formatDateTime(activeRetryUntil)}.
            </p>
          ) : null}
        </div>
        <StatusPill status={diagnostics?.run.status ?? "NOT_TRACKED"} />
      </div>

      {!diagnostics ? (
        <div className="mt-5 rounded-[18px] border border-dashed border-[#3f3f46] bg-[#121212] p-4 text-[13px] leading-5 text-[#b3b3b3]">
          Initial RSS diagnostics are tracked from this release forward.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Attempts" value={String(events.length)} />
            <Metric label="Successes" value={String(successes)} />
            <Metric label="Rate limits" value={String(rateLimits)} />
            <Metric label="Errors" value={String(errors)} />
            <Metric label="Last subreddit" value={latestEvent ? `r/${latestEvent.subreddit}` : "None"} />
          </div>

          <div className="overflow-hidden rounded-[18px] bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            {events.length === 0 ? (
              <div className="p-4 text-[13px] leading-5 text-[#b3b3b3]">The first run is queued, but no RSS fetch attempt has started yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left text-[12px]">
                  <thead className="bg-[#181818] text-[10px] uppercase tracking-[0.16em] text-[#b3b3b3]">
                    <tr>
                      <Th>Subreddit</Th>
                      <Th>Status</Th>
                      <Th>Requested</Th>
                      <Th>HTTP</Th>
                      <Th>Wait</Th>
                      <Th>Next planned</Th>
                      <Th>Fetched</Th>
                      <Th>Leads</Th>
                      <Th>Detail</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {events.map((event) => (
                      <tr className="text-[#cbcbcb]" key={event.id}>
                        <Td>
                          <div className="font-semibold text-[#ffffff]">r/{event.subreddit}</div>
                          <div className="mt-1 text-[11px] text-[#8f8f8f]">#{event.sequence + 1} attempt {event.attempt + 1}</div>
                        </Td>
                        <Td>
                          <StatusPill status={event.status} />
                        </Td>
                        <Td>{formatDateTime(event.requestedAt)}</Td>
                        <Td>{event.httpStatus ? `${event.httpStatus} ${event.statusText ?? ""}`.trim() : "Pending"}</Td>
                        <Td>{formatDuration(event.waitMs)}</Td>
                        <Td>{event.nextRequestAt ? formatDateTime(event.nextRequestAt) : "Not set"}</Td>
                        <Td>{event.fetchedPosts ?? "-"}</Td>
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
    </section>
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
