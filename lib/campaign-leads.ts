import { Prisma } from "../generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildAccessibleCampaignWhere } from "@/lib/campaign-access";
import type { DailyLeadDateRangeValue } from "@/lib/daily-leads-analytics";

export const PUBLIC_CAMPAIGN_MIN_VISIBLE_LEAD_SCORE = 50;

export type CampaignLeadView = {
  id: string;
  score: number;
  label: "HIGH" | "MED" | "LOW";
  status: "NEW" | "SAVED" | "IGNORED" | "REPLIED";
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
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return [];
  }

  return buildCampaignLeadViews(campaignId, campaign.leads);
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
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return [];
  }

  return buildCampaignLeadViews(campaignId, campaign.leads);
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

async function buildCampaignLeadViews(
  campaignId: string,
  leads: Array<{
    id: string;
    score: number;
    label: "HIGH" | "MED" | "LOW";
    status: "NEW" | "SAVED" | "IGNORED" | "REPLIED";
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
    };
  }>,
): Promise<CampaignLeadView[]> {
  const semanticScores = await getSemanticScoresForLeads(
    campaignId,
    leads.map((lead) => lead.id),
  );

  return leads.map((lead) => ({
    id: lead.id,
    score: lead.score,
    label: lead.label,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
    semanticScore: semanticScores.get(lead.id) ?? null,
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
    },
  }));
}

async function getSemanticScoresForLeads(campaignId: string, leadIds: string[]) {
  if (leadIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.$queryRaw<Array<{ leadId: string; semanticScore: number }>>(
    Prisma.sql`
      SELECT
        "l"."id" AS "leadId",
        MAX(1 - ("rie"."embedding" <=> "csq"."embedding")) AS "semanticScore"
      FROM "Lead" "l"
      JOIN "RedditItemEmbedding" "rie"
        ON "rie"."redditItemId" = "l"."redditItemId"
      JOIN "CampaignSemanticQuery" "csq"
        ON "csq"."campaignId" = "l"."campaignId"
      WHERE "l"."campaignId" = ${campaignId}
        AND "l"."id" IN (${Prisma.join(leadIds)})
        AND "rie"."embedding" IS NOT NULL
        AND "csq"."embedding" IS NOT NULL
      GROUP BY "l"."id"
    `,
  );

  return new Map(rows.map((row) => [row.leadId, row.semanticScore]));
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
