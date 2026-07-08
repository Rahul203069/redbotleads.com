import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Database, FlaskConical, ScrollText, UserPlus } from "lucide-react";

import { CampaignActiveToggle } from "@/components/admin/campaign-active-toggle";
import { DailySemanticOverrideButton } from "@/components/admin/daily-semantic-override-button";
import { DailyRssIngestionControl } from "@/components/admin/daily-rss-ingestion-control";
import { SaasSettingsDialog } from "@/components/admin/saas-settings-dialog";
import { SubredditPerformanceDialog } from "@/components/admin/subreddit-performance-dialog";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { getDailyRssPollerPauseState } from "@/lib/daily-rss-poller-control";
import { LEAD_SCORING_MODEL_OPTIONS, normalizeLeadScoringModel, type LeadScoringModelId } from "@/lib/openai-models";
import { prisma } from "@/lib/prisma";
import { getSaasConfig } from "@/lib/saas-config";

const STRONG_LEAD_SCORE = 75;
const DAILY_REDDIT_ITEM_EMBEDDING_OPERATION = "daily_reddit_item_embedding";
const SUBREDDIT_SET_BADGE_STYLES = [
  {
    badge: "bg-[#12331f] text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]",
    dot: "bg-[#1ed760]",
  },
  {
    badge: "bg-[#102742] text-[#8fc8ff] shadow-[rgb(78,155,255)_0px_0px_0px_1px_inset]",
    dot: "bg-[#4e9bff]",
  },
  {
    badge: "bg-[#341b42] text-[#dfa7ff] shadow-[rgb(192,115,255)_0px_0px_0px_1px_inset]",
    dot: "bg-[#c073ff]",
  },
  {
    badge: "bg-[#3b2d10] text-[#ffd66e] shadow-[rgb(242,201,76)_0px_0px_0px_1px_inset]",
    dot: "bg-[#f2c94c]",
  },
  {
    badge: "bg-[#3a151b] text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset]",
    dot: "bg-[#f3727f]",
  },
  {
    badge: "bg-[#113332] text-[#85f2ee] shadow-[rgb(72,205,200)_0px_0px_0px_1px_inset]",
    dot: "bg-[#48cdc8]",
  },
] as const;

