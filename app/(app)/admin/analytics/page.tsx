import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CircleDollarSign,
  Database,
  FlaskConical,
  LayoutDashboard,
  Megaphone,
  Radio,
  ScrollText,
  Search,
  UserPlus,
  Users,
} from "lucide-react";

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
    <div className="space-y-6 text-[#ffffff]">
      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,#1b1b1b_0%,#151515_55%,#102118_100%)] px-5 py-6 shadow-[rgba(0,0,0,0.28)_0px_12px_32px] lg:px-7 lg:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#1ed760]/12 text-[#55e982] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#73f5a0]">Administration</p>
              <h1 className="mt-2 text-[1.85rem] font-bold tracking-[-0.03em] text-[#ffffff] lg:text-[2.25rem]">Analytics control center</h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#b8b8b8]">
                Monitor workspace growth, campaign output, ingestion health, worker activity, and tracked AI spend from one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
            <HeaderStatus
              label={dailyRssPauseState.paused ? "Daily RSS paused" : "Daily RSS active"}
              tone={dailyRssPauseState.paused ? "warn" : "good"}
            />
            <HeaderStatus label={`${selectedPriceModel} pricing`} tone="neutral" />
            <HeaderStatus label={`${campaigns.filter((campaign) => campaign.isActive).length} active campaigns`} tone="neutral" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Workspace users" value={String(users.length)} />
        <MetricCard icon={<Megaphone className="h-5 w-5" />} label="Campaigns" value={String(campaigns.length)} />
        <MetricCard icon={<Activity className="h-5 w-5" />} label="Strong leads" value={String(totalStrongLeads)} />
        <MetricCard icon={<Bot className="h-5 w-5" />} label="Daily ingest cost" value={formatCurrency(dailyIngestCost)} />
        <MetricCard icon={<CircleDollarSign className="h-5 w-5" />} label="Tracked AI cost" value={formatCurrency(totalCost)} />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          description="Open focused reports and diagnostic workspaces."
          icon={<Search className="h-5 w-5" />}
          title="Reports and tools"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
            <AdminReportLink description="Review daily lead volume and campaign quality." href="/admin/analytics/daily-leads" icon={<CalendarDays className="h-5 w-5" />} label="Daily leads" />
            <AdminReportLink description="Inspect ingestion and matching by subreddit." href="/admin/analytics/daily-subreddit" icon={<Database className="h-5 w-5" />} label="Daily subreddit" />
            <AdminReportLink description="Audit polling attempts, responses, and failures." href="/admin/analytics/rss-polling" icon={<ScrollText className="h-5 w-5" />} label="RSS polling logs" />
            <AdminReportLink description="Test semantic queries against embedded posts." href="/admin/analytics/playground" icon={<FlaskConical className="h-5 w-5" />} label="Semantic playground" />
            <AdminReportLink description="Review and maintain campaign query sets." href="/admin/analytics/semantic-queries" icon={<Search className="h-5 w-5" />} label="Semantic queries" />
            <AdminReportLink description="Create and configure managed client campaigns." href="/admin/analytics/onboarding" icon={<UserPlus className="h-5 w-5" />} label="Client onboarding" />
          </div>
        </Panel>

        <Panel
          description="Run operational actions and control cost estimates."
          icon={<Radio className="h-5 w-5" />}
          title="Operations"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ControlCard description="Models and global SaaS defaults." title="Platform settings">
              <SaasSettingsDialog
                leadScoringModel={saasConfig.leadScoringModel}
                subredditSuggestionCount={saasConfig.subredditSuggestionCount}
              />
            </ControlCard>
            <ControlCard description="Compare subreddit performance by campaign." title="Performance report">
              <SubredditPerformanceDialog />
            </ControlCard>
            <ControlCard description="Pause or resume scheduled RSS ingestion." title="RSS ingestion">
              <DailyRssIngestionControl initialState={dailyRssPauseState} />
            </ControlCard>
            <ControlCard description="Queue semantic filtering outside the schedule." title="Semantic override">
              <DailySemanticOverrideButton />
            </ControlCard>
          </div>

          <div className="mt-4 rounded-[18px] border border-white/[0.06] bg-[#101010] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold text-[#ffffff]">Lead-scoring cost model</p>
                <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">Recalculate displayed classification cost without changing the worker model.</p>
              </div>
              <div className="flex shrink-0 rounded-full border border-white/[0.08] bg-[#181818] p-1">
                {LEAD_SCORING_MODEL_OPTIONS.map((model) => (
                  <Link
                    className={`min-h-9 rounded-full px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                      selectedPriceModel === model.id
                        ? "bg-[#1ed760] text-[#0d160f]"
                        : "text-[#a1a1aa] hover:bg-[#252525] hover:text-[#ffffff]"
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
        </Panel>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Panel
          description={`${users.length} registered account${users.length === 1 ? "" : "s"}`}
          icon={<Users className="h-5 w-5" />}
          title="Accounts"
        >
          {users.length === 0 ? (
            <EmptyState text="No registered users yet." />
          ) : (
            <div className="max-h-[760px] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {users.map((user) => {
                const userCampaigns = campaignsByUser.get(user.id) ?? [];
                const userLeads = leadsByUser.get(user.id) ?? [];
                const active = selectedUser?.id === user.id;

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`group block rounded-[16px] border p-3.5 transition-colors ${
                      active
                        ? "border-[#1ed760]/40 bg-[#1ed760]/[0.07]"
                        : "border-white/[0.06] bg-[#111111] hover:border-white/[0.12] hover:bg-[#171717]"
                    }`}
                    href={buildAnalyticsHref({ priceModel: selectedPriceModel, userId: user.id })}
                    key={user.id}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? "bg-[#1ed760] text-[#101510]" : "bg-[#252525] text-[#d4d4d8]"}`}>
                        {getInitials(user.name, user.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#ffffff]">{user.name || user.email || "Unnamed user"}</p>
                            <p className="mt-0.5 truncate text-[11px] text-[#8f8f8f]">{user.email || "No email"}</p>
                          </div>
                          <StatusPill label={user.plan} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <SmallStat label="Campaigns" value={userCampaigns.length} />
                          <SmallStat label="Leads" value={userLeads.length} />
                          <SmallStat label="Cost" value={formatCurrency(userCostById.get(user.id) ?? 0)} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel
            description={selectedUser ? `Campaigns owned by ${selectedUser.email ?? selectedUser.name ?? "this account"}.` : "Select an account to continue."}
            icon={<Megaphone className="h-5 w-5" />}
            title="Campaign portfolio"
          >
            {selectedUserCampaigns.length === 0 ? (
              <EmptyState text="No campaigns for this user." />
            ) : (
              <div className="grid gap-3 2xl:grid-cols-2">
                {groupedSelectedUserCampaigns.map(({ campaign, group }) => {
                  const campaignLeads = leadsByCampaign.get(campaign.id) ?? [];
                  const active = selectedCampaign?.id === campaign.id;

                  return (
                    <article
                      className={`rounded-[18px] border p-4 transition-colors ${
                        active
                          ? "border-[#1ed760]/40 bg-[#1ed760]/[0.055]"
                          : "border-white/[0.06] bg-[#111111] hover:border-white/[0.12] hover:bg-[#171717]"
                      }`}
                      key={campaign.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/60"
                          href={buildAnalyticsHref({ campaignId: campaign.id, priceModel: selectedPriceModel, userId: campaign.userId })}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill label={campaign.isActive ? "Active" : "Inactive"} />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">{campaign.leadType}</span>
                          </div>
                          <h3 className="mt-3 truncate text-[15px] font-bold text-[#ffffff]">{campaign.name}</h3>
                          <p className="mt-1 text-[12px] text-[#8f8f8f]">
                            Tracking {campaign.subreddits.length} subreddit{campaign.subreddits.length === 1 ? "" : "s"}
                          </p>
                        </Link>
                        <CampaignActiveToggle
                          campaignId={campaign.id}
                          campaignName={campaign.name}
                          initialIsActive={campaign.isActive}
                        />
                      </div>

                      {group ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] bg-black/20 px-3 py-2">
                          <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[9px] font-bold uppercase tracking-[0.12em] ${group.color.badge}`}>
                            <span className={`h-2 w-2 rounded-full ${group.color.dot}`} />
                            {group.label}
                          </span>
                          <span className="text-[11px] leading-4 text-[#a1a1aa]">
                            Same {group.subredditCount} subreddit{group.subredditCount === 1 ? "" : "s"} across {group.size} campaigns
                          </span>
                        </div>
                      ) : null}

                      <Link
                        className="mt-4 grid grid-cols-4 gap-2 rounded-[14px] border border-white/[0.05] bg-black/20 p-3 transition-colors hover:bg-black/30"
                        href={buildAnalyticsHref({ campaignId: campaign.id, priceModel: selectedPriceModel, userId: campaign.userId })}
                      >
                        <SmallStat label="Leads" value={campaignLeads.length} />
                        <SmallStat label="Strong" value={campaignLeads.filter(isStrongClassifiedLead).length} />
                        <SmallStat label="Runs" value={runCountByCampaignId.get(campaign.id) ?? 0} />
                        <SmallStat label="Cost" value={formatCurrency(campaignCostById.get(campaign.id) ?? 0)} />
                      </Link>

                      <div className="mt-3 flex justify-end">
                        <Link
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b3b3b3] transition-colors hover:bg-[#252525] hover:text-[#ffffff]"
                          href={`/admin/analytics/daily-leads?campaignId=${campaign.id}`}
                        >
                          Daily leads
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            description={selectedCampaign ? "Performance, sync state, and recent processing history." : "Select a campaign above to inspect it."}
            icon={<Activity className="h-5 w-5" />}
            title="Campaign overview"
          >
            {!selectedCampaign ? (
              <EmptyState text="No campaign selected." />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label={selectedCampaign.isActive ? "Active" : "Inactive"} />
                      <StatusPill label={selectedCampaign.leadType} />
                    </div>
                    <h3 className="mt-3 text-[20px] font-bold tracking-[-0.02em] text-[#ffffff]">{selectedCampaign.name}</h3>
                    <p className="mt-1 text-[12px] text-[#8f8f8f]">Updated {formatDate(selectedCampaign.updatedAt)}</p>
                  </div>
                  <Link
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffffff] transition-colors hover:bg-[#292929]"
                    href={`/campaigns/${selectedCampaign.id}`}
                  >
                    Open campaign
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard compact label="Total leads" value={String(selectedCampaignLeads.length)} />
                  <MetricCard compact label="Strong leads" value={String(selectedCampaignLeads.filter(isStrongClassifiedLead).length)} />
                  <MetricCard compact label="Tracked runs" value={String(runCountByCampaignId.get(selectedCampaign.id) ?? 0)} />
                  <MetricCard compact label="AI cost" value={formatCurrency(campaignCostById.get(selectedCampaign.id) ?? 0)} />
                </div>

                <div className="grid gap-4 2xl:grid-cols-[0.7fr_1.3fr]">
                  <div className="rounded-[18px] border border-white/[0.06] bg-[#111111] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[#d4d4d8]">
                        <Radio className="h-4 w-4 text-[#1ed760]" />
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Latest sync</p>
                      </div>
                      <StatusPill label={selectedCampaign.sync?.status ?? "IDLE"} />
                    </div>
                    <p className="mt-4 text-[14px] leading-6 text-[#e4e4e7]">{selectedCampaign.sync?.message ?? "No sync status has been recorded yet."}</p>
                    <dl className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 text-[12px] sm:grid-cols-2 2xl:grid-cols-1">
                      <DetailRow label="Stage" value={selectedCampaign.sync?.stage ?? "NONE"} />
                      <DetailRow label="Last update" value={selectedCampaign.sync?.updatedAt ? formatDate(selectedCampaign.sync.updatedAt) : "Not available"} />
                    </dl>
                  </div>

                  <div className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#111111]">
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#d4d4d8]">Recent runs</p>
                        <p className="mt-1 text-[11px] text-[#737373]">Latest 20 processing events</p>
                      </div>
                      <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-bold text-[#a1a1aa]">{selectedCampaignRuns.length}</span>
                    </div>
                    {selectedCampaignRuns.length === 0 ? (
                      <div className="p-4">
                        <EmptyState text="No tracked runs yet. Runs are tracked from this release forward." />
                      </div>
                    ) : (
                      <div className="max-h-[420px] divide-y divide-white/[0.06] overflow-y-auto overscroll-contain">
                        {selectedCampaignRuns.map((run) => (
                          <div className="grid items-center gap-3 px-4 py-3 text-[12px] sm:grid-cols-[minmax(0,1fr)_110px_90px]" key={run.id}>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#f4f4f5]">{formatTrigger(run.trigger)}</p>
                              <p className="mt-1 text-[11px] text-[#737373]">{formatDate(run.createdAt)}</p>
                            </div>
                            <StatusPill label={run.status} />
                            <div className="text-left font-semibold tabular-nums text-[#73f5a0] sm:text-right">
                              {formatCurrency(runCostById.get(run.id) ?? run.totalCostUsd)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>
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

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function AdminReportLink({
  description,
  href,
  icon,
  label,
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      className="group flex min-h-[104px] items-start gap-3 rounded-[18px] border border-white/[0.06] bg-[#111111] p-4 transition-colors hover:border-[#1ed760]/25 hover:bg-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/60"
      href={href}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#1ed760]/10 text-[#55e982]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-[13px] font-bold text-[#ffffff]">
          {label}
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[#525252] transition-colors group-hover:text-[#73f5a0]" />
        </span>
        <span className="mt-1.5 block text-[12px] leading-5 text-[#8f8f8f]">{description}</span>
      </span>
    </Link>
  );
}

function Panel({
  children,
  description,
  icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.22)_0px_10px_28px] lg:p-5">
      <div className="flex items-start gap-3 border-b border-white/[0.06] pb-4">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#242424] text-[#d4d4d8]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-[#ffffff]">{title}</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">{description}</p>
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function ControlCard({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return (
    <div className="flex min-h-[132px] flex-col rounded-[18px] border border-white/[0.06] bg-[#111111] p-4">
      <p className="text-[12px] font-bold text-[#f4f4f5]">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-[#737373]">{description}</p>
      <div className="mt-auto pt-4 [&_button]:!w-full">{children}</div>
    </div>
  );
}

function MetricCard({ compact = false, icon, label, value }: { compact?: boolean; icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className={`rounded-[20px] border border-white/[0.06] bg-[#181818] shadow-[rgba(0,0,0,0.2)_0px_8px_22px] ${compact ? "px-4 py-3.5" : "px-5 py-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8f8f]">{label}</p>
          <p className={`${compact ? "mt-2 text-[1.35rem]" : "mt-3 text-[1.65rem]"} font-bold leading-none tracking-[-0.03em] text-[#ffffff]`}>{value}</p>
        </div>
        {icon ? <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#1ed760]/10 text-[#55e982]">{icon}</span> : null}
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</div>
      <div className="mt-1 truncate text-[12px] font-semibold text-[#d4d4d8]">{value}</div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  const tone = getStatusTone(label);
  const className = tone === "good"
    ? "bg-[#12331f] text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]"
    : tone === "warn"
      ? "bg-[#3b2d10] text-[#ffd66e] shadow-[rgb(242,201,76)_0px_0px_0px_1px_inset]"
      : tone === "bad"
        ? "bg-[#3a151b] text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset]"
        : "bg-[#242424] text-[#b3b3b3] shadow-[rgb(74,74,74)_0px_0px_0px_1px_inset]";

  return (
    <span className={`inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}

function HeaderStatus({ label, tone }: { label: string; tone: "good" | "warn" | "neutral" }) {
  const className = tone === "good"
    ? "border-[#1ed760]/25 bg-[#1ed760]/10 text-[#73f5a0]"
    : tone === "warn"
      ? "border-[#f2c94c]/25 bg-[#f2c94c]/10 text-[#ffd66e]"
      : "border-white/[0.08] bg-white/[0.04] text-[#b3b3b3]";

  return (
    <span className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}

function getStatusTone(label: string): "good" | "warn" | "bad" | "neutral" {
  const normalized = label.trim().toUpperCase();

  if (["ACTIVE", "COMPLETED", "SUCCESS", "SENT", "FREE", "PRO", "PRODUCT", "SERVICE"].includes(normalized)) {
    return "good";
  }

  if (["QUEUED", "PROCESSING", "FETCHING", "RETRYING", "PAUSED", "IDLE"].includes(normalized)) {
    return "warn";
  }

  if (["INACTIVE", "FAILED", "ERROR", "RATE_LIMITED"].includes(normalized)) {
    return "bad";
  }

  return "neutral";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#d4d4d8]">{value}</dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[18px] border border-dashed border-[#3f3f46] bg-[#121212] p-4 text-[13px] leading-5 text-[#b3b3b3]">{text}</div>;
}
