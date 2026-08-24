import { prisma } from "@/lib/prisma";
import { buildAccessibleCampaignWhere } from "@/lib/campaign-access";
import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";
import type { DailyLeadDateRangeValue } from "@/lib/daily-leads-analytics";

export const PUBLIC_CAMPAIGN_MIN_VISIBLE_LEAD_SCORE = 40;

export type CampaignLeadView = {
  id: string;
  isDemo?: boolean;
  score: number;
  label: "HIGH" | "MED" | "LOW";
  status: CampaignLeadStatus;
  createdAt: string;
  semanticScore: number | null;
  ai: {
    intentType: "none" | "implicit" | "explicit" | "switching" | null;
    buyerStage: "solved" | "problem_aware" | "solution_aware" | "evaluating" | null;
    category: string | null;
    summary: string | null;
    painPoints: string[];
    disqualifier: string | null;
  } | null;
  redditItem: {
    type: "POST" | "COMMENT";
    subreddit: string;
    title: string | null;
    description: string | null;
    body: string | null;
    url: string | null;
    createdUtc: string;
  };
};

type NormalizedIntentType = NonNullable<CampaignLeadView["ai"]>["intentType"];
type NormalizedBuyerStage = NonNullable<CampaignLeadView["ai"]>["buyerStage"];

export async function getCampaignLeadViewsForUser({
  campaignId,
  dateRanges,
  email,
  from,
  to,
  userId,
}: {
  campaignId: string;
  dateRanges?: DailyLeadDateRangeValue[];
  email?: string | null;
  from?: Date;
  to?: Date;
  userId: string;
}): Promise<CampaignLeadView[]> {
  const leadDateWhere = buildLeadDateWhere({ dateRanges, from, to });
  const campaign = await prisma.campaign.findFirst({
    where: buildAccessibleCampaignWhere({
      campaignId,
      email,
      userId,
    }),
    select: {
      leads: {
        where: {
          ...leadDateWhere,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          ai: {
            select: {
              intentType: true,
              buyerStage: true,
              category: true,
              summary: true,
              painPoints: true,
              disqualifier: true,
            },
          },
          redditItem: {
            select: {
              type: true,
              subreddit: true,
              title: true,
              description: true,
              body: true,
              url: true,
              createdUtc: true,
              dailySemanticScans: {
                where: {
                  campaignId,
                },
                take: 1,
                select: {
                  bestScore: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return [];
  }

  return buildCampaignLeadViews(campaign.leads);
}

export async function getPublicCampaignLeadViews({
  campaignId,
  dateRanges,
  from,
  to,
}: {
  campaignId: string;
  dateRanges?: DailyLeadDateRangeValue[];
  from?: Date;
  to?: Date;
}): Promise<CampaignLeadView[]> {
  const leadDateWhere = buildLeadDateWhere({ dateRanges, from, to });
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      leads: {
        where: {
          score: {
            gte: PUBLIC_CAMPAIGN_MIN_VISIBLE_LEAD_SCORE,
          },
          ...leadDateWhere,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          ai: {
            select: {
              intentType: true,
              buyerStage: true,
              category: true,
              summary: true,
              painPoints: true,
              disqualifier: true,
            },
          },
          redditItem: {
            select: {
              type: true,
              subreddit: true,
              title: true,
              description: true,
              body: true,
              url: true,
              createdUtc: true,
              dailySemanticScans: {
                where: {
                  campaignId,
                },
                take: 1,
                select: {
                  bestScore: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return [];
  }

  return buildCampaignLeadViews(campaign.leads);
}

function buildLeadDateWhere({
  dateRanges,
  from,
  to,
}: {
  dateRanges?: DailyLeadDateRangeValue[];
  from?: Date;
  to?: Date;
}) {
  const validDateRanges = (dateRanges ?? []).filter((range) => range.from < range.to);

  if (validDateRanges.length > 0) {
    return {
      OR: validDateRanges.map((range) => ({
        createdAt: {
          gte: range.from,
          lt: range.to,
        },
      })),
    };
  }

  if (from && to) {
    return {
      createdAt: {
        gte: from,
        lt: to,
      },
    };
  }

  return {};
}

function buildCampaignLeadViews(
  leads: Array<{
    id: string;
    score: number;
    label: "HIGH" | "MED" | "LOW";
    status: CampaignLeadStatus;
    createdAt: Date;
    ai: {
      intentType: "NONE" | "IMPLICIT" | "EXPLICIT" | "SWITCHING" | null;
      buyerStage: "SOLVED" | "PROBLEM_AWARE" | "SOLUTION_AWARE" | "EVALUATING" | null;
      category: string | null;
      summary: string | null;
      painPoints: string[];
      disqualifier: string | null;
    } | null;
    redditItem: {
      type: "POST" | "COMMENT";
      subreddit: string;
      title: string | null;
      description: string | null;
      body: string | null;
      url: string | null;
      createdUtc: Date;
      dailySemanticScans: Array<{
        bestScore: number | null;
      }>;
    };
  }>,
): CampaignLeadView[] {
  return leads.map((lead) => ({
    id: lead.id,
    score: lead.score,
    label: lead.label,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
    semanticScore: lead.redditItem.dailySemanticScans[0]?.bestScore ?? null,
    ai: lead.ai
      ? {
          intentType: normalizeIntentType(lead.ai.intentType),
          buyerStage: normalizeBuyerStage(lead.ai.buyerStage),
          category: lead.ai.category,
          summary: lead.ai.summary,
          painPoints: lead.ai.painPoints,
          disqualifier: lead.ai.disqualifier,
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
  }));
}

function normalizeIntentType(
  value: "NONE" | "IMPLICIT" | "EXPLICIT" | "SWITCHING" | null,
): NormalizedIntentType {
  if (value === "NONE") return "none";
  if (value === "IMPLICIT") return "implicit";
  if (value === "EXPLICIT") return "explicit";
  if (value === "SWITCHING") return "switching";
  return null;
}

function normalizeBuyerStage(
  value: "SOLVED" | "PROBLEM_AWARE" | "SOLUTION_AWARE" | "EVALUATING" | null,
): NormalizedBuyerStage {
  if (value === "SOLVED") return "solved";
  if (value === "PROBLEM_AWARE") return "problem_aware";
  if (value === "SOLUTION_AWARE") return "solution_aware";
  if (value === "EVALUATING") return "evaluating";
  return null;
}
