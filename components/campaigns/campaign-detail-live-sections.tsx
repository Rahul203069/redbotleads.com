"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  getCampaignInitialRssDiagnostics,
  getCampaignLeads,
  getCampaignSyncStatuses,
  type CampaignInitialRssDiagnostics,
} from "@/actions/campaigns";
import { getCampaignNotificationHealth } from "@/actions/live-mode";
import { ClassifiedLeadsPanel, type ClassifiedLead } from "@/components/campaigns/classified-leads-panel";
import { CampaignLeadInbox } from "@/components/campaigns/campaign-lead-inbox";
import { useCampaignLeadFilterLoading } from "@/components/campaigns/campaign-lead-filter-loading-provider";
import { CampaignSyncPanel, type CampaignSync } from "@/components/campaigns/campaign-sync-panel";
import { InitialRssDiagnosticsPanel } from "@/components/campaigns/initial-rss-diagnostics-panel";
import { CampaignLiveStatusStrip } from "@/components/live/campaign-live-status-strip";
import type { CampaignLeadEmptyStateMode } from "@/lib/campaign-lead-empty-state";
import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";
import type { LiveNotificationHealth } from "@/lib/live-leads";

export type CampaignContentMode = "DAILY_HISTORY" | "LIVE_TODAY";

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
  campaignIsActive,
  canDeleteLeads = false,
  initialDiagnostics,
  initialLeads,
  initialNotificationHealth,
  initialSync,
  leadEmptyStateMode,
  leadDateFilter,
  nextSyncLabel,
  selectedLeadId,
  semanticLastSyncAt,
  semanticNextSyncAt,
  showInitialRssDiagnostics = true,
  showJsonExport = true,
  showSemanticSort = true,
  selectedPeriodLabel,
  trackClientActivity = false,
  telegramConnectedAt,
  telegramUsername,
  timeZone,
  todayDateKey,
  viewMode,
}: {
  campaignId: string;
  campaignIsActive: boolean;
  canDeleteLeads?: boolean;
  initialDiagnostics: CampaignInitialRssDiagnostics;
  initialLeads: ClassifiedLead[];
  initialNotificationHealth: LiveNotificationHealth | null;
  initialSync: CampaignSync;
  leadEmptyStateMode: CampaignLeadEmptyStateMode;
  leadDateFilter: {
    date?: string[];
    from?: string;
    range?: string;
    to?: string;
  };
  nextSyncLabel: string;
  selectedLeadId?: string | null;
  semanticLastSyncAt: string | null;
  semanticNextSyncAt: string;
  showInitialRssDiagnostics?: boolean;
  showJsonExport?: boolean;
  showSemanticSort?: boolean;
  selectedPeriodLabel: string;
  trackClientActivity?: boolean;
  telegramConnectedAt: string | null;
  telegramUsername: string | null;
  timeZone: string;
  todayDateKey: string;
  viewMode: CampaignContentMode;
}) {
  const [, startTransition] = useTransition();
  const { isLeadFilterLoading } = useCampaignLeadFilterLoading();
  const [leads, setLeads] = useState(initialLeads);
  const [sync, setSync] = useState<CampaignSync>(initialSync);
  const [diagnostics, setDiagnostics] = useState<CampaignInitialRssDiagnostics>(initialDiagnostics);
  const [notificationHealth, setNotificationHealth] = useState(initialNotificationHealth);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    setSync(initialSync);
  }, [initialSync]);

  useEffect(() => {
    setDiagnostics(initialDiagnostics);
  }, [initialDiagnostics]);

  useEffect(() => {
    setNotificationHealth(initialNotificationHealth);
  }, [initialNotificationHealth]);

  const isSyncRunning = sync?.status === "QUEUED" || sync?.status === "PROCESSING";
  const isLiveToday = viewMode === "LIVE_TODAY";

  useEffect(() => {
    const pollInterval = isSyncRunning ? 10_000 : isLiveToday ? 30_000 : null;

    if (pollInterval === null) {
      return;
    }

    let isPolling = false;

    const poll = () => {
      if (isPolling) {
        return;
      }

      isPolling = true;
      startTransition(async () => {
        try {
          const [latestSync, latestLeads, latestDiagnostics, latestNotificationHealth] = await Promise.all([
            getCampaignSyncStatuses([campaignId]),
            getCampaignLeads(campaignId, leadDateFilter),
            getCampaignInitialRssDiagnostics(campaignId),
            isLiveToday ? getCampaignNotificationHealth(campaignId) : Promise.resolve(null),
          ]);

          setSync(normalizeSync(latestSync[0]?.sync ?? null));
          setLeads(latestLeads);
          setDiagnostics(latestDiagnostics);
          if (latestNotificationHealth) {
            setNotificationHealth(latestNotificationHealth);
          }
        } finally {
          isPolling = false;
        }
      });
    };

    const intervalId = window.setInterval(poll, pollInterval);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [campaignId, isLiveToday, isSyncRunning, leadDateFilter]);

  const classifiedLeads = useMemo(
    () => leads.filter((lead) => lead.ai !== null && lead.score >= MIN_VISIBLE_LEAD_SCORE),
    [leads],
  );
  const leadCount = classifiedLeads.length;
  const highIntentCount = classifiedLeads.filter((lead) => lead.label === "HIGH").length;
  const lastSync = hasMounted
    ? semanticLastSyncAt
      ? formatLocalDateTime(semanticLastSyncAt)
      : "Not run yet"
    : semanticLastSyncAt
      ? "Loading..."
      : "Not run yet";
  const nextSync = hasMounted ? formatLocalDateTime(semanticNextSyncAt) : "Loading...";

  return (
    <>
      {isLiveToday ? (
        <CampaignLiveStatusStrip
          campaignIsActive={campaignIsActive}
          health={notificationHealth}
          lastCheckedAt={sync?.completedAt ?? sync?.updatedAt ?? semanticLastSyncAt}
          syncStatus={sync?.status ?? "IDLE"}
          telegramConnectedAt={telegramConnectedAt}
          telegramUsername={telegramUsername}
          timeZone={timeZone}
        />
      ) : (
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
          {showInitialRssDiagnostics ? <InitialRssDiagnosticsPanel diagnostics={diagnostics} /> : null}
        </>
      )}
      {isLiveToday ? (
        <CampaignLeadInbox
          campaignId={campaignId}
          canDeleteLeads={canDeleteLeads}
          emptyStateMode={leadEmptyStateMode}
          isFilterLoading={isLeadFilterLoading}
          leads={classifiedLeads}
          nextSyncLabel={nextSync}
          selectedLeadId={selectedLeadId}
          selectedPeriodLabel={selectedPeriodLabel}
          syncStatus={sync?.status ?? "IDLE"}
          timeZone={timeZone}
          todayDateKey={todayDateKey}
          trackClientActivity={trackClientActivity}
          onLeadDeleted={(leadId) => {
            setLeads((current) => current.filter((lead) => lead.id !== leadId));
          }}
          onLeadStatusChanged={(leadId, status: CampaignLeadStatus) => {
            setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, status } : lead));
          }}
        />
      ) : (
        <ClassifiedLeadsPanel
          campaignId={campaignId}
          canDeleteLeads={canDeleteLeads}
          emptyStateMode={leadEmptyStateMode}
          isFilterLoading={isLeadFilterLoading}
          leadDateFilter={leadDateFilter}
          leads={classifiedLeads}
          nextSyncLabel={nextSync}
          showJsonExport={showJsonExport}
          showSemanticSort={showSemanticSort}
          showStatusFilter={false}
          selectedLeadId={selectedLeadId}
          selectedPeriodLabel={selectedPeriodLabel}
          syncStatus={sync?.status ?? "IDLE"}
          trackClientActivity={trackClientActivity}
          onLeadDeleted={(leadId) => {
            setLeads((current) => current.filter((lead) => lead.id !== leadId));
          }}
        />
      )}
    </>
  );
}

function formatLocalDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
