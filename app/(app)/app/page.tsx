import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceLeadsTrendChart, type WorkspaceLeadsTrendRow } from "@/components/campaigns/workspace-leads-trend-chart";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  buildAccessibleCampaignWhere,
  getCampaignAccessFromRecord,
  getCampaignDisplayName,
} from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";

const MIN_VISIBLE_LEAD_SCORE = 40;
const STRONG_LEAD_SCORE = 75;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_TREND_DAYS = 14;

export default async function AppHomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (canViewAnalytics(session.user.email)) {
    return (
      <AdminWorkspaceDashboard
        displayName={session.user.name ?? session.user.email ?? "operator"}
        email={session.user.email}
        userId={session.user.id}
      />
    );
  }

  const now = new Date();
  const dayAgo = new Date(now.valueOf() - DAY_IN_MS);
  const trendFrom = getUtcDayStart(new Date(now.valueOf() - (DASHBOARD_TREND_DAYS - 1) * DAY_IN_MS));

  const campaign = await prisma.campaign.findFirst({
    where: buildAccessibleCampaignWhere({
      email: session.user.email,
      userId: session.user.id,
    }),
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      isActive: true,
      updatedAt: true,
      sync: {
        select: {
          status: true,
          completedAt: true,
          failedAt: true,
          lastHeartbeat: true,
          updatedAt: true,
        },
      },
      leads: {
        select: {
          score: true,
          createdAt: true,
          ai: {
            select: {
              id: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const [recentStrongLeads, trendScans] = campaign
    ? await Promise.all([
        prisma.lead.findMany({
          where: {
            campaignId: campaign.id,
            score: {
              gt: STRONG_LEAD_SCORE,
            },
            ai: {
              isNot: null,
            },
          },
          select: {
            id: true,
            score: true,
            createdAt: true,
            ai: {
              select: {
                summary: true,
              },
            },
            redditItem: {
              select: {
                subreddit: true,
                title: true,
                url: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 4,
        }),
        prisma.campaignDailySemanticScan.findMany({
          where: {
            campaignId: campaign.id,
            updatedAt: {
              gte: trendFrom,
              lt: new Date(now.valueOf() + 60 * 1000),
            },
          },
          select: {
            campaignId: true,
            redditItemId: true,
            status: true,
            updatedAt: true,
          },
          orderBy: {
            updatedAt: "asc",
          },
        }),
      ])
    : [[], []];

  const visibleLeads = campaign?.leads.filter((lead) => lead.ai && lead.score >= MIN_VISIBLE_LEAD_SCORE).length ?? 0;
  const newStrongLeads = campaign?.leads.filter(
    (lead) => lead.ai && lead.score > STRONG_LEAD_SCORE && lead.createdAt.getTime() >= dayAgo.getTime(),
  ).length ?? 0;
  const nextSyncAt = campaign ? getNextSyncAt(campaign) : null;
  const campaignStatus = campaign?.sync?.status ?? (campaign ? "IDLE" : "NONE");

  const matchedTrendPairs = trendScans
    .filter((scan) => scan.status === "MATCHED")
    .map((scan) => ({
      campaignId: scan.campaignId,
      redditItemId: scan.redditItemId,
    }));
  const trendLeads = matchedTrendPairs.length === 0
    ? []
    : await prisma.lead.findMany({
        where: {
          campaignId: campaign?.id,
          OR: matchedTrendPairs,
        },
        select: {
          ai: {
            select: {
              id: true,
            },
          },
          campaignId: true,
          redditItemId: true,
          score: true,
        },
      });
  const trendRows = buildWorkspaceLeadsTrendRows({
    from: trendFrom,
    leadByPair: new Map(trendLeads.map((lead) => [buildTrendPairKey(lead.campaignId, lead.redditItemId), lead])),
    scans: trendScans,
  });

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">Workspace overview</p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
              Lead intelligence dashboard
            </h1>
            <p className="mt-3 max-w-[68ch] text-[15px] leading-6 text-[#cbcbcb]">
              Monitor lead discovery, spot high-intent opportunities, and keep your daily outreach focused in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryLink href={campaign ? `/campaigns/${campaign.id}` : "/campaigns"}>
              {campaign ? "Open campaign" : "Create campaign"}
            </PrimaryLink>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaign status" value={campaign ? formatStatus(campaign.isActive ? campaignStatus : "PAUSED") : "None"} />
        <StatCard label="Next sync" value={campaign?.isActive && nextSyncAt ? formatDate(nextSyncAt) : "Paused"} />
        <StatCard label="Total leads" value={String(visibleLeads).padStart(2, "0")} />
        <StatCard label="New strong leads" value={String(newStrongLeads).padStart(2, "0")} />
      </section>

      <div className="space-y-5">
        <SectionCard
          description="A 14-day view of every Reddit lead found and the strongest opportunities identified for this campaign."
          title="Campaign performance"
        >
          <WorkspaceLeadsTrendChart rows={trendRows} />
        </SectionCard>

        <SectionCard
          description="Latest high-intent leads that already cleared the visible score threshold."
          title="Recent strong leads"
        >
          {recentStrongLeads.length === 0 ? (
            <EmptyCopy text="No strong leads yet. Once high-scoring matches land, they will appear here." />
          ) : (
            <div className="space-y-3">
              {recentStrongLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#fdfdfd]">
                        {lead.redditItem.title || `Lead from r/${lead.redditItem.subreddit}`}
                      </p>
                      <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-[#b3b3b3]">
                        r/{lead.redditItem.subreddit}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]">
                      {lead.score}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[#cbcbcb]">
                    {lead.ai?.summary || "Lead classified and ready for review."}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[12px] text-[#b3b3b3]">{formatDate(lead.createdAt)}</span>
                    <div className="flex flex-wrap gap-2">
                      {campaign ? <MiniLink href={`/campaigns/${campaign.id}`}>Open</MiniLink> : null}
                      {lead.redditItem.url ? (
                        <MiniExternalLink href={lead.redditItem.url}>Reddit</MiniExternalLink>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

async function AdminWorkspaceDashboard({
  displayName,
  email,
  userId,
}: {
  displayName: string;
  email: string | null | undefined;
  userId: string;
}) {
  const dayAgo = new Date(new Date().valueOf() - DAY_IN_MS);
  const accessibleCampaignWhere = buildAccessibleCampaignWhere({ email, userId });
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  const [campaigns, recentStrongLeads] = await Promise.all([
    prisma.campaign.findMany({
      where: accessibleCampaignWhere,
      select: {
        id: true,
        userId: true,
        name: true,
        isActive: true,
        updatedAt: true,
        clientAccesses: {
          where: { normalizedEmail },
          select: {
            displayName: true,
            normalizedEmail: true,
          },
        },
        sync: {
          select: {
            status: true,
            completedAt: true,
            failedAt: true,
            lastHeartbeat: true,
            updatedAt: true,
          },
        },
        leads: {
          select: {
            score: true,
            createdAt: true,
            ai: { select: { id: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        campaign: accessibleCampaignWhere,
        score: { gt: STRONG_LEAD_SCORE },
        ai: { isNot: null },
      },
      select: {
        id: true,
        score: true,
        createdAt: true,
        campaign: {
          select: {
            id: true,
            userId: true,
            name: true,
            clientAccesses: {
              where: { normalizedEmail },
              select: {
                displayName: true,
                normalizedEmail: true,
              },
            },
          },
        },
        ai: { select: { summary: true } },
        redditItem: {
          select: {
            subreddit: true,
            title: true,
            url: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const activeCampaigns = campaigns.filter((campaign) => campaign.isActive).length;
  const syncsRunning = campaigns.filter(
    (campaign) => campaign.sync?.status === "QUEUED" || campaign.sync?.status === "PROCESSING",
  ).length;
  const failedSyncs = campaigns.filter((campaign) => campaign.sync?.status === "FAILED").length;
  const newStrongLeads = campaigns.reduce(
    (count, campaign) =>
      count +
      campaign.leads.filter(
        (lead) => lead.ai && lead.score > STRONG_LEAD_SCORE && lead.createdAt.getTime() >= dayAgo.getTime(),
      ).length,
    0,
  );

  const upcomingSyncs = campaigns
    .filter((campaign) => campaign.isActive)
    .map((campaign) => {
      const access = getCampaignAccessFromRecord({ campaign, email, userId });
      return {
        id: campaign.id,
        name: getCampaignDisplayName(campaign, access),
        nextSyncAt: getNextSyncAt(campaign),
        status: campaign.sync?.status ?? "IDLE",
      };
    })
    .sort((left, right) => left.nextSyncAt.getTime() - right.nextSyncAt.getTime())
    .slice(0, 4);

  const topCampaigns = campaigns
    .map((campaign) => {
      const access = getCampaignAccessFromRecord({ campaign, email, userId });
      return {
        id: campaign.id,
        name: getCampaignDisplayName(campaign, access),
        strongLeadCount: campaign.leads.filter((lead) => lead.ai && lead.score > STRONG_LEAD_SCORE).length,
        visibleLeadCount: campaign.leads.filter((lead) => lead.ai && lead.score >= MIN_VISIBLE_LEAD_SCORE).length,
      };
    })
    .sort(
      (left, right) =>
        right.strongLeadCount - left.strongLeadCount || right.visibleLeadCount - left.visibleLeadCount,
    )
    .slice(0, 4);

  const recentStrongLeadViews = recentStrongLeads.map((lead) => ({
    ...lead,
    campaignDisplayName: getCampaignDisplayName(
      lead.campaign,
      getCampaignAccessFromRecord({ campaign: lead.campaign, email, userId }),
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">Admin overview</p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
              Workspace snapshot
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">Signed in as {displayName}.</p>
          </div>
          <PrimaryLink href="/campaigns">Open campaigns</PrimaryLink>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active campaigns" value={String(activeCampaigns).padStart(2, "0")} />
        <StatCard label="Syncs running" value={String(syncsRunning).padStart(2, "0")} />
        <StatCard label="Failed syncs" value={String(failedSyncs).padStart(2, "0")} />
        <StatCard label="New strong leads" value={String(newStrongLeads).padStart(2, "0")} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <SectionCard description="The next campaigns expected to run on the daily sync cadence." title="Upcoming syncs">
            {upcomingSyncs.length === 0 ? (
              <EmptyCopy text="No active campaigns are scheduled yet." />
            ) : (
              <div className="space-y-3">
                {upcomingSyncs.map((campaign) => (
                  <Link
                    className="flex items-center justify-between gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#161616]"
                    href={`/campaigns/${campaign.id}`}
                    key={campaign.id}
                  >
                    <div>
                      <p className="text-[13px] font-bold text-[#fdfdfd]">{campaign.name}</p>
                      <p className="mt-1 text-[12px] text-[#b3b3b3]">{formatDate(campaign.nextSyncAt)}</p>
                    </div>
                    <StatusPill status={campaign.status} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard description="Campaigns currently producing the strongest lead signal." title="Campaign snapshot">
            {topCampaigns.length === 0 ? (
              <EmptyCopy text="Create a campaign to start building the workspace snapshot." />
            ) : (
              <div className="space-y-3">
                {topCampaigns.map((campaign) => (
                  <Link
                    className="flex items-center justify-between gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#161616]"
                    href={`/campaigns/${campaign.id}`}
                    key={campaign.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#fdfdfd]">{campaign.name}</p>
                      <p className="mt-1 text-[12px] text-[#b3b3b3]">
                        {campaign.visibleLeadCount} total lead{campaign.visibleLeadCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-bold leading-none text-[#1ed760]">{campaign.strongLeadCount}</div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Strong</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard description="Latest high-intent leads across every campaign." title="Recent strong leads">
          {recentStrongLeadViews.length === 0 ? (
            <EmptyCopy text="No strong leads yet. Once high-scoring matches land, they will appear here." />
          ) : (
            <div className="space-y-3">
              {recentStrongLeadViews.map((lead) => (
                <div
                  className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
                  key={lead.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#fdfdfd]">
                        {lead.redditItem.title || `Lead from r/${lead.redditItem.subreddit}`}
                      </p>
                      <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-[#b3b3b3]">
                        {lead.campaignDisplayName} / r/{lead.redditItem.subreddit}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]">
                      {lead.score}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[#cbcbcb]">
                    {lead.ai?.summary || "Lead classified and ready for review."}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[12px] text-[#b3b3b3]">{formatDate(lead.createdAt)}</span>
                    <div className="flex flex-wrap gap-2">
                      <MiniLink href={`/campaigns/${lead.campaign.id}`}>Open</MiniLink>
                      {lead.redditItem.url ? <MiniExternalLink href={lead.redditItem.url}>Reddit</MiniExternalLink> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#1f1f1f] px-5 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">{label}</div>
      <div className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{value}</div>
    </div>
  );
}

function SectionCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
      <div className="border-b border-white/8 pb-5">
        <h2 className="text-[24px] font-bold tracking-tight text-[#ffffff]">{title}</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">{description}</p>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <div className="rounded-[18px] bg-[#121212] px-4 py-5 text-[14px] leading-6 text-[#b3b3b3]">{text}</div>;
}

function PrimaryLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1ed760] px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#121212] transition hover:bg-[#3be477]"
    >
      {children}
    </Link>
  );
}

function MiniLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      className="inline-flex items-center rounded-full bg-[#1f1f1f] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffffff]"
      href={href}
    >
      {children}
    </Link>
  );
}

function MiniExternalLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      className="inline-flex items-center rounded-full bg-[#1ed760] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#121212]"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function StatusPill({ status }: { status: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" }) {
  const tone =
    status === "COMPLETED"
      ? "text-[#1ed760]"
      : status === "FAILED"
        ? "text-[#f3727f]"
        : status === "PROCESSING"
          ? "text-[#ffffff]"
          : "text-[#b3b3b3]";

  return (
    <span className={`rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {status}
    </span>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function getNextSyncAt(campaign: {
  sync: {
    completedAt: Date | null;
    failedAt: Date | null;
    lastHeartbeat: Date | null;
    updatedAt: Date;
  } | null;
  updatedAt: Date;
}) {
  const lastSyncSource =
    campaign.sync?.completedAt ??
    campaign.sync?.failedAt ??
    campaign.sync?.lastHeartbeat ??
    campaign.sync?.updatedAt ??
    campaign.updatedAt;

  return new Date(lastSyncSource.getTime() + DAY_IN_MS);
}

function buildWorkspaceLeadsTrendRows({
  from,
  leadByPair,
  scans,
}: {
  from: Date;
  leadByPair: Map<string, {
    ai: {
      id: string;
    } | null;
    campaignId: string;
    redditItemId: string;
    score: number;
  }>;
  scans: Array<{
    campaignId: string;
    redditItemId: string;
    status: "MATCHED" | "NO_MATCH";
    updatedAt: Date;
  }>;
}) {
  const rows = new Map<string, WorkspaceLeadsTrendRow>();

  for (let index = 0; index < DASHBOARD_TREND_DAYS; index += 1) {
    const day = new Date(from.getTime() + index * DAY_IN_MS);
    const key = getUtcDayKey(day);
    rows.set(key, {
      day: key,
      label: formatTrendLabel(key),
      scanned: 0,
      totalLeads: 0,
      strongLeads: 0,
    });
  }

  for (const scan of scans) {
    const key = getUtcDayKey(scan.updatedAt);
    const row = rows.get(key);

    if (!row) {
      continue;
    }

    row.scanned += 1;

    if (scan.status === "MATCHED") {
      const lead = leadByPair.get(buildTrendPairKey(scan.campaignId, scan.redditItemId));

      if (lead?.ai && lead.score >= MIN_VISIBLE_LEAD_SCORE) {
        row.totalLeads += 1;

        if (lead.score > STRONG_LEAD_SCORE) {
          row.strongLeads += 1;
        }
      }
    }
  }

  return Array.from(rows.values());
}

function buildTrendPairKey(campaignId: string, redditItemId: string) {
  return `${campaignId}:${redditItemId}`;
}

function getUtcDayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function getUtcDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatTrendLabel(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}
