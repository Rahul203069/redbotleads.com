import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";

const STRONG_LEAD_SCORE = 80;

type AnalyticsSearchParams = {
  userId?: string;
  campaignId?: string;
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

  const [users, campaigns, leads, userCosts, campaignCosts, campaignRunCounts] = await Promise.all([
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
    prisma.aiUsageEvent.groupBy({
      by: ["userId"],
      _sum: {
        costUsd: true,
      },
    }),
    prisma.aiUsageEvent.groupBy({
      by: ["campaignId"],
      where: {
        campaignId: {
          not: null,
        },
      },
      _sum: {
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
  const userCostById = new Map(userCosts.map((entry) => [entry.userId, entry._sum.costUsd ?? 0]));
  const campaignCostById = new Map(campaignCosts.map((entry) => [entry.campaignId, entry._sum.costUsd ?? 0]));
  const runCountByCampaignId = new Map(campaignRunCounts.map((entry) => [entry.campaignId, entry._count._all]));

  const selectedUser = users.find((user) => user.id === params.userId) ?? users[0] ?? null;
  const selectedUserCampaigns = selectedUser ? campaignsByUser.get(selectedUser.id) ?? [] : [];
  const selectedCampaign =
    selectedUserCampaigns.find((campaign) => campaign.id === params.campaignId) ?? selectedUserCampaigns[0] ?? null;
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

  const totalCost = userCosts.reduce((sum, entry) => sum + (entry._sum.costUsd ?? 0), 0);
  const totalStrongLeads = leads.filter(isStrongClassifiedLead).length;

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[24px] bg-[#181818] px-5 py-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Admin analytics</p>
            <h1 className="mt-2 text-[1.85rem] font-bold text-[#ffffff] lg:text-[2.2rem]">SaaS control board</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#cbcbcb]">
              Owner-only view of users, campaigns, run history, and tracked OpenAI API cost.
            </p>
          </div>
          <div className="rounded-full bg-[#121212] px-3 py-1.5 text-[12px] font-bold text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            Costs tracked forward only
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={String(users.length)} />
        <MetricCard label="Campaigns" value={String(campaigns.length)} />
        <MetricCard label="Strong leads" value={String(totalStrongLeads)} />
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
                  href={`/admin/analytics?userId=${user.id}`}
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
              {selectedUserCampaigns.map((campaign) => {
                const campaignLeads = leadsByCampaign.get(campaign.id) ?? [];
                const active = selectedCampaign?.id === campaign.id;

                return (
                  <Link
                    className={`block rounded-[14px] border px-4 py-3 transition-colors ${
                      active
                        ? "border-[#1ed760]/40 bg-[#1f1f1f] text-[#ffffff] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
                        : "border-transparent bg-[#121212] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#1f1f1f]"
                    }`}
                    href={`/admin/analytics?userId=${campaign.userId}&campaignId=${campaign.id}`}
                    key={campaign.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold">{campaign.name}</p>
                        <p className={`mt-1 text-[12px] ${active ? "text-[#cbcbcb]" : "text-[#b3b3b3]"}`}>
                          {campaign.subreddits.length} subreddit{campaign.subreddits.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <StatusPill label={campaign.isActive ? "Active" : "Paused"} />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                      <SmallStat label="Leads" value={campaignLeads.length} />
                      <SmallStat label="Strong" value={campaignLeads.filter(isStrongClassifiedLead).length} />
                      <SmallStat label="Runs" value={runCountByCampaignId.get(campaign.id) ?? 0} />
                      <SmallStat label="Cost" value={formatCurrency(campaignCostById.get(campaign.id) ?? 0)} />
                    </div>
                  </Link>
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
                          <div className="text-right font-semibold text-[#1ed760]">{formatCurrency(run.totalCostUsd)}</div>
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

function isStrongClassifiedLead(lead: { ai: { model: string | null } | null; label: string; score: number }) {
  return Boolean(lead.ai && lead.ai.model !== "semantic-threshold-filter" && (lead.label === "HIGH" || lead.score >= STRONG_LEAD_SCORE));
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
