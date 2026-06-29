"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  getCampaignInitialRssDiagnostics,
  getCampaignLeads,
  getCampaignSyncStatuses,
  type CampaignInitialRssDiagnostics,
} from "@/actions/campaigns";
import { ClassifiedLeadsPanel, type ClassifiedLead } from "@/components/campaigns/classified-leads-panel";
import { CampaignSyncPanel, type CampaignSync } from "@/components/campaigns/campaign-sync-panel";
import { InitialRssDiagnosticsPanel } from "@/components/campaigns/initial-rss-diagnostics-panel";

const MIN_VISIBLE_LEAD_SCORE = 40;

function isStatsJson(
  value: unknown,
): value is NonNullable<NonNullable<CampaignSync>["statsJson"]> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSync(sync: unknown): CampaignSync {
  if (!sync || typeof sync !== "object") {
    return null;
  }

  const value = sync as Record<string, unknown>;

  return {
    status: value.status as NonNullable<CampaignSync>["status"],
    stage: value.stage as NonNullable<CampaignSync>["stage"],
    message: typeof value.message === "string" ? value.message : null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
    queuedAt: typeof value.queuedAt === "string" ? value.queuedAt : null,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
    failedAt: typeof value.failedAt === "string" ? value.failedAt : null,
    lastHeartbeat: typeof value.lastHeartbeat === "string" ? value.lastHeartbeat : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    statsJson: isStatsJson(value.statsJson) ? value.statsJson : null,
  };
}

export function CampaignDetailLiveSections({
  campaignId,
  initialDiagnostics,
  initialLeads,
  initialSync,
  leadDateFilter,
  nextSyncLabel,
}: {
  campaignId: string;
  initialDiagnostics: CampaignInitialRssDiagnostics;
  initialLeads: ClassifiedLead[];
  initialSync: CampaignSync;
  leadDateFilter: {
    from?: string;
    range?: string;
    to?: string;
  };
  nextSyncLabel: string;
}) {
  const [, startTransition] = useTransition();
  const [leads, setLeads] = useState(initialLeads);
  const [sync, setSync] = useState<CampaignSync>(initialSync);
  const [diagnostics, setDiagnostics] = useState<CampaignInitialRssDiagnostics>(initialDiagnostics);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    setSync(initialSync);
  }, [initialSync]);

  useEffect(() => {
    setDiagnostics(initialDiagnostics);
  }, [initialDiagnostics]);

  const isLive = sync?.status === "QUEUED" || sync?.status === "PROCESSING";

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const poll = () => {
      startTransition(async () => {
        const [latestSync, latestLeads, latestDiagnostics] = await Promise.all([
          getCampaignSyncStatuses([campaignId]),
          getCampaignLeads(campaignId, leadDateFilter),
          getCampaignInitialRssDiagnostics(campaignId),
        ]);

        setSync(normalizeSync(latestSync[0]?.sync ?? null));
        setLeads(latestLeads);
        setDiagnostics(latestDiagnostics);
      });
    };

    const intervalId = window.setInterval(poll, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [campaignId, isLive, leadDateFilter]);

  const classifiedLeads = useMemo(
    () => leads.filter((lead) => lead.ai !== null && lead.score >= MIN_VISIBLE_LEAD_SCORE),
    [leads],
  );
  const leadCount = classifiedLeads.length;
  const highIntentCount = classifiedLeads.filter((lead) => lead.label === "HIGH").length;
  const lastSyncSource = sync?.completedAt ?? sync?.failedAt ?? sync?.lastHeartbeat ?? sync?.updatedAt ?? null;

  const lastSync = lastSyncSource
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(lastSyncSource))
    : "Not run yet";

  const nextSync = lastSyncSource
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(new Date(lastSyncSource).getTime() + 24 * 60 * 60 * 1000))
    : nextSyncLabel;

  return (
    <>
      <CampaignSyncPanel
        nextSyncLabel={nextSyncLabel}
        summaryMetrics={{
          lastSync,
          nextSync,
          leadCount,
          highIntentCount,
        }}
        sync={sync}
      />
      <InitialRssDiagnosticsPanel diagnostics={diagnostics} />
      <ClassifiedLeadsPanel leads={classifiedLeads} syncStatus={sync?.status ?? "IDLE"} />
    </>
  );
}
