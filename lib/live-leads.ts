import type { Prisma } from "@/generated/prisma/client";

import { buildAccessibleCampaignWhere, getCampaignAccessFromRecord, getCampaignDisplayName, normalizeAccessEmail } from "@/lib/campaign-access";
import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";
import { prisma } from "@/lib/prisma";

export const LIVE_MIN_VISIBLE_LEAD_SCORE = 40;
export const LIVE_HIGH_INTENT_SCORE = 75;
export const LIVE_PAGE_SIZE = 50;

export type LiveLeadFilter = "ALL" | "UNREVIEWED" | CampaignLeadStatus;

export type LiveLeadView = {
  ai: {
    buyerStage: string | null;
    category: string | null;
    intentType: string | null;
    painPoints: string[];
    summary: string | null;
  } | null;
  campaign: { id: string; name: string };
  createdAt: string;
  id: string;
  label: "HIGH" | "MED" | "LOW";
  notes: string | null;
  redditItem: {
    body: string | null;
    createdUtc: string;
    description: string | null;
    subreddit: string;
    title: string | null;
    type: "POST" | "COMMENT";
    url: string | null;
  };
  score: number;
  semanticScore: number | null;
  status: CampaignLeadStatus;
};

export type LiveLeadStatusCounts = Record<CampaignLeadStatus, number> & {
  ALL: number;
  UNREVIEWED: number;
};

type Viewer = { email?: string | null; userId: string };

function accessibleCampaignWhere(viewer: Viewer, campaignId?: string): Prisma.CampaignWhereInput {
  return buildAccessibleCampaignWhere({ campaignId, email: viewer.email, userId: viewer.userId });
}

function qualifiedLeadWhere(viewer: Viewer, options?: { activeCampaignsOnly?: boolean; campaignId?: string }): Prisma.LeadWhereInput {
  return {
    ai: { isNot: null },
    score: { gte: LIVE_MIN_VISIBLE_LEAD_SCORE },
    campaign: {
      is: {
        ...accessibleCampaignWhere(viewer, options?.campaignId),
        ...(options?.activeCampaignsOnly ? { isActive: true } : {}),
      },
    },
  };
}

function statusWhere(filter: LiveLeadFilter | undefined): Prisma.LeadWhereInput {
  if (!filter || filter === "ALL") return {};
  return { status: filter === "UNREVIEWED" ? "NEW" : filter };
}

const liveLeadSelect = {
  id: true,
  campaignId: true,
  score: true,
  label: true,
  status: true,
  notes: true,
  createdAt: true,
  campaign: { select: { id: true, name: true } },
  ai: { select: { intentType: true, buyerStage: true, category: true, summary: true, painPoints: true } },
  redditItem: {
    select: {
      type: true,
      subreddit: true,
      title: true,
      description: true,
      body: true,
      url: true,
      createdUtc: true,
      dailySemanticScans: { select: { campaignId: true, bestScore: true } },
    },
  },
} satisfies Prisma.LeadSelect;

type LiveLeadRecord = Prisma.LeadGetPayload<{ select: typeof liveLeadSelect }>;

function serializeLead(lead: LiveLeadRecord, displayName?: string): LiveLeadView {
  return {
    id: lead.id,
    campaign: { id: lead.campaign.id, name: displayName ?? lead.campaign.name },
    score: lead.score,
    label: lead.label,
    status: lead.status,
    notes: lead.notes,
    createdAt: lead.createdAt.toISOString(),
    semanticScore: lead.redditItem.dailySemanticScans.find((scan) => scan.campaignId === lead.campaignId)?.bestScore ?? null,
    ai: lead.ai
      ? {
          intentType: lead.ai.intentType?.toLowerCase() ?? null,
          buyerStage: lead.ai.buyerStage?.toLowerCase() ?? null,
          category: lead.ai.category,
          summary: lead.ai.summary,
          painPoints: lead.ai.painPoints,
        }
      : null,
    redditItem: {
      type: lead.redditItem.type,
      subreddit: lead.redditItem.subreddit,
      title: lead.redditItem.title,
      description: lead.redditItem.description,
      body: lead.redditItem.body,
      url: lead.redditItem.url,
      createdUtc: lead.redditItem.createdUtc.toISOString(),
    },
  };
}

