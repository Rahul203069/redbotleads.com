import type { CampaignLeadView } from "@/lib/campaign-leads";

export type CampaignLeadDateFilter = {
  date?: string | string[];
  from?: string;
  range?: string;
  to?: string;
};

export type AdminClassifiedLead = Omit<CampaignLeadView, "ai"> & {
  ai: NonNullable<CampaignLeadView["ai"]>;
};

export function getAdminClassifiedLeads(leads: CampaignLeadView[]): AdminClassifiedLead[] {
  return leads.filter((lead): lead is AdminClassifiedLead => lead.ai !== null);
}

export function buildAdminClassifiedLeadsJson({
  campaignId,
  campaignName,
  copiedAt,
  dateFilter,
  dateLabel,
  leads,
}: {
  campaignId: string;
  campaignName: string;
  copiedAt: string;
  dateFilter: CampaignLeadDateFilter;
  dateLabel: string;
  leads: AdminClassifiedLead[];
}) {
  return {
    campaign: {
      id: campaignId,
      name: campaignName,
    },
    copiedAt,
    dateSelection: {
      ...dateFilter,
      field: "lead.createdAt",
      label: dateLabel,
      timeZone: "UTC",
    },
    totalClassifiedLeads: leads.length,
    leads: leads.map((lead) => ({
      id: lead.id,
      score: lead.score,
      semanticScore: lead.semanticScore,
      label: lead.label,
      status: lead.status,
      createdAt: lead.createdAt,
      ai: {
        intentType: lead.ai.intentType,
        buyerStage: lead.ai.buyerStage,
        category: lead.ai.category,
        summary: lead.ai.summary,
        painPoints: lead.ai.painPoints,
        disqualifier: lead.ai.disqualifier,
      },
      redditItem: {
        type: lead.redditItem.type,
        subreddit: lead.redditItem.subreddit,
        title: lead.redditItem.title,
        description: lead.redditItem.description,
        body: lead.redditItem.body,
        url: lead.redditItem.url,
      },
    })),
  };
}
