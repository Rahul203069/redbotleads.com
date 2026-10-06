const CLIENT_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function isCampaignClientTrialExpired(createdAt: Date, now: Date = new Date()) {
  return now.getTime() >= createdAt.getTime() + CLIENT_TRIAL_DURATION_MS;
}