export async function getLiveInbox(viewer: Viewer & { campaignId?: string; cursor?: string; filter?: LiveLeadFilter }) {
  const where: Prisma.LeadWhereInput = {
    ...qualifiedLeadWhere(viewer, { activeCampaignsOnly: true, campaignId: viewer.campaignId }),
    ...statusWhere(viewer.filter ?? "UNREVIEWED"),
  };
  const countWhere = qualifiedLeadWhere(viewer, { activeCampaignsOnly: true, campaignId: viewer.campaignId });

  const [records, grouped, campaigns] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: liveLeadSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIVE_PAGE_SIZE + 1,
      ...(viewer.cursor ? { cursor: { id: viewer.cursor }, skip: 1 } : {}),
    }),
    prisma.lead.groupBy({ by: ["status"], where: countWhere, _count: { _all: true } }),
    prisma.campaign.findMany({
      where: { ...accessibleCampaignWhere(viewer), isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        userId: true,
        clientAccesses: {
          where: { normalizedEmail: normalizeAccessEmail(viewer.email) },
          select: { displayName: true, normalizedEmail: true },
        },
      },
    }),
  ]);

  const hasMore = records.length > LIVE_PAGE_SIZE;
  const pageRecords = hasMore ? records.slice(0, LIVE_PAGE_SIZE) : records;
  const campaignNames = new Map(campaigns.map((campaign) => {
    const access = getCampaignAccessFromRecord({ campaign, email: viewer.email, userId: viewer.userId });
    return [campaign.id, getCampaignDisplayName(campaign, access)];
  }));
  const counts: LiveLeadStatusCounts = { ALL: 0, UNREVIEWED: 0, NEW: 0, REVIEWED: 0, SAVED: 0, CONTACTED: 0, DISMISSED: 0 };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.ALL += row._count._all;
  }
  counts.UNREVIEWED = counts.NEW;

  return {
    campaigns: campaigns.map((campaign) => ({ id: campaign.id, name: campaignNames.get(campaign.id) ?? campaign.name })),
    counts,
    leads: pageRecords.map((lead) => serializeLead(lead, campaignNames.get(lead.campaignId))),
    nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null,
  };
}

export async function getLiveLeadById(viewer: Viewer & { leadId: string }) {
  const lead = await prisma.lead.findFirst({
    where: { id: viewer.leadId, ...qualifiedLeadWhere(viewer) },
    select: liveLeadSelect,
  });
  if (!lead) return null;

  const campaign = await prisma.campaign.findFirst({
    where: accessibleCampaignWhere(viewer, lead.campaignId),
    select: {
      id: true,
      name: true,
      userId: true,
      clientAccesses: {
        where: { normalizedEmail: normalizeAccessEmail(viewer.email) },
        select: { displayName: true, normalizedEmail: true },
      },
    },
  });
  const access = campaign ? getCampaignAccessFromRecord({ campaign, email: viewer.email, userId: viewer.userId }) : null;
  return serializeLead(lead, campaign ? getCampaignDisplayName(campaign, access) : undefined);
}

export async function getLiveCampaignCards(viewer: Viewer, timeRange: { todayFrom: Date; weekFrom: Date }) {
  const campaigns = await prisma.campaign.findMany({
    where: accessibleCampaignWhere(viewer),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      subreddits: true,
      userId: true,
      clientAccesses: {
        where: { normalizedEmail: normalizeAccessEmail(viewer.email) },
        select: { displayName: true, normalizedEmail: true },
      },
      runs: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true, updatedAt: true },
      },
    },
  });
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const baseWhere: Prisma.LeadWhereInput = {
    campaignId: { in: campaignIds },
    ai: { isNot: null },
    score: { gte: LIVE_MIN_VISIBLE_LEAD_SCORE },
  };
  const [todayCounts, weekCounts] = campaignIds.length
    ? await Promise.all([
        prisma.lead.groupBy({ by: ["campaignId"], where: { ...baseWhere, createdAt: { gte: timeRange.todayFrom } }, _count: { _all: true } }),
        prisma.lead.groupBy({ by: ["campaignId"], where: { ...baseWhere, createdAt: { gte: timeRange.weekFrom } }, _count: { _all: true } }),
      ])
    : [[], []];
  const todayByCampaign = new Map(todayCounts.map((row) => [row.campaignId, row._count._all]));
  const weekByCampaign = new Map(weekCounts.map((row) => [row.campaignId, row._count._all]));

  return campaigns.map((campaign) => {
    const access = getCampaignAccessFromRecord({ campaign, email: viewer.email, userId: viewer.userId });
    const latestRun = campaign.runs[0];
    return {
      id: campaign.id,
      name: getCampaignDisplayName(campaign, access),
      description: campaign.description,
      isActive: campaign.isActive,
      leadCountToday: todayByCampaign.get(campaign.id) ?? 0,
      leadCountWeek: weekByCampaign.get(campaign.id) ?? 0,
      lastCheckedAt: (latestRun?.completedAt ?? latestRun?.updatedAt)?.toISOString() ?? null,
      sourceCount: campaign.subreddits.length,
      role: access?.role ?? "CLIENT",
    };
  });
}

