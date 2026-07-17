export const PLAYGROUND_CANDIDATE_SCOPES = ["CAMPAIGN", "GLOBAL"] as const;

export type PlaygroundCandidateScope = (typeof PLAYGROUND_CANDIDATE_SCOPES)[number];

export function parsePlaygroundCandidateScope(value: unknown): PlaygroundCandidateScope {
  return value === "GLOBAL" ? "GLOBAL" : "CAMPAIGN";
}

export function getPlaygroundCandidateScopeFromSnapshot(snapshot: unknown): PlaygroundCandidateScope {
  if (!isRecord(snapshot)) {
    return "CAMPAIGN";
  }

  return parsePlaygroundCandidateScope(snapshot.candidateScope);
}

export function getPlaygroundFilteringDescriptionFromSnapshot(snapshot: unknown) {
  if (!isRecord(snapshot) || typeof snapshot.filteringDescription !== "string") {
    return null;
  }

  const filteringDescription = snapshot.filteringDescription.trim();
  return filteringDescription.length > 0 ? filteringDescription : null;
}

export function resolvePlaygroundFilteringDescription(
  snapshot: unknown,
  campaignDescription: string | null | undefined,
) {
  return getPlaygroundFilteringDescriptionFromSnapshot(snapshot) ?? campaignDescription ?? null;
}

export function getPlaygroundCandidateScopeLabel(scope: PlaygroundCandidateScope) {
  return scope === "GLOBAL" ? "Global polling pool" : "Campaign subreddits";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
