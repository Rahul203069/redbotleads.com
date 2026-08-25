export function buildScheduledSemanticJobId(campaignId: string, scheduleBucket: string) {
  return ["daily-semantic", campaignId, scheduleBucket]
    .map((part) => part.replace(/[:\s]+/g, "-"))
    .join("--");
}
