import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";

export type CampaignLeadStatusCounts = Record<CampaignLeadStatus, number> & {
  ALL: number;
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

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
