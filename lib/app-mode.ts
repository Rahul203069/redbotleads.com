export const SAAS_APP_MODES = ["DAILY", "LIVE"] as const;

export type SaasAppMode = (typeof SAAS_APP_MODES)[number];

export const DEFAULT_SAAS_APP_MODE: SaasAppMode = "DAILY";

export function normalizeSaasAppMode(
  value: string | null | undefined,
  legacyLayout?: string | null,
): SaasAppMode {
  if (value === "LIVE") return "LIVE";
  if (value === "DAILY") return "DAILY";
  return legacyLayout === "INBOX" ? "LIVE" : DEFAULT_SAAS_APP_MODE;
}
