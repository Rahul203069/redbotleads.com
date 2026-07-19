import { createHash } from "node:crypto";

export const PUBLIC_SHARE_VISITOR_COOKIE = "redleads_public_visitor";
export const PUBLIC_SHARE_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type PublicShareViewKind = "campaign" | "leads";

export type PublicShareMetric = {
  uniqueVisitors: number;
  views: number;
};

export type PublicShareViewStats = {
  campaign: PublicShareMetric;
  leads: PublicShareMetric;
  overall: PublicShareMetric;
};

export function hashPublicShareVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isPublicShareVisitorToken(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function shouldTrackPublicShareView({
  campaignOwnerId,
  sessionUserId,
}: {
  campaignOwnerId: string;
  sessionUserId: string | null | undefined;
}) {
  return sessionUserId !== campaignOwnerId;
}

export function getPublicShareViewCounters(kind: PublicShareViewKind) {
  return kind === "campaign"
    ? { campaignViews: 1, leadsViews: 0 }
    : { campaignViews: 0, leadsViews: 1 };
}

export function buildPublicShareViewStats({
  campaignUniqueVisitors,
  campaignViews,
  leadsUniqueVisitors,
  leadsViews,
  overallUniqueVisitors,
}: {
  campaignUniqueVisitors: number;
  campaignViews: number;
  leadsUniqueVisitors: number;
  leadsViews: number;
  overallUniqueVisitors: number;
}): PublicShareViewStats {
  return {
    overall: {
      views: campaignViews + leadsViews,
      uniqueVisitors: overallUniqueVisitors,
    },
    campaign: {
      views: campaignViews,
      uniqueVisitors: campaignUniqueVisitors,
    },
    leads: {
      views: leadsViews,
      uniqueVisitors: leadsUniqueVisitors,
    },
  };
}
