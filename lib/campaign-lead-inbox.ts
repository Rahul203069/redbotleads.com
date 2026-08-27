import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";

export type CampaignLeadStatusCounts = Record<CampaignLeadStatus, number> & {
  ALL: number;
};

export const JUST_ADDED_HIGHLIGHT_MS = 15_000;

export type CampaignLeadFreshnessGroups<T> = {
  newLeads: T[];
  earlierLeads: T[];
  demoLeads: T[];
};

export type CampaignLeadDetectionBatch<T> = {
  detectedAt: string | null;
  id: string;
  leads: T[];
};

export function countCampaignLeadStatuses(
  leads: Array<{ status: CampaignLeadStatus }>,
): CampaignLeadStatusCounts {
  const counts: CampaignLeadStatusCounts = {
    ALL: leads.length,
    NEW: 0,
    REVIEWED: 0,
    SAVED: 0,
    CONTACTED: 0,
    DISMISSED: 0,
  };

  for (const lead of leads) {
    counts[lead.status] += 1;
  }

  return counts;
}

export function getCampaignLeadDateKey(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "unknown";
}

export function getCampaignLeadGroupLabel({
  dateKey,
  timeZone,
  todayDateKey,
}: {
  dateKey: string;
  timeZone: string;
  todayDateKey: string;
}) {
  if (dateKey === todayDateKey) {
    return "Today";
  }

  if (dateKey === shiftDateKey(todayDateKey, -1)) {
    return "Yesterday";
  }

  const safeDate = new Date(`${dateKey}T12:00:00.000Z`);

  if (Number.isNaN(safeDate.getTime())) {
    return "Earlier";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone,
    year: dateKey.slice(0, 4) === todayDateKey.slice(0, 4) ? undefined : "numeric",
  }).format(safeDate);
}

export function isCampaignLeadNewSinceVisit({
  createdAt,
  isDemo = false,
  previousVisitAt,
}: {
  createdAt: string;
  isDemo?: boolean;
  previousVisitAt: string | null;
}) {
  if (isDemo) {
    return false;
  }

  const createdAtMs = new Date(createdAt).getTime();

  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  if (!previousVisitAt) {
    return true;
  }

  const previousVisitAtMs = new Date(previousVisitAt).getTime();
  return !Number.isNaN(previousVisitAtMs) && createdAtMs > previousVisitAtMs;
}

export function groupCampaignLeadsByFreshness<
  T extends { createdAt: string; isDemo?: boolean },
>(
  leads: T[],
  previousVisitAt: string | null,
  options: { treatDemoAsReal?: boolean } = {},
): CampaignLeadFreshnessGroups<T> {
  const groups: CampaignLeadFreshnessGroups<T> = {
    newLeads: [],
    earlierLeads: [],
    demoLeads: [],
  };

  for (const lead of leads) {
    if (lead.isDemo && !options.treatDemoAsReal) {
      groups.demoLeads.push(lead);
      continue;
    }

    if (isCampaignLeadNewSinceVisit({
      createdAt: lead.createdAt,
      isDemo: options.treatDemoAsReal ? false : lead.isDemo,
      previousVisitAt,
    })) {
      groups.newLeads.push(lead);
    } else {
      groups.earlierLeads.push(lead);
    }
  }

  return groups;
}

export function groupCampaignLeadsByDetectionMinute<
  T extends { createdAt: string },
>(leads: T[]): CampaignLeadDetectionBatch<T>[] {
  const batches = new Map<string, CampaignLeadDetectionBatch<T>>();
  const orderedLeads = [...leads].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  });

  for (const lead of orderedLeads) {
    const detectedAtMs = new Date(lead.createdAt).getTime();
    const minuteStartMs = Number.isNaN(detectedAtMs)
      ? null
      : Math.floor(detectedAtMs / 60_000) * 60_000;
    const id = minuteStartMs === null ? "unknown" : new Date(minuteStartMs).toISOString();
    const existingBatch = batches.get(id);

    if (existingBatch) {
      existingBatch.leads.push(lead);
      continue;
    }

    batches.set(id, {
      detectedAt: minuteStartMs === null ? null : lead.createdAt,
      id,
      leads: [lead],
    });
  }

  return Array.from(batches.values());
}

export function getJustAddedCampaignLeadIds(
  knownLeadIds: ReadonlySet<string>,
  incomingLeads: Array<{ id: string; isDemo?: boolean }>,
) {
  return incomingLeads
    .filter((lead) => !lead.isDemo && !knownLeadIds.has(lead.id))
    .map((lead) => lead.id);
}

export function formatLeadRelativeTime(value: string, nowMs: number) {
  const valueMs = new Date(value).getTime();

  if (Number.isNaN(valueMs)) {
    return "unknown";
  }

  const minutes = Math.floor(Math.max(0, nowMs - valueMs) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
