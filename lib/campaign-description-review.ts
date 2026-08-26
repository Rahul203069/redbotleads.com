export function formatCampaignDescriptionReviewMessage({
  campaignName,
  userEmail,
}: {
  campaignName: string;
  userEmail: string | null | undefined;
}) {
  const normalizedEmail = String(userEmail ?? "").trim() || "Email unavailable";

  return [
    "Campaign description review needed",
    "",
    `User: ${normalizedEmail}`,
    `Campaign: ${campaignName}`,
    "",
    "The user changed the campaign description. Please review it and manually update the semantic queries and related backend targeting.",
  ].join("\n");
}
