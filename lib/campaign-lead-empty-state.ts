export type CampaignLeadEmptyStateMode = "AUTO" | "WAITING" | "NO_RESULTS";
export type CampaignLeadEmptyState = "WAITING" | "NO_RESULTS" | "FAILED";
export type CampaignLeadSyncStatus = "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export function resolveCampaignLeadEmptyState({
  mode,
  syncStatus,
}: {
  mode: CampaignLeadEmptyStateMode;
  syncStatus: CampaignLeadSyncStatus;
}): CampaignLeadEmptyState {
  if (mode === "WAITING") {
    return "WAITING";
  }

  if (mode === "NO_RESULTS") {
    return "NO_RESULTS";
  }

  if (syncStatus === "QUEUED" || syncStatus === "PROCESSING") {
    return "WAITING";
  }

  if (syncStatus === "COMPLETED") {
    return "NO_RESULTS";
  }

  if (syncStatus === "FAILED") {
    return "FAILED";
  }

  return "WAITING";
}
