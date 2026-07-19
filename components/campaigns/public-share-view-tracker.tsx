"use client";

import { useEffect, useRef } from "react";

export function PublicShareViewTracker({
  campaignId,
  kind,
}: {
  campaignId: string;
  kind: "campaign" | "leads";
}) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) {
      return;
    }

    hasTracked.current = true;

    void fetch("/api/public-share-views", {
      body: JSON.stringify({ campaignId, kind }),
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);
  }, [campaignId, kind]);

  return null;
}
