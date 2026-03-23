"use client";

import { useEffect, useState, useTransition } from "react";

import { getCampaignLeads, getCampaignSyncStatuses } from "@/actions/campaigns";
import { ClassifiedLeadsPanel, type ClassifiedLead } from "@/components/campaigns/classified-leads-panel";
import { Card, CardContent } from "@/components/ui/card";

export function CampaignLeadsLiveSection({
  campaignId,
  initialLeads,
  initialSyncStatus,
}: {
  campaignId: string;
  initialLeads: ClassifiedLead[];
  initialSyncStatus: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}) {
  const [isPending, startTransition] = useTransition();
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

  const strongMatches = leads.filter((lead) => lead.ai !== null && lead.label === "HIGH").length;
  const partialMatches = leads.filter((lead) => lead.ai !== null && lead.label !== "HIGH").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr_1fr]">
        <MetricCard label="Strong match" value={String(strongMatches)} />
        <MetricCard label="Partial match" value={String(partialMatches)} />
        <MetricCard label="Lead feed" value={shouldPoll ? (isPending ? "Refreshing" : "Live") : syncStatus.toLowerCase()} />
        <MetricCard label="Poll interval" value={shouldPoll ? "10 sec" : "Stopped"} />
      </div>

      <ClassifiedLeadsPanel isRefreshing={isPending} leads={leads} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">{label}</div>
        <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#F3F5F4]">{value}</div>
      </CardContent>
    </Card>
  );
}
