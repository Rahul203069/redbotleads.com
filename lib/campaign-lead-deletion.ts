export type DailySemanticRunLead = {
  ai: {
    id: string;
  } | null;
  score: number;
};

export function buildDailySemanticRunStatsAfterLeadDeletion({
  existingStats,
  leads,
  matchedScans,
  noMatchScans,
}: {
  existingStats: unknown;
  leads: DailySemanticRunLead[];
  matchedScans: number;
  noMatchScans: number;
}) {
  const classifiedLeads = leads.filter((lead) => lead.ai !== null);

  return {
    ...(isJsonObject(existingStats) ? existingStats : {}),
    matchedPosts: matchedScans,
    noMatchPosts: noMatchScans,
    scannedPosts: matchedScans + noMatchScans,
    totalLeadsFound: matchedScans,
    classifiedLeads: classifiedLeads.length,
    strongLeads: classifiedLeads.filter((lead) => lead.score > 75).length,
    notStrongLeads: classifiedLeads.filter((lead) => lead.score <= 75).length,
    pendingClassifications: leads.length - classifiedLeads.length,
  };
}

export function getCampaignLeadDeletionRevalidationPaths(campaignId: string) {
  return [
    "/app",
    "/campaigns",
    `/campaigns/${campaignId}`,
    `/campaigns/${campaignId}/analytics`,
    `/campaigns/${campaignId}/daily-leads`,
    "/admin/analytics",
    "/admin/analytics/daily-leads",
    `/share/campaigns/${campaignId}`,
    `/share/leads/${campaignId}`,
  ];
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
