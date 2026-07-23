"use client";

import { sendCampaignClientActivity } from "@/components/campaigns/client-activity-tracker";

export function TrackedRedditLeadLink({
  campaignId,
  className,
  leadId,
  trackActivity,
  url,
}: {
  campaignId: string;
  className: string;
  leadId: string | null;
  trackActivity: boolean;
  url: string;
}) {
  return (
    <a
      className={className}
      href={url}
      onClick={() => {
        if (trackActivity && leadId) {
          sendCampaignClientActivity({
            campaignId,
            eventType: "REDDIT_LINK_CLICKED",
            leadId,
          });
        }
      }}
      rel="noreferrer"
      target="_blank"
    >
      View on Reddit
    </a>
  );
}
