import Link from "next/link";
import { redirect } from "next/navigation";

import { CopyJsonButton } from "@/components/admin/copy-json-button";
import { DailyLeadsDateFilter } from "@/components/admin/daily-leads-date-filter";
import { DailyLeadsReport } from "@/components/admin/daily-leads-report";
import { DailyLeadsSemanticFilter } from "@/components/admin/daily-leads-semantic-filter";
import { RetryFailedClassificationsButton } from "@/components/admin/retry-failed-classifications-button";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  DAILY_LEADS_PAGE_SIZE,
  DAILY_STRONG_LEAD_SCORE,
  type DailyLeadSemanticStatusFilter,
  getDailyLeadAnalytics,
  getDailyLeadDateRange,
  parseDailyLeadSemanticStatus,
  parseDailyLeadsPage,
} from "@/lib/daily-leads-analytics";

type SearchParams = {
  campaignId?: string;
  from?: string;
  page?: string;
  status?: string;
  to?: string;
};

export default async function AdminDailyLeadsPage({
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
  const range = getDailyLeadDateRange(params);
  const page = parseDailyLeadsPage(params.page);
  const semanticStatus = parseDailyLeadSemanticStatus(params.status);
  const analytics = await getDailyLeadAnalytics({
    campaignId: params.campaignId,
    from: range.from,
    page,
    semanticStatus,
    to: range.to,
  });
  const payload = {
    filters: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      campaignId: params.campaignId ?? null,
      page: analytics.pagination.page,
      pageSize: DAILY_LEADS_PAGE_SIZE,
      semanticStatus,
      strongScore: `> ${DAILY_STRONG_LEAD_SCORE}`,
    },
    metrics: analytics.metrics,
    cronRuns: analytics.cronRuns.map((run) => ({
      id: run.id,
      status: run.status,
      message: run.message,
      error: run.error,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      failedAt: run.failedAt?.toISOString() ?? null,
      statsJson: run.statsJson,
    })),
    campaignRuns: analytics.campaignRuns.map((run) => ({
      id: run.id,
      campaignId: run.campaignId,
      campaignName: run.campaign.name,
      status: run.status,
      message: run.message,
      statsJson: run.statsJson,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      failedAt: run.failedAt?.toISOString() ?? null,
    })),
    rows: analytics.rows.map((row) => ({
      ...row,
      scannedAt: row.scannedAt.toISOString(),
      redditItem: {
        ...row.redditItem,
        createdUtc: row.redditItem.createdUtc.toISOString(),
      },
      notification: row.notification
        ? {
            ...row.notification,
            sentAt: row.notification.sentAt?.toISOString() ?? null,
            createdAt: row.notification.createdAt.toISOString(),
          }
        : null,
    })),
  };

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">Admin daily leads</p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">Daily semantic lead logs</h1>
            <p className="mt-3 max-w-[78ch] text-[15px] leading-6 text-[#cbcbcb]">
              Calendar-day view of cron executions, queued campaigns, semantic matches, AI scoring, strong leads, and notification outcomes.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
            <DailyLeadsDateFilter />
            <DailyLeadsSemanticFilter
              currentStatus={semanticStatus}
              hrefForStatus={(targetStatus) =>
                buildDailyLeadsHref({
                  campaignId: params.campaignId,
                  from: range.from,
                  page: 1,
                  status: targetStatus,
                  to: range.to,
                })
              }
            />
            <div className="flex gap-2">
              {analytics.metrics.classificationFailedLeads > 0 ? (
                <RetryFailedClassificationsButton
                  campaignId={params.campaignId ?? null}
                  from={range.from.toISOString()}
                  to={range.to.toISOString()}
                />
              ) : null}
              <CopyJsonButton label="Copy JSON" payload={payload} />
              <Link
                className="inline-flex h-9 items-center rounded-full bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
                href="/admin/analytics"
              >
                Back
              </Link>
            </div>
          </div>
        </div>
      </section>

      <DailyLeadsReport
        analytics={analytics}
        pageHref={(targetPage) =>
          buildDailyLeadsHref({
            campaignId: params.campaignId,
            from: range.from,
            page: targetPage,
            status: semanticStatus,
            to: range.to,
          })
        }
        showOwner
      />
    </div>
  );
}

function buildDailyLeadsHref({
  campaignId,
  from,
  page,
  status,
  to,
}: {
  campaignId?: string;
  from: Date;
  page: number;
  status?: DailyLeadSemanticStatusFilter;
  to: Date;
}) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    page: String(page),
  });

  if (status && status !== "ALL") {
    params.set("status", status);
  }

  if (campaignId) {
    params.set("campaignId", campaignId);
  }

  return `/admin/analytics/daily-leads?${params.toString()}`;
}
