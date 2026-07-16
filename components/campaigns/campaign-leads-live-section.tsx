"use client";

import { useEffect, useState, useTransition } from "react";

import { getCampaignLeads, getCampaignSyncStatuses } from "@/actions/campaigns";
import { ClassifiedLeadsPanel, type ClassifiedLead } from "@/components/campaigns/classified-leads-panel";

export function CampaignLeadsLiveSection({
  campaignId,
  initialLeads,
  initialSyncStatus,
}: {
  campaignId: string;
  initialLeads: ClassifiedLead[];
  initialSyncStatus: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}) {
  const [, startTransition] = useTransition();
  const [leads, setLeads] = useState(initialLeads);
  const [syncStatus, setSyncStatus] = useState(initialSyncStatus);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    setSyncStatus(initialSyncStatus);
  }, [initialSyncStatus]);

  const shouldPoll = syncStatus === "QUEUED" || syncStatus === "PROCESSING";

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const poll = () => {
      startTransition(async () => {
        const [latestLeads, latestSync] = await Promise.all([
          getCampaignLeads(campaignId),
          getCampaignSyncStatuses([campaignId]),
        ]);

        setLeads(latestLeads);
        setSyncStatus(latestSync[0]?.sync?.status ?? "IDLE");
      });
    };

    poll();
    const intervalId = window.setInterval(poll, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [campaignId, shouldPoll]);

  return <ClassifiedLeadsPanel campaignId={campaignId} leads={leads} syncStatus={syncStatus} />;
}
