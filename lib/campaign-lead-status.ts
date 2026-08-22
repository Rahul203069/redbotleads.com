export const CAMPAIGN_LEAD_STATUSES = [
  "NEW",
  "REVIEWED",
  "SAVED",
  "CONTACTED",
  "DISMISSED",
] as const;

export type CampaignLeadStatus = (typeof CAMPAIGN_LEAD_STATUSES)[number];

export const CAMPAIGN_LEAD_STATUS_LABELS: Record<CampaignLeadStatus, string> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  SAVED: "Saved",
  CONTACTED: "Contacted",
  DISMISSED: "Dismissed",
};

export function isCampaignLeadStatus(value: string): value is CampaignLeadStatus {
  return CAMPAIGN_LEAD_STATUSES.includes(value as CampaignLeadStatus);
}
