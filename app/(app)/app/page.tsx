import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  buildAccessibleCampaignWhere,
  getCampaignAccessFromRecord,
  getCampaignDisplayName,
} from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";

const MIN_VISIBLE_LEAD_SCORE = 40;
const STRONG_LEAD_SCORE = 75;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export default async function AppHomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const displayName = session.user.name ?? session.user.email ?? "operator";
  const dayAgo = new Date(new Date().valueOf() - DAY_IN_MS);

  const [campaigns, recentStrongLeads] = await Promise.all([
    prisma.campaign.findMany({
      where: buildAccessibleCampaignWhere({
        email: session.user.email,
        userId: session.user.id,
      }),
      select: {
        id: true,
        userId: true,
        name: true,
        isActive: true,
        updatedAt: true,
        clientAccesses: {
          where: {
            normalizedEmail: String(session.user.email ?? "").trim().toLowerCase(),
          },
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
    }),
    prisma.lead.findMany({
      where: {
        campaign: buildAccessibleCampaignWhere({
          email: session.user.email,
          userId: session.user.id,
        }),
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
        campaign: {
          select: {
            id: true,
            userId: true,
            name: true,
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
        },
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
  ]);

  const activeCampaigns = campaigns.filter((campaign) => campaign.isActive).length;
  const syncsRunning = campaigns.filter(
    (campaign) => campaign.sync?.status === "QUEUED" || campaign.sync?.status === "PROCESSING",
  ).length;
  const failedSyncs = campaigns.filter((campaign) => campaign.sync?.status === "FAILED").length;
  const newStrongLeads = campaigns.reduce((count, campaign) => {
    return (
      count +
      campaign.leads.filter(
        (lead) => lead.ai && lead.score > STRONG_LEAD_SCORE && lead.createdAt.getTime() >= dayAgo.getTime(),
      ).length
    );
  }, 0);

  const upcomingSyncs = campaigns
    .filter((campaign) => campaign.isActive)
    .map((campaign) => {
      const access = getCampaignAccessFromRecord({
        campaign,
        email: session.user.email,
        userId: session.user.id,
      });
      const lastSyncSource =
        campaign.sync?.completedAt ??
        campaign.sync?.failedAt ??
        campaign.sync?.lastHeartbeat ??
        campaign.sync?.updatedAt ??
        campaign.updatedAt;

      return {
        id: campaign.id,
        name: getCampaignDisplayName(campaign, access),
        nextSyncAt: new Date(lastSyncSource.getTime() + DAY_IN_MS),
        status: campaign.sync?.status ?? "IDLE",
      };
    })
    .sort((left, right) => left.nextSyncAt.getTime() - right.nextSyncAt.getTime())
    .slice(0, 4);

  const topCampaigns = campaigns
    .map((campaign) => {
      const access = getCampaignAccessFromRecord({
        campaign,
        email: session.user.email,
        userId: session.user.id,
      });

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
      getCampaignAccessFromRecord({
        campaign: lead.campaign,
        email: session.user.email,
        userId: session.user.id,
      }),
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">Overview</p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
              Workspace snapshot
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">Signed in as {displayName}.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryLink href="/campaigns">Open campaigns</PrimaryLink>
          </div>
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
          <SectionCard
            description="The next campaigns expected to run on the daily sync cadence."
            title="Upcoming syncs"
          >
            {upcomingSyncs.length === 0 ? (
              <EmptyCopy text="No active campaigns are scheduled yet." />
            ) : (
              <div className="space-y-3">
                {upcomingSyncs.map((campaign) => (
                  <Link
                    key={campaign.id}
                    className="flex items-center justify-between gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#161616]"
                    href={`/campaigns/${campaign.id}`}
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

          <SectionCard
            description="A quick read on which campaigns are currently producing the strongest signal."
            title="Campaign snapshot"
          >
            {topCampaigns.length === 0 ? (
              <EmptyCopy text="Create a campaign to start building the workspace snapshot." />
            ) : (
              <div className="space-y-3">
                {topCampaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    className="flex items-center justify-between gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#161616]"
                    href={`/campaigns/${campaign.id}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#fdfdfd]">{campaign.name}</p>
                      <p className="mt-1 text-[12px] text-[#b3b3b3]">
                        {campaign.visibleLeadCount} visible lead{campaign.visibleLeadCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-bold leading-none text-[#1ed760]">
                        {campaign.strongLeadCount}
                      </div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                        Strong
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          description="Latest high-intent leads that already cleared the visible score threshold."
          title="Recent strong leads"
        >
          {recentStrongLeadViews.length === 0 ? (
            <EmptyCopy text="No strong leads yet. Once high-scoring matches land, they will appear here." />
          ) : (
            <div className="space-y-3">
              {recentStrongLeadViews.map((lead) => (
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
