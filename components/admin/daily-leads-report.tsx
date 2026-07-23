import Link from "next/link";
import type React from "react";

import { DailyLeadsTrendChart } from "@/components/admin/daily-leads-trend-chart";
import { TrackedRedditLeadLink } from "@/components/campaigns/tracked-reddit-lead-link";
import type { DailyLeadAnalytics } from "@/lib/daily-leads-analytics";
import { formatDateTimeInTimeZone, normalizeTimeZone } from "@/lib/time-zone";

export function DailyLeadsReport({
  analytics,
  pageHref,
  showTrendChart = false,
  showOwner = false,
  trackClientActivity = false,
  timeZone = "UTC",
}: {
  analytics: DailyLeadAnalytics;
  pageHref: (page: number) => string;
  showTrendChart?: boolean;
  showOwner?: boolean;
  trackClientActivity?: boolean;
  timeZone?: string;
}) {
  const metrics = analytics.metrics;
  const pagination = analytics.pagination;
  const firstRow = pagination.totalRows === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastRow = Math.min(pagination.totalRows, pagination.page * pagination.pageSize);

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Cron runs" value={metrics.cronRuns} />
        <Metric label="Campaigns queued" value={metrics.campaignsQueued} />
        <Metric label="Scanned" value={metrics.candidatesScanned} />
        <Metric label="Total leads" value={metrics.totalLeadsFound} />
        <Metric label="Strong" value={metrics.strongLeads} />
        <Metric label="Not strong" value={metrics.notStrongLeads} />
        <Metric label="Pending AI" value={metrics.pendingClassifications} />
        <Metric label="AI failures" value={metrics.classificationFailedLeads} />
        <Metric label="Notifications sent" value={metrics.notificationsSent} />
        <Metric label="Notification failures" value={metrics.notificationsFailed} />
      </section>

      {showTrendChart ? <DailyLeadsTrendChart rows={analytics.trendRows} /> : null}

      <section className="overflow-hidden rounded-[18px] bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <div className="flex flex-col gap-3 border-b border-[#27272a] bg-[#181818] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Scanned post rows</p>
            <p className="mt-1 text-[12px] text-[#cbcbcb]">
              Showing {firstRow}-{lastRow} of {pagination.totalRows}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pagination.hasPreviousPage ? (
              <Link className={paginationButtonClassName} href={pageHref(pagination.page - 1)}>
                Previous
              </Link>
            ) : (
              <span className={disabledPaginationButtonClassName}>Previous</span>
            )}
            <span className="inline-flex h-9 items-center rounded-full bg-[#121212] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            {pagination.hasNextPage ? (
              <Link className={paginationButtonClassName} href={pageHref(pagination.page + 1)}>
                Next
              </Link>
            ) : (
              <span className={disabledPaginationButtonClassName}>Next</span>
            )}
          </div>
        </div>
        {analytics.rows.length === 0 ? (
          <div className="p-5 text-[13px] leading-5 text-[#b3b3b3]">No daily semantic lead rows matched this day.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse text-left text-[12px]">
              <thead className="bg-[#181818] text-[10px] uppercase tracking-[0.16em] text-[#b3b3b3]">
                <tr>
                  <Th>Campaign</Th>
                  {showOwner ? <Th>Owner</Th> : null}
                  <Th>Run</Th>
                  <Th>Scanned</Th>
                  <Th>Subreddit</Th>
                  <Th>Reddit item</Th>
                  <Th>Semantic</Th>
                  <Th>LLM</Th>
                  <Th>Strength</Th>
                  <Th>Notification</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {analytics.rows.map((row) => (
                  <tr className="text-[#cbcbcb]" key={row.id}>
                    <Td>
                      <Link className="font-semibold text-[#ffffff] hover:text-[#1ed760]" href={`/campaigns/${row.campaignId}`}>
                        {row.campaignName}
                      </Link>
                    </Td>
                    {showOwner ? <Td>{row.owner}</Td> : null}
                    <Td>
                      <StatusPill status={row.runStatus} />
                      {row.campaignRunId ? <div className="mt-1 text-[10px] text-[#8f8f8f]">{shortId(row.campaignRunId)}</div> : null}
                    </Td>
                    <Td>{formatDateTime(row.scannedAt, timeZone)}</Td>
                    <Td>r/{row.redditItem.subreddit}</Td>
                    <Td>
                      <div className="max-w-[360px]">
                        <div className="line-clamp-2 font-semibold text-[#ffffff]">{row.redditItem.title || row.redditItem.body || "Untitled Reddit item"}</div>
                        <div className="mt-1 text-[11px] text-[#8f8f8f]">Posted {formatDate(row.redditItem.createdUtc, timeZone)}</div>
                      </div>
                    </Td>
                    <Td>
                      <StatusPill status={row.semanticStatus} />
                      <div className="mt-1 text-[11px] text-[#b3b3b3]">{row.semanticScore === null ? "-" : row.semanticScore.toFixed(3)}</div>
                    </Td>
                    <Td>
                      {row.lead?.classificationFailed ? (
                        <>
                          <StatusPill status="FAILED" />
                          <div className="mt-1 text-[11px] text-[#f3727f]">Classification error</div>
                        </>
                      ) : row.lead?.classified ? (
                        <>
                          <div className="font-semibold text-[#ffffff]">{row.lead.label} / {row.lead.score}</div>
                          {row.lead.category ? <div className="mt-1 text-[11px] text-[#8f8f8f]">{row.lead.category}</div> : null}
                        </>
                      ) : row.semanticStatus === "MATCHED" ? (
                        <span className="text-[#f8c15c]">Pending</span>
                      ) : (
                        <span className="text-[#8f8f8f]">Skipped</span>
                      )}
                    </Td>
                    <Td>
                      {row.lead?.classificationFailed ? (
                        "-"
                      ) : row.lead?.classified ? (
                        <StatusPill status={row.lead.strong ? "STRONG" : "NOT_STRONG"} />
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>
                      {row.notification ? (
                        <>
                          <StatusPill status={row.notification.status} />
                          <div className="mt-1 text-[11px] text-[#8f8f8f]">{row.notification.channel}</div>
                        </>
                      ) : (
                        <span className="text-[#8f8f8f]">None</span>
                      )}
                    </Td>
                    <Td>
                      <div className="max-w-[420px] space-y-2">
                        {row.bestQueryText ? <div><span className="text-[#8f8f8f]">Query:</span> {row.bestQueryText}</div> : null}
                        {row.lead?.summary ? <div><span className="text-[#8f8f8f]">AI:</span> {row.lead.summary}</div> : null}
                        {row.notification?.error ? <div className="text-[#f3727f]">{row.notification.error}</div> : null}
                        {row.redditItem.url ? (
                          <TrackedRedditLeadLink
                            campaignId={row.campaignId}
                            className="inline-flex min-h-11 items-center font-semibold text-[#1ed760] transition-colors hover:text-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
                            leadId={row.lead?.id ?? null}
                            trackActivity={trackClientActivity}
                            url={row.redditItem.url}
                          />
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

const paginationButtonClassName =
  "inline-flex h-9 items-center rounded-full bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]";

const disabledPaginationButtonClassName =
  "inline-flex h-9 cursor-not-allowed items-center rounded-full bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6f6f6f] opacity-60 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]";

function Metric({ label, value }: { label: string; value: number }) {
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
  if (status === "COMPLETED" || status === "SENT" || status === "MATCHED" || status === "STRONG") {
    return "bg-[#12351f] text-[#1ed760]";
  }

  if (status === "PROCESSING" || status === "QUEUED" || status === "PENDING") {
    return "bg-[#332714] text-[#f8c15c]";
  }

  if (status === "FAILED" || status === "NOT_STRONG") {
    return "bg-[#35161c] text-[#f3727f]";
  }

  return "bg-[#1f1f1f] text-[#cbcbcb]";
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function formatDateTime(value: Date, timeZone: string) {
  return formatDateTimeInTimeZone(value, timeZone);
}

function formatDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: normalizeTimeZone(timeZone),
  }).format(value);
}

function shortId(value: string) {
  return value.slice(0, 8);
}
