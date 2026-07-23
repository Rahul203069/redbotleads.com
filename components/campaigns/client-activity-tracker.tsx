"use client";

import { useEffect, useRef } from "react";

import type { ClientActivityEventType } from "@/lib/client-activity-core";

export function CampaignClientActivityPageView({
  campaignId,
  eventType,
}: {
  campaignId: string;
  eventType: "CAMPAIGN_DASHBOARD_VIEW" | "DAILY_LEADS_VIEW";
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) {
      return;
    }

    sentRef.current = true;
    sendCampaignClientActivity({
      campaignId,
      eventType,
    });
  }, [campaignId, eventType]);

  return null;
}

export function sendCampaignClientActivity({
  campaignId,
  eventType,
  leadId,
}: {
  campaignId: string;
  eventType: ClientActivityEventType;
  leadId?: string;
}) {
  const eventId = createEventId();

  void fetch("/api/client-activity", {
    body: JSON.stringify({
      campaignId,
      eventId,
      eventType,
      ...(leadId ? { leadId } : {}),
    }),
    headers: {
      "content-type": "application/json",
    },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Activity telemetry must never interrupt lead review.
  });
}

function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