type AnalyticsSearchParams = {
  userId?: string;
  campaignId?: string;
  priceModel?: string;
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<AnalyticsSearchParams> | AnalyticsSearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const params = await Promise.resolve(searchParams ?? {});
  const saasConfig = await getSaasConfig();
  const dailyRssPauseState = await getDailyRssPollerPauseState();
  const selectedPriceModel = normalizeLeadScoringModel(params.priceModel ?? saasConfig.leadScoringModel);

  const [users, campaigns, leads, usageEvents, campaignRunCounts] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.campaign.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        leadType: true,
        isActive: true,
        subreddits: true,
        createdAt: true,
        updatedAt: true,
        sync: {
          select: {
            status: true,
            stage: true,
            message: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.lead.findMany({
      select: {
        campaignId: true,
        userId: true,
        label: true,
        score: true,
        ai: {
          select: {
            model: true,
          },
        },
      },
    }),
    prisma.aiUsageEvent.findMany({
      select: {
        userId: true,
        campaignId: true,
        campaignRunId: true,
        operation: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
      },
    }),
    prisma.campaignRun.groupBy({
      by: ["campaignId"],
      _count: {
        _all: true,
      },
    }),
  ]);

  const campaignsByUser = groupBy(campaigns, (campaign) => campaign.userId);
  const leadsByUser = groupBy(leads, (lead) => lead.userId);
  const leadsByCampaign = groupBy(leads, (lead) => lead.campaignId);
  const userCostById = sumUsageCosts(usageEvents, selectedPriceModel, (event) => event.userId);
  const campaignCostById = sumUsageCosts(usageEvents, selectedPriceModel, (event) => event.campaignId);
  const runCostById = sumUsageCosts(usageEvents, selectedPriceModel, (event) => event.campaignRunId);
  const runCountByCampaignId = new Map(campaignRunCounts.map((entry) => [entry.campaignId, entry._count._all]));

  const selectedUser = users.find((user) => user.id === params.userId) ?? users[0] ?? null;
  const selectedUserCampaigns = selectedUser ? campaignsByUser.get(selectedUser.id) ?? [] : [];
  const groupedSelectedUserCampaigns = buildCampaignSubredditGroups(selectedUserCampaigns);
  const selectedCampaign =
    groupedSelectedUserCampaigns.find((item) => item.campaign.id === params.campaignId)?.campaign
    ?? groupedSelectedUserCampaigns[0]?.campaign
    ?? null;
  const selectedCampaignLeads = selectedCampaign ? leadsByCampaign.get(selectedCampaign.id) ?? [] : [];
  const selectedCampaignRuns = selectedCampaign
    ? await prisma.campaignRun.findMany({
        where: {
          campaignId: selectedCampaign.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      })
    : [];

  const totalCost = usageEvents.reduce((sum, event) => sum + calculateDisplayCost(event, selectedPriceModel), 0);
  const dailyIngestCost = usageEvents
    .filter((event) => event.operation === DAILY_REDDIT_ITEM_EMBEDDING_OPERATION)
    .reduce((sum, event) => sum + calculateDisplayCost(event, selectedPriceModel), 0);
  const totalStrongLeads = leads.filter(isStrongClassifiedLead).length;

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[24px] bg-[#181818] px-5 py-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:px-6 lg:py-6">
        <div className="grid gap-5">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Admin analytics</p>
            <h1 className="mt-2 text-[1.85rem] font-bold text-[#ffffff] lg:text-[2.2rem]">SaaS control board</h1>
            <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
              Owner-only view of users, campaigns, run history, ingestion health, and tracked OpenAI API cost.
            </p>
          </div>

          <div className="grid gap-4 rounded-[20px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] lg:grid-cols-[1.1fr_1.2fr_0.9fr] lg:items-start">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Reports</p>
                <span className="h-px flex-1 bg-white/8" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <AdminReportLink href="/admin/analytics/daily-leads" icon={<CalendarDays className="h-4 w-4" />} label="Daily Leads" />
                <AdminReportLink href="/admin/analytics/daily-subreddit" icon={<Database className="h-4 w-4" />} label="Daily Subreddit" />
                <AdminReportLink href="/admin/analytics/rss-polling" icon={<ScrollText className="h-4 w-4" />} label="RSS Poll Logs" />
                <AdminReportLink href="/admin/analytics/playground" icon={<FlaskConical className="h-4 w-4" />} label="Playground" />
                <AdminReportLink href="/admin/analytics/onboarding" icon={<UserPlus className="h-4 w-4" />} label="Onboarding" />
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/8 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Controls</p>
                <span className="h-px flex-1 bg-white/8" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <SaasSettingsDialog
                  leadScoringModel={saasConfig.leadScoringModel}
                  subredditSuggestionCount={saasConfig.subredditSuggestionCount}
                />
                <SubredditPerformanceDialog />
                <DailyRssIngestionControl initialState={dailyRssPauseState} />
                <DailySemanticOverrideButton />
              </div>
            </div>

            <div className="grid gap-2 border-t border-white/8 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Lead scoring cost model</p>
              <div className="flex w-full flex-wrap rounded-full bg-[#181818] p-1 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] lg:flex-col lg:rounded-[16px]">
                {LEAD_SCORING_MODEL_OPTIONS.map((model) => (
                  <Link
                    className={`min-h-9 flex-1 rounded-full px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] transition-colors lg:w-full ${
                      selectedPriceModel === model.id ? "bg-[#1ed760] text-[#121212]" : "text-[#b3b3b3] hover:bg-[#1f1f1f] hover:text-[#ffffff]"
                    }`}
                    href={buildAnalyticsHref({
                      campaignId: selectedCampaign?.id,
                      priceModel: model.id,
                      userId: selectedUser?.id,
                    })}
                    key={model.id}
                  >
                    {model.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Users" value={String(users.length)} />
        <MetricCard label="Campaigns" value={String(campaigns.length)} />
        <MetricCard label="Strong leads" value={String(totalStrongLeads)} />
        <MetricCard label="Daily ingest cost" value={formatCurrency(dailyIngestCost)} />
        <MetricCard label="Tracked cost" value={formatCurrency(totalCost)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1fr_1.2fr]">
        <Panel title="Users" description="Registered accounts in the workspace.">
          <div className="space-y-2">
            {users.map((user) => {
              const userCampaigns = campaignsByUser.get(user.id) ?? [];
              const userLeads = leadsByUser.get(user.id) ?? [];
              const active = selectedUser?.id === user.id;

              return (
                <Link
                  className={`block rounded-[14px] border px-4 py-3 transition-colors ${
                    active
                      ? "border-[#1ed760]/40 bg-[#1f1f1f] text-[#ffffff] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
                      : "border-transparent bg-[#121212] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#1f1f1f]"
                  }`}
                  href={buildAnalyticsHref({ priceModel: selectedPriceModel, userId: user.id })}
                  key={user.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold">{user.name || user.email || "Unnamed user"}</p>
                      <p className={`mt-1 truncate text-[12px] ${active ? "text-[#cbcbcb]" : "text-[#b3b3b3]"}`}>{user.email || "No email"}</p>
                    </div>
                    <StatusPill label={user.plan} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <SmallStat label="Campaigns" value={userCampaigns.length} />
                    <SmallStat label="Leads" value={userLeads.length} />
                    <SmallStat label="Cost" value={formatCurrency(userCostById.get(user.id) ?? 0)} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel title="Campaigns" description={selectedUser ? `Campaigns for ${selectedUser.email ?? selectedUser.name ?? "user"}.` : "Select a user."}>
          {selectedUserCampaigns.length === 0 ? (
            <EmptyState text="No campaigns for this user." />
          ) : (
            <div className="space-y-2">
              {groupedSelectedUserCampaigns.map(({ campaign, group }) => {
                const campaignLeads = leadsByCampaign.get(campaign.id) ?? [];
                const active = selectedCampaign?.id === campaign.id;

                return (
                  <div
                    className={`rounded-[14px] border px-4 py-3 transition-colors ${
                      active
                        ? "border-[#1ed760]/40 bg-[#1f1f1f] text-[#ffffff] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
                        : "border-transparent bg-[#121212] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#1f1f1f]"
                    }`}
                    key={campaign.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        className="min-w-0 flex-1"
                        href={buildAnalyticsHref({ campaignId: campaign.id, priceModel: selectedPriceModel, userId: campaign.userId })}
                      >
                        <p className="truncate text-[13px] font-bold">{campaign.name}</p>
                        <p className={`mt-1 text-[12px] ${active ? "text-[#cbcbcb]" : "text-[#b3b3b3]"}`}>
                          {campaign.subreddits.length} subreddit{campaign.subreddits.length === 1 ? "" : "s"}
                        </p>
                        {group ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.12em] ${group.color.badge}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${group.color.dot}`} />
                              {group.label}
                            </span>
                            <span className={`text-[11px] leading-4 ${active ? "text-[#cbcbcb]" : "text-[#b3b3b3]"}`}>
                              Same {group.subredditCount} subreddit{group.subredditCount === 1 ? "" : "s"} across {group.size} campaigns
                            </span>
                          </div>
                        ) : null}
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusPill label={campaign.isActive ? "Active" : "Inactive"} />
                        <CampaignActiveToggle
                          campaignId={campaign.id}
                          campaignName={campaign.name}
                          initialIsActive={campaign.isActive}
                        />
                        <Link
                          className="inline-flex h-8 items-center justify-center rounded-full bg-[#121212] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
                          href={`/admin/analytics/daily-leads?campaignId=${campaign.id}`}
                        >
                          Daily leads
                        </Link>
                      </div>
                    </div>
                    <Link
                      className="mt-3 grid grid-cols-4 gap-2 text-[11px]"
                      href={buildAnalyticsHref({ campaignId: campaign.id, priceModel: selectedPriceModel, userId: campaign.userId })}
                    >
                      <SmallStat label="Leads" value={campaignLeads.length} />
                      <SmallStat label="Strong" value={campaignLeads.filter(isStrongClassifiedLead).length} />
                      <SmallStat label="Runs" value={runCountByCampaignId.get(campaign.id) ?? 0} />
                      <SmallStat label="Cost" value={formatCurrency(campaignCostById.get(campaign.id) ?? 0)} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Campaign detail" description={selectedCampaign ? selectedCampaign.name : "Select a campaign."}>
          {!selectedCampaign ? (
            <EmptyState text="No campaign selected." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard compact label="Total leads" value={String(selectedCampaignLeads.length)} />
                <MetricCard compact label="Strong leads" value={String(selectedCampaignLeads.filter(isStrongClassifiedLead).length)} />
                <MetricCard compact label="Runs" value={String(runCountByCampaignId.get(selectedCampaign.id) ?? 0)} />
                <MetricCard compact label="Cost" value={formatCurrency(campaignCostById.get(selectedCampaign.id) ?? 0)} />
              </div>

              <div className="rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Latest sync</p>
                    <p className="mt-2 text-[13px] leading-5 text-[#ffffff]">{selectedCampaign.sync?.message ?? "No sync status yet."}</p>
                  </div>
                  <StatusPill label={selectedCampaign.sync?.status ?? "IDLE"} />
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Recent runs</p>
                <div className="mt-3 overflow-hidden rounded-[18px] bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                  {selectedCampaignRuns.length === 0 ? (
                    <EmptyState text="No tracked runs yet. Runs are tracked from this release forward." />
                  ) : (
                    <div className="divide-y divide-[#27272a]">
                      {selectedCampaignRuns.map((run) => (
                        <div className="grid gap-3 px-4 py-3 text-[12px] text-[#b3b3b3] md:grid-cols-[1fr_auto_auto]" key={run.id}>
                          <div>
                            <p className="font-semibold text-[#ffffff]">{formatTrigger(run.trigger)}</p>
                            <p className="mt-1 text-[#b3b3b3]">{formatDate(run.createdAt)}</p>
                          </div>
                          <StatusPill label={run.status} />
                          <div className="text-right font-semibold text-[#1ed760]">{formatCurrency(runCostById.get(run.id) ?? run.totalCostUsd)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return grouped;
}

function buildCampaignSubredditGroups<T extends {
  id: string;
  name: string;
  subreddits: string[];
  updatedAt: Date;
}>(campaigns: T[]) {
  const campaignsBySubredditSet = groupBy(campaigns, (campaign) => buildSubredditSetKey(campaign.subreddits));
  const duplicateSetKeys = [...campaignsBySubredditSet.entries()]
    .filter(([, setCampaigns]) => setCampaigns.length > 1)
    .sort(([, leftCampaigns], [, rightCampaigns]) => {
      if (rightCampaigns.length !== leftCampaigns.length) {
        return rightCampaigns.length - leftCampaigns.length;
      }

      return getLatestUpdatedAt(rightCampaigns) - getLatestUpdatedAt(leftCampaigns);
    })
    .map(([key]) => key);
  const groupByKey = new Map(
    duplicateSetKeys.map((key, index) => {
      const setCampaigns = campaignsBySubredditSet.get(key) ?? [];

      return [
        key,
        {
          color: SUBREDDIT_SET_BADGE_STYLES[index % SUBREDDIT_SET_BADGE_STYLES.length],
          label: formatSubredditSetLabel(index),
          size: setCampaigns.length,
          subredditCount: key ? key.split("|").length : 0,
        },
      ];
    }),
  );

  return [...campaigns]
    .sort((left, right) => {
      const leftKey = buildSubredditSetKey(left.subreddits);
      const rightKey = buildSubredditSetKey(right.subreddits);
      const leftGroupIndex = duplicateSetKeys.indexOf(leftKey);
      const rightGroupIndex = duplicateSetKeys.indexOf(rightKey);
      const leftIsGrouped = leftGroupIndex >= 0;
      const rightIsGrouped = rightGroupIndex >= 0;

      if (leftIsGrouped && rightIsGrouped && leftGroupIndex !== rightGroupIndex) {
        return leftGroupIndex - rightGroupIndex;
      }

      if (leftIsGrouped !== rightIsGrouped) {
        return leftIsGrouped ? -1 : 1;
      }

      if (leftIsGrouped && rightIsGrouped && leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey);
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime() || left.name.localeCompare(right.name);
    })
    .map((campaign) => ({
      campaign,
      group: groupByKey.get(buildSubredditSetKey(campaign.subreddits)) ?? null,
    }));
}

function buildSubredditSetKey(subreddits: string[]) {
  return Array.from(new Set(subreddits.map(normalizeSubredditName).filter(Boolean)))
    .sort()
    .join("|");
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function getLatestUpdatedAt<T extends { updatedAt: Date }>(campaigns: T[]) {
  return Math.max(...campaigns.map((campaign) => campaign.updatedAt.getTime()));
}

function formatSubredditSetLabel(index: number) {
  return `Set ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) + 1 : ""}`;
}

function sumUsageCosts<T extends {
  campaignId: string | null;
  campaignRunId: string | null;
  costUsd: number;
  inputTokens: number | null;
  operation: string;
  outputTokens: number | null;
  totalTokens: number | null;
  userId: string | null;
}>(items: T[], priceModel: LeadScoringModelId, getKey: (item: T) => string | null) {
  const costs = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);

    if (!key) {
      continue;
    }

    costs.set(key, (costs.get(key) ?? 0) + calculateDisplayCost(item, priceModel));
  }

  return costs;
}

function calculateDisplayCost(
  event: {
    costUsd: number;
    inputTokens: number | null;
    operation: string;
    outputTokens: number | null;
    totalTokens: number | null;
  },
  priceModel: LeadScoringModelId,
) {
  if (event.operation !== "lead_classification") {
    return event.costUsd;
  }

  const pricing = LEAD_SCORING_MODEL_OPTIONS.find((model) => model.id === priceModel) ?? LEAD_SCORING_MODEL_OPTIONS[0];
  const inputTokens = normalizeTokenCount(event.inputTokens);
  const outputTokens = normalizeTokenCount(event.outputTokens);
  const totalTokens = normalizeTokenCount(event.totalTokens);
  const billableInputTokens = inputTokens > 0 ? inputTokens : Math.max(0, totalTokens - outputTokens);
  const inputCost = (billableInputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(8));
}

function normalizeTokenCount(value: number | null | undefined) {
  return Number.isFinite(value) && value && value > 0 ? Math.round(value) : 0;
}

function buildAnalyticsHref({
  campaignId,
  priceModel,
  userId,
}: {
  campaignId?: string | null;
  priceModel: LeadScoringModelId;
  userId?: string | null;
}) {
  const params = new URLSearchParams();

  if (userId) {
    params.set("userId", userId);
  }

  if (campaignId) {
    params.set("campaignId", campaignId);
  }

  params.set("priceModel", priceModel);

  return `/admin/analytics?${params.toString()}`;
}

function isStrongClassifiedLead(lead: { ai: { model: string | null } | null; label: string; score: number }) {
  return Boolean(lead.ai && lead.ai.model !== "semantic-threshold-filter" && lead.score > STRONG_LEAD_SCORE);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatTrigger(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AdminReportLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#1f1f1f] px-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
      href={href}
    >
      {icon}
      <span className="leading-4">{label}</span>
    </Link>
  );
}

function Panel({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return (
    <section className="rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="border-b border-[#27272a] pb-3">
        <h2 className="text-[16px] font-bold text-[#ffffff]">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-[#b3b3b3]">{description}</p>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function MetricCard({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return (
    <div className={`rounded-[20px] bg-[#181818] px-5 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] ${compact ? "px-4 py-3" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</p>
      <p className="mt-2 text-[1.55rem] font-bold leading-none text-[#ffffff]">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#b3b3b3]">{label}</div>
      <div className="mt-1 font-semibold text-inherit">{value}</div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[18px] border border-dashed border-[#3f3f46] bg-[#121212] p-4 text-[13px] leading-5 text-[#b3b3b3]">{text}</div>;
}
