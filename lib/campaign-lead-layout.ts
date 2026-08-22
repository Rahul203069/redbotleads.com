export const CAMPAIGN_LEAD_LAYOUTS = ["CLASSIC", "INBOX"] as const;

export type CampaignLeadLayout = (typeof CAMPAIGN_LEAD_LAYOUTS)[number];

export const DEFAULT_CAMPAIGN_LEAD_LAYOUT: CampaignLeadLayout = "CLASSIC";

export function normalizeCampaignLeadLayout(value: string | null | undefined): CampaignLeadLayout {
  return value === "INBOX" ? "INBOX" : DEFAULT_CAMPAIGN_LEAD_LAYOUT;
}
