import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, CalendarCheck2, CalendarDays, Clock3 } from "lucide-react";

import { DailyLeadsDateFilter } from "@/components/admin/daily-leads-date-filter";
import { CampaignDetailLiveSections } from "@/components/campaigns/campaign-detail-live-sections";
import { CampaignLeadFilterLoadingProvider } from "@/components/campaigns/campaign-lead-filter-loading-provider";
import { CampaignShareDialogButton } from "@/components/campaigns/campaign-share-dialog-button";
import { CopyPublicCampaignLinkButton } from "@/components/campaigns/copy-public-campaign-link-button";
import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { EditCampaignDescriptionDialog } from "@/components/campaigns/edit-campaign-description-dialog";
import { EditCampaignDialog } from "@/components/campaigns/edit-campaign-dialog";
import { ExportCampaignLeadsButton } from "@/components/campaigns/export-campaign-leads-button";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getCampaignInitialRssDiagnostics } from "@/actions/campaigns";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  buildAccessibleCampaignWhere,
  canManageCampaign,
  getCampaignAccessFromRecord,
  getCampaignDisplayName,
} from "@/lib/campaign-access";
import { getCampaignLeadViewsForUser } from "@/lib/campaign-leads";
import {
  getDailyLeadDateSelection,
  type DailyLeadDateRangeValue,
  type DailyLeadDateSelection,
} from "@/lib/daily-leads-analytics";
import { prisma } from "@/lib/prisma";
import { reconcileCampaignSyncState } from "@/worker/sync-reconcile";

const MIN_VISIBLE_LEAD_SCORE = 40;
const DAILY_SEMANTIC_CRON_UTC_HOUR = 15;
const DAILY_SEMANTIC_CRON_UTC_MINUTE = 0;