export async function getLiveCampaignOverview(viewer: Viewer & { campaignId: string }, todayFrom: Date) {
  const campaign = await prisma.campaign.findFirst({
    where: accessibleCampaignWhere(viewer, viewer.campaignId),
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      regions: true,
      subreddits: true,
      userId: true,
      clientAccesses: {
        where: { normalizedEmail: normalizeAccessEmail(viewer.email) },
        select: { displayName: true, normalizedEmail: true },
      },
      runs: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true, updatedAt: true },
      },
    },
  });
  if (!campaign) return null;
  const leadWhere = { campaignId: campaign.id, ai: { isNot: null }, score: { gte: LIVE_MIN_VISIBLE_LEAD_SCORE } } satisfies Prisma.LeadWhereInput;
  const [today, highIntent, contacted, recent] = await Promise.all([
    prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: todayFrom } } }),
    prisma.lead.count({ where: { ...leadWhere, score: { gte: LIVE_HIGH_INTENT_SCORE } } }),
    prisma.lead.count({ where: { ...leadWhere, status: "CONTACTED" } }),
    prisma.lead.findMany({ where: leadWhere, select: liveLeadSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5 }),
  ]);
  const access = getCampaignAccessFromRecord({ campaign, email: viewer.email, userId: viewer.userId });
  const displayName = getCampaignDisplayName(campaign, access);
  const latestRun = campaign.runs[0];
  return {
    campaign: {
      id: campaign.id,
      name: displayName,
      description: campaign.description,
      isActive: campaign.isActive,
      regions: campaign.regions,
      sources: campaign.subreddits,
      role: access?.role ?? "CLIENT",
      lastCheckedAt: (latestRun?.completedAt ?? latestRun?.updatedAt)?.toISOString() ?? null,
    },
    metrics: { today, highIntent, contacted },
    recentLeads: recent.map((lead) => serializeLead(lead, displayName)),
  };
}

export async function getLiveCampaignHistory(
  viewer: Viewer & {
    campaignId: string;
    cursor?: string;
    from?: Date;
    intent?: "HIGH" | "MED" | "LOW";
    source?: "POST" | "COMMENT";
    status?: CampaignLeadStatus;
    subreddit?: string;
    to?: Date;
  },
) {
  const where: Prisma.LeadWhereInput = {
    ...qualifiedLeadWhere(viewer, { campaignId: viewer.campaignId }),
    ...(viewer.from || viewer.to ? { createdAt: { ...(viewer.from ? { gte: viewer.from } : {}), ...(viewer.to ? { lt: viewer.to } : {}) } } : {}),
    ...(viewer.intent ? { label: viewer.intent } : {}),
    ...(viewer.status ? { status: viewer.status } : {}),
    ...(viewer.source || viewer.subreddit ? { redditItem: { is: { ...(viewer.source ? { type: viewer.source } : {}), ...(viewer.subreddit ? { subreddit: viewer.subreddit } : {}) } } } : {}),
  };
  const [campaign, records, subreddits] = await Promise.all([
    prisma.campaign.findFirst({
      where: accessibleCampaignWhere(viewer, viewer.campaignId),
      select: {
        id: true,
        name: true,
        userId: true,
        clientAccesses: {
          where: { normalizedEmail: normalizeAccessEmail(viewer.email) },
          select: { displayName: true, normalizedEmail: true },
        },
      },
    }),
    prisma.lead.findMany({
      where,
      select: liveLeadSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIVE_PAGE_SIZE + 1,
      ...(viewer.cursor ? { cursor: { id: viewer.cursor }, skip: 1 } : {}),
    }),
    prisma.redditItem.findMany({
      where: { leads: { some: qualifiedLeadWhere(viewer, { campaignId: viewer.campaignId }) } },
      distinct: ["subreddit"],
      orderBy: { subreddit: "asc" },
      select: { subreddit: true },
    }),
  ]);
  if (!campaign) return null;
  const access = getCampaignAccessFromRecord({ campaign, email: viewer.email, userId: viewer.userId });
  const displayName = getCampaignDisplayName(campaign, access);
  const hasMore = records.length > LIVE_PAGE_SIZE;
  const pageRecords = hasMore ? records.slice(0, LIVE_PAGE_SIZE) : records;
  return {
    campaign: { id: campaign.id, name: displayName },
    leads: pageRecords.map((lead) => serializeLead(lead, displayName)),
    nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null,
    subreddits: subreddits.map((item) => item.subreddit),
  };
}

export type LiveNotificationFilter = "ALL" | "UNHANDLED" | "HANDLED" | "PENDING" | "FAILED";

export async function getLiveNotifications(viewer: Viewer & { cursor?: string; filter?: LiveNotificationFilter }) {
  const filter = viewer.filter ?? "ALL";
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: viewer.userId,
    ...(filter === "UNHANDLED" ? { handledAt: null } : {}),
    ...(filter === "HANDLED" ? { handledAt: { not: null } } : {}),
    ...(filter === "PENDING" || filter === "FAILED" ? { status: filter } : {}),
  };
  const [records, unhandledCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIVE_PAGE_SIZE + 1,
      ...(viewer.cursor ? { cursor: { id: viewer.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        channel: true,
        status: true,
        error: true,
        sentAt: true,
        handledAt: true,
        createdAt: true,
        campaignDisplayName: true,
        lead: { select: { id: true, campaignId: true, score: true, redditItem: { select: { title: true, body: true, subreddit: true } } } },
      },
    }),
    prisma.notification.count({ where: { recipientUserId: viewer.userId, handledAt: null } }),
  ]);
  const hasMore = records.length > LIVE_PAGE_SIZE;
  const pageRecords = hasMore ? records.slice(0, LIVE_PAGE_SIZE) : records;
  return {
    notifications: pageRecords.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      sentAt: notification.sentAt?.toISOString() ?? null,
      handledAt: notification.handledAt?.toISOString() ?? null,
    })),
    nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null,
    unhandledCount,
  };
}
