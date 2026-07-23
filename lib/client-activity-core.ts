export const CLIENT_ACTIVITY_EVENT_TYPES = [
  "CAMPAIGN_DASHBOARD_VIEW",
  "DAILY_LEADS_VIEW",
  "LEAD_EXPANDED",
  "REDDIT_LINK_CLICKED",
] as const;

export const CLIENT_ACTIVITY_PAGE_VIEW_TYPES = [
  "CAMPAIGN_DASHBOARD_VIEW",
  "DAILY_LEADS_VIEW",
] as const;

export const CLIENT_ACTIVITY_LEAD_REVIEW_TYPES = [
  "LEAD_EXPANDED",
  "REDDIT_LINK_CLICKED",
] as const;

export const CLIENT_ACTIVITY_RANGE_OPTIONS = ["7", "30", "90", "all", "custom"] as const;
export const CLIENT_ACTIVITY_STATUS_OPTIONS = ["ALL", "ACTIVE", "QUIET", "INACTIVE", "NEVER_ACTIVE"] as const;
export const CLIENT_ACTIVITY_PAGE_VIEW_COALESCE_MS = 5 * 60 * 1000;

export type ClientActivityEventType = (typeof CLIENT_ACTIVITY_EVENT_TYPES)[number];
export type ClientActivityRangeOption = (typeof CLIENT_ACTIVITY_RANGE_OPTIONS)[number];
export type ClientActivityStatus = Exclude<(typeof CLIENT_ACTIVITY_STATUS_OPTIONS)[number], "ALL">;
export type ClientActivityStatusFilter = (typeof CLIENT_ACTIVITY_STATUS_OPTIONS)[number];

export type ClientActivityRange = {
  from: Date;
  key: ClientActivityRangeOption;
  label: string;
  to: Date;
};

export type ClientActivitySummaryEvent = {
  createdAt: Date;
  eventType: ClientActivityEventType;
  leadId: string | null;
};

export function isClientActivityEventType(value: unknown): value is ClientActivityEventType {
  return CLIENT_ACTIVITY_EVENT_TYPES.includes(value as ClientActivityEventType);
}

export function isClientActivityPageView(value: ClientActivityEventType) {
  return CLIENT_ACTIVITY_PAGE_VIEW_TYPES.includes(value as (typeof CLIENT_ACTIVITY_PAGE_VIEW_TYPES)[number]);
}

export function isClientActivityLeadReview(value: ClientActivityEventType) {
  return CLIENT_ACTIVITY_LEAD_REVIEW_TYPES.includes(value as (typeof CLIENT_ACTIVITY_LEAD_REVIEW_TYPES)[number]);
}

export function getClientActivityEligibility({
  hasAssignment,
  isAdmin,
}: {
  hasAssignment: boolean;
  isAdmin: boolean;
}) {
  if (isAdmin) {
    return "ADMIN_EXCLUDED" as const;
  }

  if (!hasAssignment) {
    return "NOT_ASSIGNED" as const;
  }

  return null;
}

export function isClientActivityEventShapeValid({
  eventType,
  leadId,
}: {
  eventType: ClientActivityEventType;
  leadId?: string;
}) {
  return isClientActivityLeadReview(eventType) ? Boolean(leadId) : !leadId;
}

export function shouldCoalesceClientPageView({
  eventType,
  lastRecordedAt,
  now,
}: {
  eventType: ClientActivityEventType;
  lastRecordedAt: Date | null;
  now: Date;
}) {
  return isClientActivityPageView(eventType)
    && Boolean(lastRecordedAt)
    && now.getTime() - (lastRecordedAt?.getTime() ?? 0) < CLIENT_ACTIVITY_PAGE_VIEW_COALESCE_MS;
}

export function parseClientActivityStatus(value: string | undefined): ClientActivityStatusFilter {
  const normalized = String(value ?? "ALL").trim().toUpperCase();

  return CLIENT_ACTIVITY_STATUS_OPTIONS.includes(normalized as ClientActivityStatusFilter)
    ? normalized as ClientActivityStatusFilter
    : "ALL";
}

export function getClientActivityRange(
  input: {
    from?: string;
    range?: string;
    to?: string;
  },
  now = new Date(),
): ClientActivityRange {
  const requestedRange = String(input.range ?? "30").trim().toLowerCase();

  if (requestedRange === "all") {
    return {
      from: new Date(0),
      key: "all",
      label: "All recorded activity",
      to: new Date(now.getTime() + 60 * 1000),
    };
  }

  if (requestedRange === "custom") {
    const from = parseDateKey(input.from);
    const inclusiveTo = parseDateKey(input.to);

    if (from && inclusiveTo && from <= inclusiveTo) {
      return {
        from,
        key: "custom",
        label: `${formatRangeDate(from)} – ${formatRangeDate(inclusiveTo)}`,
        to: new Date(inclusiveTo.getTime() + 24 * 60 * 60 * 1000),
      };
    }
  }

  const days = requestedRange === "7" || requestedRange === "90" ? Number(requestedRange) : 30;
  const key = String(days) as "7" | "30" | "90";

  return {
    from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    key,
    label: `Last ${days} days`,
    to: new Date(now.getTime() + 60 * 1000),
  };
}

export function getClientEngagementStatus(
  lastActivityAt: Date | null,
  now = new Date(),
): ClientActivityStatus {
  if (!lastActivityAt) {
    return "NEVER_ACTIVE";
  }

  const ageDays = Math.max(0, (now.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000));

  if (ageDays <= 7) {
    return "ACTIVE";
  }

  if (ageDays <= 30) {
    return "QUIET";
  }

  return "INACTIVE";
}

export function summarizeClientActivity(events: ClientActivitySummaryEvent[]) {
  const activeDays = new Set<string>();
  const reviewedLeadIds = new Set<string>();
  let campaignDashboardViews = 0;
  let dailyLeadsViews = 0;
  let leadExpansions = 0;
  let redditClicks = 0;

  for (const event of events) {
    activeDays.add(event.createdAt.toISOString().slice(0, 10));

    if (event.eventType === "CAMPAIGN_DASHBOARD_VIEW") {
      campaignDashboardViews += 1;
    } else if (event.eventType === "DAILY_LEADS_VIEW") {
      dailyLeadsViews += 1;
    } else if (event.eventType === "LEAD_EXPANDED") {
      leadExpansions += 1;
    } else if (event.eventType === "REDDIT_LINK_CLICKED") {
      redditClicks += 1;
    }

    if (event.leadId && isClientActivityLeadReview(event.eventType)) {
      reviewedLeadIds.add(event.leadId);
    }
  }

  return {
    activeDays: activeDays.size,
    campaignDashboardViews,
    dailyLeadsViews,
    dashboardVisits: campaignDashboardViews + dailyLeadsViews,
    leadExpansions,
    redditClicks,
    reviewedLeadIds,
    uniqueLeadsReviewed: reviewedLeadIds.size,
  };
}

export function getClientActivityEventLabel(eventType: ClientActivityEventType) {
  if (eventType === "CAMPAIGN_DASHBOARD_VIEW") {
    return "Opened campaign dashboard";
  }

  if (eventType === "DAILY_LEADS_VIEW") {
    return "Opened daily leads";
  }

  if (eventType === "LEAD_EXPANDED") {
    return "Expanded a lead";
  }

  return "Opened lead on Reddit";
}

function parseDateKey(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRangeDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(value);
}
