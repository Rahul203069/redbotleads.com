export const OUTREACH_MIN_SCORE = 75;
export const OUTREACH_COMMENT_LIMIT = 100;
export const OUTREACH_MESSAGE_LIMIT = 500;
export const OUTREACH_ROLLING_LIMIT = 25;
export const OUTREACH_FOLLOW_UP_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export type OutreachEligibility =
  | { eligible: true; stage: "INITIAL" | "FOLLOW_UP" }
  | { eligible: false; reason: "INVALID_USERNAME" | "DO_NOT_CONTACT" | "COOLDOWN" | "COMPLETED" };

export function normalizeRedditUsername(value: string) {
  return value.trim().replace(/^u\//i, "").replace(/^@/, "").toLowerCase();
}

export function isValidRedditUsername(value: string) {
  return /^[a-z0-9_-]{3,20}$/i.test(normalizeRedditUsername(value));
}

export function resolveOutreachEligibility(
  contact: {
    doNotContact?: boolean;
    firstSentAt?: Date | string | null;
    followUpSentAt?: Date | string | null;
    lastSentAt?: Date | string | null;
  } | null,
  now = new Date(),
): OutreachEligibility {
  if (contact?.doNotContact) return { eligible: false, reason: "DO_NOT_CONTACT" };
  if (!contact?.firstSentAt) return { eligible: true, stage: "INITIAL" };
  if (contact.followUpSentAt) return { eligible: false, reason: "COMPLETED" };

  const lastSentAt = contact.lastSentAt ? new Date(contact.lastSentAt) : new Date(contact.firstSentAt);
  if (now.getTime() - lastSentAt.getTime() < OUTREACH_FOLLOW_UP_DELAY_MS) {
    return { eligible: false, reason: "COOLDOWN" };
  }

  return { eligible: true, stage: "FOLLOW_UP" };
}

export function validateOutreachMessage(message: string, publicLeadsUrl: string) {
  const normalized = message.trim();
  if (!normalized) return "Message is empty.";
  if (normalized.length > OUTREACH_MESSAGE_LIMIT) {
    return `Message must be ${OUTREACH_MESSAGE_LIMIT} characters or fewer.`;
  }

  const occurrences = normalized.split(publicLeadsUrl).length - 1;
  if (occurrences !== 1) return "Message must contain the public leads link exactly once.";
  return null;
}

export function getRollingWindowStart(now = new Date()) {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

