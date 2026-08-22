import type { CampaignLeadDateFilter } from "@/lib/admin-classified-leads";
import type { DailyLeadDateSelection } from "@/lib/daily-leads-analytics";

const NON_LLM_CLASSIFICATION_MODELS = new Set([
  "classification-error",
  "semantic-threshold-filter",
]);

export type AdminSemanticPassedScanRecord = {
  id: string;
  campaignRunId: string | null;
  bestScore: number | null;
  bestQueryId: string | null;
  bestQueryText: string | null;
  createdAt: Date;
  redditItem: {
    id: string;
    fullname: string;
    type: "POST" | "COMMENT";
    subreddit: string;
    title: string | null;
    description: string | null;
    body: string | null;
    author: string | null;
    url: string | null;
    createdUtc: Date;
    fetchedAt: Date;
    leads: Array<{
      id: string;
      score: number;
      label: "HIGH" | "MED" | "LOW";
      status: "NEW" | "REVIEWED" | "SAVED" | "CONTACTED" | "DISMISSED";
      createdAt: Date;
      ai: {
        model: string | null;
        promptVersion: string | null;
        intentType: "NONE" | "IMPLICIT" | "EXPLICIT" | "SWITCHING" | null;
        buyerStage: "SOLVED" | "PROBLEM_AWARE" | "SOLUTION_AWARE" | "EVALUATING" | null;
        category: string | null;
        summary: string | null;
        painPoints: string[];
        disqualifier: string | null;
      } | null;
    }>;
  };
};

export type AdminSemanticPassedPost = ReturnType<typeof buildAdminSemanticPassedPost>;
type AdminSemanticPassedLead = AdminSemanticPassedScanRecord["redditItem"]["leads"][number];
type AdminSemanticPassedLeadAi = NonNullable<AdminSemanticPassedLead["ai"]>;

export function buildAdminSemanticPassedScanWhere(selection: DailyLeadDateSelection) {
  const dateWhere = selection.source === "dates"
    ? {
        OR: selection.ranges.map((range) => ({
          createdAt: {
            gte: range.from,
            lt: range.to,
          },
        })),
      }
    : {
        createdAt: {
          gte: selection.range.from,
          lt: selection.range.to,
        },
      };

  return {
    ...dateWhere,
    status: "MATCHED" as const,
    redditItem: {
      type: "POST" as const,
    },
  };
}

export function buildAdminSemanticPassedPosts(scans: AdminSemanticPassedScanRecord[]) {
  return scans.map(buildAdminSemanticPassedPost);
}

export function buildCampaignLeadsJsonExport<TLead>({
  campaign,
  copiedAt,
  dateFilter,
  dateLabel,
  filters,
  leads,
  semanticPassedPosts,
}: {
  campaign: {
    id: string;
    name: string;
  };
  copiedAt: string;
  dateFilter: CampaignLeadDateFilter;
  dateLabel: string;
  filters: Record<string, unknown>;
  leads: TLead[];
  semanticPassedPosts: AdminSemanticPassedPost[];
}) {
  return {
    campaign,
    copiedAt,
    filters,
    leads,
    totalLeads: leads.length,
    semanticPassedSelection: {
      ...dateFilter,
      field: "semanticScan.createdAt",
      label: dateLabel,
      timeZone: "UTC",
      status: "MATCHED",
      recordType: "POST",
    },
    semanticPassedPosts,
    totalSemanticPassedPosts: semanticPassedPosts.length,
  };
}

function buildAdminSemanticPassedPost(scan: AdminSemanticPassedScanRecord) {
  const lead = scan.redditItem.leads[0] ?? null;
  const llmScored = Boolean(
    lead?.ai?.model && !NON_LLM_CLASSIFICATION_MODELS.has(lead.ai.model),
  );

  return {
    semanticScanId: scan.id,
    campaignRunId: scan.campaignRunId,
    semanticScore: scan.bestScore,
    semanticPassedAt: scan.createdAt.toISOString(),
    matchedSemanticQuery: {
      id: scan.bestQueryId,
      text: scan.bestQueryText,
    },
    redditPost: {
      id: scan.redditItem.id,
      fullname: scan.redditItem.fullname,
      type: scan.redditItem.type,
      subreddit: scan.redditItem.subreddit,
      title: scan.redditItem.title,
      description: scan.redditItem.description,
      body: scan.redditItem.body,
      author: scan.redditItem.author,
      url: scan.redditItem.url,
      createdUtc: scan.redditItem.createdUtc.toISOString(),
      fetchedAt: scan.redditItem.fetchedAt.toISOString(),
    },
    lead: lead
      ? {
          id: lead.id,
          status: lead.status,
          createdAt: lead.createdAt.toISOString(),
          llmScored,
          score: llmScored ? lead.score : null,
          label: llmScored ? lead.label : null,
          ai: lead.ai
            ? {
                model: lead.ai.model,
                promptVersion: lead.ai.promptVersion,
                intentType: normalizeIntentType(lead.ai.intentType),
                buyerStage: normalizeBuyerStage(lead.ai.buyerStage),
                category: lead.ai.category,
                summary: lead.ai.summary,
                painPoints: lead.ai.painPoints,
                disqualifier: lead.ai.disqualifier,
              }
            : null,
        }
      : null,
  };
}

function normalizeIntentType(value: AdminSemanticPassedLeadAi["intentType"]) {
  if (value === "NONE") return "none" as const;
  if (value === "IMPLICIT") return "implicit" as const;
  if (value === "EXPLICIT") return "explicit" as const;
  if (value === "SWITCHING") return "switching" as const;
  return null;
}

function normalizeBuyerStage(value: AdminSemanticPassedLeadAi["buyerStage"]) {
  if (value === "SOLVED") return "solved" as const;
  if (value === "PROBLEM_AWARE") return "problem_aware" as const;
  if (value === "SOLUTION_AWARE") return "solution_aware" as const;
  if (value === "EVALUATING") return "evaluating" as const;
  return null;
}
