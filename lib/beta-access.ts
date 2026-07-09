export const BETA_OWNER_EMAILS = ["rs3296472t@gmail.com"] as const;
export const ANALYTICS_OWNER_EMAILS = ["rs3296472t@gmail.com"] as const;

const OWNER_EMAILS = new Set<string>(BETA_OWNER_EMAILS);
const ANALYTICS_EMAILS = new Set<string>(ANALYTICS_OWNER_EMAILS);

export const BETA_OWNER_ONLY_MESSAGE =
  "Currently in beta stage. Only the owner can create or run campaigns.";

export function isOwnerEmail(email: string | null | undefined) {
  return OWNER_EMAILS.has(String(email ?? "").trim().toLowerCase());
}

export function canViewAnalytics(email: string | null | undefined) {
  return ANALYTICS_EMAILS.has(String(email ?? "").trim().toLowerCase());
}
