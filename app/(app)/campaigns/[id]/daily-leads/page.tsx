import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";

import { DailyLeadsDateFilter } from "@/components/admin/daily-leads-date-filter";
import { DailyLeadsReport } from "@/components/admin/daily-leads-report";
import { DailyLeadsSemanticFilter } from "@/components/admin/daily-leads-semantic-filter";
import { CampaignClientActivityPageView } from "@/components/campaigns/client-activity-tracker";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  buildAccessibleCampaignWhere,
  getCampaignAccessFromRecord,
  getCampaignDisplayName,
} from "@/lib/campaign-access";
import {
  type DailyLeadDateRange,
  type DailyLeadSemanticStatusFilter,
  getDailyLeadAnalytics,
  getDailyLeadDateRange,
  parseDailyLeadSemanticStatus,
  parseDailyLeadsPage,
} from "@/lib/daily-leads-analytics";
import { prisma } from "@/lib/prisma";
import {
  addDaysToDateKey,
  BROWSER_TIME_ZONE_COOKIE,
  getDateKeyInTimeZone,
  getDayRangeInTimeZone,
  normalizeTimeZone,
} from "@/lib/time-zone";

type SearchParams = {
  from?: string;
  page?: string;
  range?: string;
  status?: string;
  to?: string;
};

export default async function CampaignDailyLeadsPage({
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
  const campaign = await prisma.campaign.findFirst({
    where: buildAccessibleCampaignWhere({
      campaignId: id,
      email: session.user.email,
      userId: session.user.id,
    }),
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      clientAccesses: {
        where: {
          normalizedEmail: String(session.user.email ?? "").trim().toLowerCase(),
        },
        select: {
          displayName: true,
          normalizedEmail: true,
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

  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const isAdminAccount = canViewAnalytics(session.user.email);
  const cookieStore = await cookies();
  const browserTimeZone = isAdminAccount
    ? "UTC"
    : normalizeTimeZone(cookieStore.get(BROWSER_TIME_ZONE_COOKIE)?.value);
  const hasExplicitDateRange = Boolean(resolvedSearchParams.from || resolvedSearchParams.to || resolvedSearchParams.range);
  const range = !isAdminAccount && !hasExplicitDateRange
    ? getRecentDailyAnalyticsRange(new Date(), browserTimeZone)
    : getDailyLeadDateRange(resolvedSearchParams);
  const page = parseDailyLeadsPage(resolvedSearchParams.page);
  const semanticStatus = parseDailyLeadSemanticStatus(resolvedSearchParams.status);
  const analytics = await getDailyLeadAnalytics({
    campaignId: campaign.id,
    from: range.from,
    page,
    semanticStatus,
    timeZone: browserTimeZone,
    to: range.to,
  });
  const displayName = getCampaignDisplayName(campaign, access);
  const displayAnalytics = {
    ...analytics,
    campaignRuns: analytics.campaignRuns.map((run) => ({
      ...run,
      campaign: {
        ...run.campaign,
        name: displayName,
      },
    })),
    rows: analytics.rows.map((row) => ({
      ...row,
      campaignName: displayName,
    })),
  };

  return (
    <div className="space-y-5 text-[#ffffff]">
      {access.role === "CLIENT" && !isAdminAccount ? (
        <CampaignClientActivityPageView campaignId={campaign.id} eventType="DAILY_LEADS_VIEW" />
      ) : null}
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
              {isAdminAccount ? "Daily leads" : "Daily analytics"}
            </p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">{displayName}</h1>
            <p className="mt-3 max-w-[72ch] text-[15px] leading-6 text-[#cbcbcb]">
              {isAdminAccount
                ? campaign.description || "Daily semantic filtering, AI scoring, and notification results for this campaign."
                : campaign.description || "Daily lead trend, semantic matches, AI scoring, and notification results for this campaign."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
            <DailyLeadsDateFilter defaultRange={isAdminAccount ? "today" : "last7"} enableMultipleDates={!isAdminAccount} />
            <DailyLeadsSemanticFilter
              currentStatus={semanticStatus}
              hrefForStatus={(targetStatus) =>
                buildCampaignDailyLeadsHref({
                  campaignId: campaign.id,
                  page: 1,
                  range,
                  status: targetStatus,
                })
              }
            />
            <Link href={`/campaigns/${campaign.id}`}>
              <Button
                className="h-10 rounded-full border-none bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525]"
                variant="secondary"
              >
                Back
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <DailyLeadsReport
        analytics={displayAnalytics}
        pageHref={(targetPage) =>
          buildCampaignDailyLeadsHref({
            campaignId: campaign.id,
            page: targetPage,
            range,
            status: semanticStatus,
          })
        }
        showTrendChart={!isAdminAccount}
        trackClientActivity={access.role === "CLIENT" && !isAdminAccount}
        timeZone={browserTimeZone}
      />
    </div>
  );
}

function getRecentDailyAnalyticsRange(now = new Date(), timeZone = "UTC"): DailyLeadDateRange {
  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const from = getDayRangeInTimeZone(addDaysToDateKey(todayKey, -6), timeZone).from;
  const to = getDayRangeInTimeZone(todayKey, timeZone).to;

  return {
    from,
    source: "query",
    to,
  };
}

function buildCampaignDailyLeadsHref({
  campaignId,
  page,
  range,
  status,
}: {
  campaignId: string;
  page: number;
  range: DailyLeadDateRange;
  status?: DailyLeadSemanticStatusFilter;
}) {
  const params = new URLSearchParams({ page: String(page) });

  if (range.source === "all") {
    params.set("range", "all");
  } else {
    params.set("from", range.from.toISOString());
    params.set("to", range.to.toISOString());
  }

  if (status && status !== "ALL") {
    params.set("status", status);
  }

  return `/campaigns/${campaignId}/daily-leads?${params.toString()}`;
}
