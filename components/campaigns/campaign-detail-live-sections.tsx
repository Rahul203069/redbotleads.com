"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getCampaignInitialRssDiagnostics,
  getCampaignLeads,
  getCampaignSyncStatuses,
  recordCampaignLeadVisit,
  type CampaignInitialRssDiagnostics,
} from "@/actions/campaigns";
import { getCampaignNotificationHealth } from "@/actions/live-mode";
import { ClassifiedLeadsPanel, type ClassifiedLead } from "@/components/campaigns/classified-leads-panel";
import { CampaignHistoricalSummary } from "@/components/campaigns/campaign-historical-summary";
import { CampaignLeadInbox } from "@/components/campaigns/campaign-lead-inbox";
import { useCampaignLeadFilterLoading } from "@/components/campaigns/campaign-lead-filter-loading-provider";
import { CampaignSyncPanel, type CampaignSync } from "@/components/campaigns/campaign-sync-panel";
import { InitialRssDiagnosticsPanel } from "@/components/campaigns/initial-rss-diagnostics-panel";
import { CampaignLiveStatusStrip } from "@/components/live/campaign-live-status-strip";
import type { CampaignLeadEmptyStateMode } from "@/lib/campaign-lead-empty-state";
import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";
import {
  getCampaignLeadRefreshInterval,
  getJustAddedCampaignLeadIds,
  JUST_ADDED_HIGHLIGHT_MS,
  summarizeHistoricalCampaignLeads,
} from "@/lib/campaign-lead-inbox";
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
  previousVisitAt,
  selectedLeadId,
  semanticLastSyncAt,
  semanticNextSyncAt,
  selectedPeriodIsToday,
  showInitialRssDiagnostics = true,
  showJsonExport = true,
  showSemanticSort = true,
  selectedPeriodLabel,
  trackClientActivity = false,
  telegramConnectedAt,
  telegramUsername,
  timeZone,
  visitStartedAt,
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
  previousVisitAt: string | null;
  selectedLeadId?: string | null;
  semanticLastSyncAt: string | null;
  semanticNextSyncAt: string;
  selectedPeriodIsToday: boolean;
  showInitialRssDiagnostics?: boolean;
  showJsonExport?: boolean;
  showSemanticSort?: boolean;
  selectedPeriodLabel: string;
  trackClientActivity?: boolean;
  telegramConnectedAt: string | null;
  telegramUsername: string | null;
  timeZone: string;
  visitStartedAt: string;
  viewMode: CampaignContentMode;
}) {
  const { isLeadFilterLoading } = useCampaignLeadFilterLoading();
  const isLiveToday = viewMode === "LIVE_TODAY";
  const [leads, setLeads] = useState(initialLeads);
  const [sync, setSync] = useState<CampaignSync>(initialSync);
  const [diagnostics, setDiagnostics] = useState<CampaignInitialRssDiagnostics>(initialDiagnostics);
  const [notificationHealth, setNotificationHealth] = useState(initialNotificationHealth);
  const [hasMounted, setHasMounted] = useState(false);
  const [justAddedLeadIds, setJustAddedLeadIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(
    isLiveToday ? visitStartedAt : null,
  );
  const [refreshFailed, setRefreshFailed] = useState(false);
  const knownLeadIdsRef = useRef(new Set(initialLeads.map((lead) => lead.id)));
  const highlightTimeoutsRef = useRef<number[]>([]);
  const recordedVisitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setLeads(initialLeads);
    knownLeadIdsRef.current = new Set(initialLeads.map((lead) => lead.id));
    setJustAddedLeadIds([]);
    setLastRefreshedAt(isLiveToday ? visitStartedAt : null);
    setRefreshFailed(false);
  }, [initialLeads, isLiveToday, visitStartedAt]);

  useEffect(() => {
    setSync(initialSync);
  }, [initialSync]);

  useEffect(() => {
    setDiagnostics(initialDiagnostics);
  }, [initialDiagnostics]);

  useEffect(() => {
    setNotificationHealth(initialNotificationHealth);
  }, [initialNotificationHealth]);

  useEffect(() => {
    const visitKey = `${campaignId}:${visitStartedAt}`;

    if (!isLiveToday || recordedVisitKeyRef.current === visitKey) {
      return;
    }

    recordedVisitKeyRef.current = visitKey;
    void recordCampaignLeadVisit({
      campaignId,
      viewedAt: visitStartedAt,
    });
  }, [campaignId, isLiveToday, visitStartedAt]);

  useEffect(() => () => {
    for (const timeoutId of highlightTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
  }, []);

  const isSyncRunning = sync?.status === "QUEUED" || sync?.status === "PROCESSING";

  useEffect(() => {
    const pollInterval = getCampaignLeadRefreshInterval({
      isLiveToday,
      isSyncRunning,
      selectedPeriodIsToday,
    });

    if (pollInterval === null) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const scheduleNextRefresh = (): void => {
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(refreshLiveFeed, pollInterval);
    };

    const refreshLiveFeed = async (): Promise<void> => {
      if (cancelled) {
        return;
      }

      setIsRefreshing(true);

      try {
        const [latestSync, latestLeads, latestDiagnostics, latestNotificationHealth] = await Promise.all([
          getCampaignSyncStatuses([campaignId]),
          getCampaignLeads(campaignId, leadDateFilter),
          getCampaignInitialRssDiagnostics(campaignId),
          isLiveToday ? getCampaignNotificationHealth(campaignId) : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        const newlyAddedLeadIds = getJustAddedCampaignLeadIds(knownLeadIdsRef.current, latestLeads);

        for (const lead of latestLeads) {
          knownLeadIdsRef.current.add(lead.id);
        }

        if (newlyAddedLeadIds.length > 0) {
          setJustAddedLeadIds((current) => Array.from(new Set([...current, ...newlyAddedLeadIds])));
          const highlightTimeoutId = window.setTimeout(() => {
            setJustAddedLeadIds((current) => current.filter((leadId) => !newlyAddedLeadIds.includes(leadId)));
            highlightTimeoutsRef.current = highlightTimeoutsRef.current.filter((id) => id !== highlightTimeoutId);
          }, JUST_ADDED_HIGHLIGHT_MS);
          highlightTimeoutsRef.current.push(highlightTimeoutId);
        }

        setSync(normalizeSync(latestSync[0]?.sync ?? null));
        setLeads(latestLeads);
        setDiagnostics(latestDiagnostics);
        setLastRefreshedAt(new Date().toISOString());
        setRefreshFailed(false);
        if (latestNotificationHealth) {
          setNotificationHealth(latestNotificationHealth);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Campaign live feed refresh failed", error);
          setRefreshFailed(true);
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
          scheduleNextRefresh();
        }
      }
    };

    setIsRefreshing(false);
    scheduleNextRefresh();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [campaignId, isLiveToday, isSyncRunning, leadDateFilter, selectedPeriodIsToday]);

  const classifiedLeads = useMemo(
    () => leads.filter((lead) => lead.ai !== null && lead.score >= MIN_VISIBLE_LEAD_SCORE),
    [leads],
  );
  const leadCount = classifiedLeads.length;
  const highIntentCount = classifiedLeads.filter((lead) => lead.label === "HIGH").length;
  const historicalSummary = useMemo(
    () => summarizeHistoricalCampaignLeads(classifiedLeads),
    [classifiedLeads],
  );
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
          campaignId={campaignId}
          campaignIsActive={campaignIsActive}
          health={notificationHealth}
          isRefreshing={isRefreshing}
          lastCheckedAt={sync?.completedAt ?? sync?.updatedAt ?? semanticLastSyncAt}
          lastRefreshedAt={lastRefreshedAt}
          refreshFailed={refreshFailed}
          syncStatus={sync?.status ?? "IDLE"}
          telegramConnectedAt={telegramConnectedAt}
          telegramUsername={telegramUsername}
          timeZone={timeZone}
        />
      ) : (
        <>
          {selectedPeriodIsToday ? (
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
          ) : (
            <CampaignHistoricalSummary summary={historicalSummary} />
          )}
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
          previousVisitAt={previousVisitAt}
          selectedLeadId={selectedLeadId}
          selectedPeriodLabel={selectedPeriodLabel}
          strongLeadCount={highIntentCount}
          syncStatus={sync?.status ?? "IDLE"}
          timeZone={timeZone}
          trackClientActivity={trackClientActivity}
          justAddedLeadIds={justAddedLeadIds}
          visitStartedAt={visitStartedAt}
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