type SearchParams = {
  date?: string | string[];
  from?: string;
  range?: string;
  to?: string;
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const leadDateSelection = getDailyLeadDateSelection(
    resolvedSearchParams.date || resolvedSearchParams.range || resolvedSearchParams.from || resolvedSearchParams.to
      ? resolvedSearchParams
      : { range: "all" },
  );
  const leadDateFilter = {
    date: leadDateSelection.source === "dates" ? leadDateSelection.dateStarts : undefined,
    from: leadDateSelection.source === "dates" || leadDateSelection.source === "all"
      ? undefined
      : leadDateSelection.range.from.toISOString(),
    range: leadDateSelection.source === "all" ? "all" : undefined,
    to: leadDateSelection.source === "dates" || leadDateSelection.source === "all"
      ? undefined
      : leadDateSelection.range.to.toISOString(),
  };
  const leadDateFilterKey = getLeadDateFilterKey(leadDateFilter);

  const campaign = await prisma.campaign.findFirst({
    where: buildAccessibleCampaignWhere({
      campaignId: id,
      email: session.user.email,
      userId: session.user.id,
    }),
    include: {
      clientAccesses: {
        where: {
          normalizedEmail: String(session.user.email ?? "").trim().toLowerCase(),
        },
        select: {
          displayName: true,
          normalizedEmail: true,
        },
      },
      leads: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          ai: {
            select: {
              category: true,
              summary: true,
              painPoints: true,
            },
          },
          redditItem: true,
        },
      },
      semanticQueries: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          queryText: true,
          category: true,
        },
      },
      sync: {
        select: {
          status: true,
          stage: true,
          message: true,
          lastError: true,
          queuedAt: true,
          startedAt: true,
          completedAt: true,
          failedAt: true,
          lastHeartbeat: true,
          statsJson: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const access = getCampaignAccessFromRecord({
    campaign,
    email: session.user.email,
    userId: session.user.id,
  });

  if (!access) {
    notFound();
  }

  const displayName = getCampaignDisplayName(campaign, access);
  const canManage = canManageCampaign(access);

  const sync = await reconcileCampaignSyncState(campaign.id);
  const latestSemanticRun = await prisma.campaignRun.findFirst({
    where: {
      campaignId: campaign.id,
      trigger: "DAILY_SEMANTIC",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      queuedAt: true,
      startedAt: true,
      completedAt: true,
      failedAt: true,
    },
  });
  const latestSemanticRunAt = getLatestSemanticRunTimestamp(latestSemanticRun);
  const semanticNextSyncAt = getNextDailySemanticCronAt();
  const shouldWaitForTodaySync = shouldWaitForTodayDailySemanticSync({
    latestSemanticRunAt,
    selection: leadDateSelection,
  });

  const lastSyncSource =
    sync?.completedAt ??
    sync?.failedAt ??
    sync?.lastHeartbeat ??
    campaign.updatedAt;
  const nextSyncSource = new Date(lastSyncSource.getTime() + 24 * 60 * 60 * 1000);
  const nextSync = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(nextSyncSource);
  const initialLeads = await getCampaignLeadViewsForUser({
    campaignId: campaign.id,
    ...(leadDateSelection.source === "dates"
      ? {
          dateRanges: leadDateSelection.ranges,
        }
      : {
          from: leadDateSelection.range.from,
          to: leadDateSelection.range.to,
    }),
    userId: session.user.id,
    email: session.user.email,
  });
  const initialDiagnostics = await getCampaignInitialRssDiagnostics(campaign.id);
  const firstSyncAt = initialDiagnostics?.run.startedAt
    ?? initialDiagnostics?.run.queuedAt
    ?? campaign.createdAt.toISOString();
  const classifiedLeads = initialLeads.filter((lead) => lead.ai !== null && lead.score >= MIN_VISIBLE_LEAD_SCORE);
  const isAdminAccount = canViewAnalytics(session.user.email);
  const canExportLeads = isAdminAccount || canManage;

  return (
    <CampaignLeadFilterLoadingProvider filterKey={leadDateFilterKey}>
      <div className="space-y-5">
        <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Link className="w-full sm:w-auto" href="/campaigns">
              <Button
                className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
                variant="secondary"
              >
                <BackIcon />
                Back to campaigns
              </Button>
            </Link>
            <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-stretch lg:justify-end">
              {isAdminAccount && sync?.status === "COMPLETED" ? (
                <Link className="w-full sm:w-auto" href={`/campaigns/${campaign.id}/analytics`}>
                  <Button
                    className="w-full rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477] sm:w-auto"
                    variant="secondary"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </Button>
                </Link>
              ) : null}
              {isAdminAccount ? (
                <Link className="w-full sm:w-auto" href={`/campaigns/${campaign.id}/daily-leads`}>
                  <Button
                    className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
                    variant="secondary"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Daily leads
                  </Button>
                </Link>
              ) : null}
              {isAdminAccount ? (
                <CopyPublicCampaignLinkButton campaignId={campaign.id} />
              ) : (
                <CampaignShareDialogButton campaignId={campaign.id} />
              )}
              {isAdminAccount ? <CopyPublicCampaignLinkButton campaignId={campaign.id} kind="leads" /> : null}
              {canExportLeads ? (
                <ExportCampaignLeadsButton campaignId={campaign.id} campaignName={displayName} />
              ) : null}
              {canManage ? (
                <>
                  <EditCampaignDialog
                    campaign={{
                      id: campaign.id,
                      name: campaign.name,
                      leadType: campaign.leadType,
                      description: campaign.description,
                      keywords: campaign.keywords,
                      negativeKeywords: campaign.negativeKeywords,
                      subreddits: campaign.subreddits,
                      recentDays: campaign.recentDays,
                      minScoreToAlert: campaign.minScoreToAlert,
                      isActive: campaign.isActive,
                      semanticQueries: campaign.semanticQueries,
                    }}
                    showSemanticQueries={isAdminAccount}
                  />
                  <DeleteCampaignDialog campaignId={campaign.id} campaignName={campaign.name} />
                </>
              ) : (
                <EditCampaignDescriptionDialog campaignId={campaign.id} description={campaign.description} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="min-w-0 max-w-3xl">
              <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.75rem]">
                {displayName}
              </h1>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-6 text-[#cbcbcb] sm:truncate">
                {campaign.description || "No campaign description added yet."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ScheduledProcessingPill isActive={campaign.isActive} />
                <HeroChip label={`${campaign.subreddits.length} subreddit${campaign.subreddits.length === 1 ? "" : "s"}`} />
                <TrackedSincePill date={firstSyncAt} />
              </div>
            </div>
            <div className="w-full">
              <DailyLeadsDateFilter defaultRange="all" enableMultipleDates />
            </div>
          </div>
        </div>
      </section>

      <CampaignDetailLiveSections
        campaignId={campaign.id}
        initialDiagnostics={initialDiagnostics}
        initialLeads={classifiedLeads}
        initialSync={
          sync
            ? {
                status: sync.status,
                stage: sync.stage,
                message: sync.message,
                lastError: sync.lastError,
                queuedAt: sync.queuedAt?.toISOString() ?? null,
                startedAt: sync.startedAt?.toISOString() ?? null,
                completedAt: sync.completedAt?.toISOString() ?? null,
                failedAt: sync.failedAt?.toISOString() ?? null,
                lastHeartbeat: sync.lastHeartbeat?.toISOString() ?? null,
                statsJson: sync.statsJson as {
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
                } | null,
                updatedAt: sync.updatedAt.toISOString(),
              }
            : null
        }
        leadDateFilter={leadDateFilter}
        nextSyncLabel={nextSync}
        semanticLastSyncAt={
          latestSemanticRunAt?.toISOString() ?? null
        }
        semanticNextSyncAt={semanticNextSyncAt.toISOString()}
        showInitialRssDiagnostics={isAdminAccount}
        showJsonExport={isAdminAccount}
        showSemanticSort={isAdminAccount}
        shouldWaitForTodaySync={shouldWaitForTodaySync}
      />
      </div>
    </CampaignLeadFilterLoadingProvider>
  );
}

function getLeadDateFilterKey(filter: {
  date?: string[];
  from?: string;
  range?: string;
  to?: string;
}) {
  return [
    filter.range ?? "",
    filter.from ?? "",
    filter.to ?? "",
    ...(filter.date ?? []),
  ].join("|");
}

function getNextDailySemanticCronAt(now = new Date()) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    DAILY_SEMANTIC_CRON_UTC_HOUR,
    DAILY_SEMANTIC_CRON_UTC_MINUTE,
    0,
    0,
  ));

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

function getLatestSemanticRunTimestamp(run: {
  completedAt: Date | null;
  failedAt: Date | null;
  queuedAt: Date | null;
  startedAt: Date | null;
} | null) {
  return run?.completedAt ?? run?.failedAt ?? run?.startedAt ?? run?.queuedAt ?? null;
}

function shouldWaitForTodayDailySemanticSync({
  latestSemanticRunAt,
  now = new Date(),
  selection,
}: {
  latestSemanticRunAt: Date | null;
  now?: Date;
  selection: DailyLeadDateSelection;
}) {
  if (selection.source === "all" || selection.ranges.length !== 1) {
    return false;
  }

  const selectedRange = selection.ranges[0];

  if (!isSingleDayCurrentRange(selectedRange, now)) {
    return false;
  }

  return !latestSemanticRunAt
    || latestSemanticRunAt < selectedRange.from
    || latestSemanticRunAt >= selectedRange.to;
}

function isSingleDayCurrentRange(range: DailyLeadDateRangeValue, now: Date) {
  const durationMs = range.to.getTime() - range.from.getTime();
  const maxSingleDayMs = 26 * 60 * 60 * 1000;

  return durationMs > 0
    && durationMs <= maxSingleDayMs
    && range.from <= now
    && now < range.to;
}

function HeroChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#121212] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      {label}
    </span>
  );
}

function TrackedSincePill({ date }: { date: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[#121212] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
      title={`Campaign has been tracking Reddit leads since ${formatTrackedSinceDate(date)}.`}
    >
      <CalendarCheck2 aria-hidden="true" className="h-3.5 w-3.5 text-[#b3b3b3]" />
      Tracked since {formatTrackedSinceDate(date)}
    </span>
  );
}

function ScheduledProcessingPill({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
        isActive
          ? "border-[#1ed760]/25 bg-[#1ed760]/10 text-[#7cf5a3]"
          : "border-[#3f3f46] bg-[#121212] text-[#b3b3b3]"
      }`}
      title={isActive ? "Campaign will run through scheduled daily RSS and semantic jobs." : "Activate this campaign to include it in scheduled daily processing."}
    >
      <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
      {isActive ? "Scheduled daily" : "Paused"}
    </div>
  );
}

function formatTrackedSinceDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "campaign start";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M15 18 9 12l6-6M10 12h10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
