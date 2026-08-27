"use client";

import {
  AlertCircle,
  ArrowDown,
  Clock3,
  LoaderCircle,
  Radio,
  SearchX,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  markCampaignLeadReviewed,
} from "@/actions/campaigns";
import { sendCampaignClientActivity } from "@/components/campaigns/client-activity-tracker";
import { DeleteCampaignLeadDialog } from "@/components/campaigns/delete-campaign-lead-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  formatLeadRelativeTime,
  formatStrongMatchCount,
  groupCampaignLeadsByDetectionMinute,
  groupCampaignLeadsByFreshness,
} from "@/lib/campaign-lead-inbox";
import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";
import type {
  CampaignLeadEmptyStateMode,
  CampaignLeadSyncStatus,
} from "@/lib/campaign-lead-empty-state";
import { resolveCampaignLeadEmptyState } from "@/lib/campaign-lead-empty-state";
import type { CampaignLeadView } from "@/lib/campaign-leads";
import {
  formatClockTimeInTimeZone,
  formatExactDateTimeInTimeZone,
} from "@/lib/time-zone";

const COLLAPSED_SOURCE_TEXT_LENGTH = 280;

export function CampaignLeadInbox({
  campaignId,
  canDeleteLeads = false,
  emptyStateMode,
  isFilterLoading,
  justAddedLeadIds = [],
  leads,
  nextSyncLabel,
  onLeadDeleted,
  onLeadStatusChanged,
  previousVisitAt,
  selectedLeadId,
  selectedPeriodLabel,
  strongLeadCount,
  syncStatus,
  timeZone,
  trackClientActivity = false,
  visitStartedAt,
}: {
  campaignId: string;
  canDeleteLeads?: boolean;
  emptyStateMode: CampaignLeadEmptyStateMode;
  isFilterLoading: boolean;
  justAddedLeadIds?: string[];
  leads: CampaignLeadView[];
  nextSyncLabel: string;
  onLeadDeleted?: (leadId: string) => void;
  onLeadStatusChanged: (leadId: string, status: CampaignLeadStatus) => void;
  previousVisitAt: string | null;
  selectedLeadId?: string | null;
  selectedPeriodLabel: string;
  strongLeadCount: number;
  syncStatus: CampaignLeadSyncStatus;
  timeZone: string;
  trackClientActivity?: boolean;
  visitStartedAt: string;
}) {
  const { toast } = useToast();
  const [now, setNow] = useState<number | null>(null);
  const [pendingLeadIds, setPendingLeadIds] = useState<string[]>([]);
  const [expandedLeadIds, setExpandedLeadIds] = useState<string[]>([]);

  useEffect(() => {
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const orderedLeads = useMemo(
    () => [...leads].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [leads],
  );
  const nowMs = now ?? new Date(visitStartedAt).getTime();
  const justAddedLeadIdSet = useMemo(() => new Set(justAddedLeadIds), [justAddedLeadIds]);
  const freshnessGroups = useMemo(
    () => groupCampaignLeadsByFreshness(orderedLeads, previousVisitAt, {
      treatDemoAsReal: true,
    }),
    [orderedLeads, previousVisitAt],
  );
  const newSinceVisitLeadIdSet = useMemo(
    () => new Set(freshnessGroups.newLeads.map((lead) => lead.id)),
    [freshnessGroups.newLeads],
  );
  const newSinceVisitCount = newSinceVisitLeadIdSet.size;
  const leadCount = freshnessGroups.newLeads.length + freshnessGroups.earlierLeads.length;
  const earlierDetectionBatches = useMemo(
    () => groupCampaignLeadsByDetectionMinute(freshnessGroups.earlierLeads),
    [freshnessGroups.earlierLeads],
  );
  const feedSections = useMemo<Array<{
    detectedAt: string | null;
    id: string;
    kind: "earlier" | "new";
    label: string;
    leads: CampaignLeadView[];
  }>>(() => [
    ...(freshnessGroups.newLeads.length > 0 ? [{
      detectedAt: null,
      id: "new",
      kind: "new" as const,
      label: previousVisitAt ? "New since your last visit" : "New posts",
      leads: freshnessGroups.newLeads,
    }] : []),
    ...earlierDetectionBatches.map((batch) => ({
      detectedAt: batch.detectedAt,
      id: `earlier-${batch.id}`,
      kind: "earlier" as const,
      label: batch.detectedAt ? "Found at" : "Earlier posts",
      leads: batch.leads,
    })),
  ], [earlierDetectionBatches, freshnessGroups.newLeads, previousVisitAt]);
  const visibleJustAddedLeadIds = orderedLeads
    .filter((lead) => justAddedLeadIdSet.has(lead.id))
    .map((lead) => lead.id);
  const firstJustAddedLeadId = visibleJustAddedLeadIds[0] ?? null;
  const resolvedEmptyState = resolveCampaignLeadEmptyState({
    mode: emptyStateMode,
    syncStatus,
  });
  const isProcessing = syncStatus === "QUEUED" || syncStatus === "PROCESSING";
  const shouldShowWaitingState = emptyStateMode === "WAITING"
    || (emptyStateMode === "AUTO" && (isProcessing || (leads.length === 0 && resolvedEmptyState === "WAITING")));
  const freshnessSummary = previousVisitAt
    ? newSinceVisitCount > 0
      ? `${newSinceVisitCount} new since your last visit.`
      : "No new leads since your last visit."
    : newSinceVisitCount > 0
      ? `${newSinceVisitCount} new lead${newSinceVisitCount === 1 ? " is" : "s are"} waiting for you.`
      : "Your live feed is ready.";
  const lastVisitSummary = previousVisitAt
    ? `Last checked ${formatLeadRelativeTime(previousVisitAt, nowMs)}`
    : "This is your first live visit";

  function scrollToNewPosts() {
    if (!firstJustAddedLeadId) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`lead-${firstJustAddedLeadId}`)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  async function markReviewed(lead: CampaignLeadView) {
    if (lead.status !== "NEW" || pendingLeadIds.includes(lead.id)) {
      return;
    }

    if (lead.isDemo) {
      onLeadStatusChanged(lead.id, "REVIEWED");
      return;
    }

    const previousStatus = lead.status;
    setPendingLeadIds((current) => [...current, lead.id]);
    onLeadStatusChanged(lead.id, "REVIEWED");

    try {
      const result = await markCampaignLeadReviewed({
        campaignId,
        leadId: lead.id,
      });

      if (result.status === "error") {
        throw new Error(result.message);
      }

      onLeadStatusChanged(lead.id, result.leadStatus ?? "REVIEWED");
    } catch (error) {
      onLeadStatusChanged(lead.id, previousStatus);
      toast({
        title: "Could not mark this lead reviewed",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPendingLeadIds((current) => current.filter((id) => id !== lead.id));
    }
  }

  return (
    <section aria-busy={isFilterLoading} className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#181818] shadow-[rgba(0,0,0,0.3)_0px_8px_24px]">
      <div className="border-b border-white/[0.07] px-5 py-5 lg:px-6">
        <div className="flex items-center gap-2 text-[#55e982]">
          <Radio aria-hidden="true" className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Live today</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h2 className="text-[24px] font-bold tracking-[-0.03em] text-[#ffffff]">
            {leadCount} qualified lead{leadCount === 1 ? "" : "s"}
          </h2>
          <span
            aria-atomic="true"
            aria-live="polite"
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#55e982]/40 bg-[#163a21] px-3.5 py-1.5 text-[12px] font-bold leading-4 text-[#8bf7ae] shadow-[0_6px_18px_rgba(30,215,96,0.12)] sm:text-[13px]"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />
            {formatStrongMatchCount(strongLeadCount)}
          </span>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-[#a7a7a7]">
          {freshnessSummary}
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#777]">
          {lastVisitSummary}
        </p>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {visibleJustAddedLeadIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b border-[#1ed760]/20 bg-[#101a13] px-5 py-3 text-[#b8e9c7] sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-center gap-3">
              <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-[#55e982]" />
              <p className="text-[11px] font-semibold leading-5">
                {visibleJustAddedLeadIds.length} new lead{visibleJustAddedLeadIds.length === 1 ? "" : "s"} just arrived and {visibleJustAddedLeadIds.length === 1 ? "is" : "are"} ready to review.
              </p>
            </div>
            {firstJustAddedLeadId ? (
              <button
                className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 self-start rounded-full bg-[#1ed760] px-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[#0d160f] transition-colors duration-200 hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:self-auto"
                onClick={scrollToNewPosts}
                type="button"
              >
                View new posts
                <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="p-4 sm:p-5 lg:p-6">
        {isFilterLoading ? (
          <InboxLoadingSkeleton />
        ) : shouldShowWaitingState ? (
          <InboxState
            description={`Qualified opportunities will appear here after Reddit posts are matched and classified. Next sync: ${nextSyncLabel}.`}
            icon={Clock3}
            title="Waiting for the next sync"
          />
        ) : leads.length === 0 && resolvedEmptyState === "FAILED" ? (
          <InboxState
            description="The latest sync did not finish successfully. The next completed run will populate this inbox."
            icon={AlertCircle}
            title="No classified leads yet"
          />
        ) : leads.length === 0 ? (
          <InboxState
            description={`No leads met the qualification threshold for ${selectedPeriodLabel}. Try another date or All time.`}
            icon={SearchX}
            title="No qualified leads found"
          />
        ) : (
          <div className="space-y-7">
            {feedSections.map((section) => (
              <div className="space-y-4" key={section.id}>
                <section aria-labelledby={`lead-group-${section.id}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3
                      className={`flex min-w-0 shrink-0 flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] ${section.kind === "new" ? "text-[#73f5a0]" : "text-[#b3b3b3]"}`}
                      id={`lead-group-${section.id}`}
                    >
                      {section.kind === "new" ? (
                        <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[#55e982] motion-reduce:animate-none" />
                      ) : (
                        <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-[#858585]" />
                      )}
                      {section.detectedAt ? (
                        <time
                          aria-label={`${section.label} ${formatExactDateTimeInTimeZone(section.detectedAt, timeZone)}`}
                          dateTime={section.detectedAt}
                          title={formatExactDateTimeInTimeZone(section.detectedAt, timeZone)}
                        >
                          {section.label} {formatClockTimeInTimeZone(section.detectedAt, timeZone)}
                        </time>
                      ) : (
                        <span>{section.label}</span>
                      )}
                    </h3>
                    <div className={`h-px min-w-6 flex-1 ${section.kind === "new" ? "bg-[#1ed760]/25" : "bg-white/[0.07]"}`} />
                    <span
                      aria-label={`${section.leads.length} lead${section.leads.length === 1 ? "" : "s"}`}
                      className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${section.kind === "new" ? "bg-[#142018] text-[#55e982]" : "bg-[#202020] text-[#858585]"}`}
                    >
                      {section.leads.length}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {section.leads.map((lead) => (
                      <InboxLeadCard
                        campaignId={campaignId}
                        canDelete={canDeleteLeads}
                        expanded={expandedLeadIds.includes(lead.id)}
                        key={lead.id}
                        lead={lead}
                        isFirstVisit={previousVisitAt === null}
                        isJustAdded={justAddedLeadIdSet.has(lead.id)}
                        isNewSinceVisit={newSinceVisitLeadIdSet.has(lead.id)}
                        nowMs={nowMs}
                        onDelete={onLeadDeleted}
                        onToggleExpanded={() => {
                          const isExpanding = !expandedLeadIds.includes(lead.id);

                          setExpandedLeadIds((current) =>
                            current.includes(lead.id)
                              ? current.filter((id) => id !== lead.id)
                              : [...current, lead.id],
                          );

                          if (isExpanding && trackClientActivity && !lead.isDemo) {
                            sendCampaignClientActivity({
                              campaignId,
                              eventType: "LEAD_EXPANDED",
                              leadId: lead.id,
                            });
                          }
                        }}
                        onOpenReddit={() => {
                          if (trackClientActivity && !lead.isDemo) {
                            sendCampaignClientActivity({
                              campaignId,
                              eventType: "REDDIT_LINK_CLICKED",
                              leadId: lead.id,
                            });
                          }
                          void markReviewed(lead);
                        }}
                        pending={pendingLeadIds.includes(lead.id)}
                        selected={selectedLeadId === lead.id}
                        timeZone={timeZone}
                      />
                    ))}
                  </div>
                </section>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function InboxLeadCard({
  campaignId,
  canDelete,
  expanded,
  isFirstVisit,
  isJustAdded,
  isNewSinceVisit,
  lead,
  nowMs,
  onDelete,
  onToggleExpanded,
  onOpenReddit,
  pending,
  selected,
  timeZone,
}: {
  campaignId: string;
  canDelete: boolean;
  expanded: boolean;
  isFirstVisit: boolean;
  isJustAdded: boolean;
  isNewSinceVisit: boolean;
  lead: CampaignLeadView;
  nowMs: number;
  onDelete?: (leadId: string) => void;
  onToggleExpanded: () => void;
  onOpenReddit: () => void;
  pending: boolean;
  selected: boolean;
  timeZone: string;
}) {
  const sourceText = getSourceText(lead);
  const sourceTextId = `lead-source-text-${lead.id}`;
  const visibleSourceText = getSourceTextPreview(sourceText, expanded);
  const canExpandSourceText = hasLongSourceText(sourceText);
  const freshnessClassName = selected
    ? "ring-2 ring-[#1ed760]/50"
    : isJustAdded
      ? "ring-2 ring-[#1ed760]/45"
    : isNewSinceVisit
      ? "ring-1 ring-[#1ed760]/30"
      : "";

  return (
    <article
      className={`relative scroll-mt-24 overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#1f1f1f_0%,#1a1a1a_100%)] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] transition hover:bg-[linear-gradient(180deg,#252525_0%,#1f1f1f_100%)] ${freshnessClassName}`}
      id={`lead-${lead.id}`}
    >
      {isNewSinceVisit ? (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-[3px] ${isJustAdded ? "bg-[#73f5a0]" : "bg-[#1ed760]/70"}`}
        />
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {isJustAdded ? (
                  <FreshnessBadge icon={Sparkles} label="Just added" />
                ) : isNewSinceVisit ? (
                  <FreshnessBadge icon={Clock3} label={isFirstVisit ? "New post" : "New post since last visit"} />
                ) : null}
                <LeadCardBadge tone="neutral">{lead.redditItem.type}</LeadCardBadge>
                <LeadCardBadge tone={lead.label === "HIGH" ? "good" : lead.label === "MED" ? "neutral" : "muted"}>
                  {lead.label}
                </LeadCardBadge>
                <LeadCardBadge tone="muted">{lead.status}</LeadCardBadge>
                {lead.ai?.category ? <LeadCardBadge tone="neutral">{lead.ai.category}</LeadCardBadge> : null}
              </div>
              <h4 className="mt-3 text-[16px] font-semibold leading-6 text-[#fdfdfd] [overflow-wrap:anywhere]">
                {lead.redditItem.title || lead.redditItem.body || "Untitled Reddit item"}
              </h4>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                <span>r/{lead.redditItem.subreddit}</span>
                <time className="text-[#55e982]" dateTime={lead.redditItem.createdUtc} title={formatExactDateTimeInTimeZone(lead.redditItem.createdUtc, timeZone)}>
                  Posted {formatLeadRelativeTime(lead.redditItem.createdUtc, nowMs)}
                </time>
                <time dateTime={lead.createdAt} title={formatExactDateTimeInTimeZone(lead.createdAt, timeZone)}>
                  Found {formatLeadRelativeTime(lead.createdAt, nowMs)}
                </time>
                {lead.ai?.intentType ? <span>{formatEnumLabel(lead.ai.intentType)}</span> : null}
                {lead.ai?.buyerStage ? <span>{formatEnumLabel(lead.ai.buyerStage)}</span> : null}
              </div>
            </div>
            <div className="w-full rounded-[18px] bg-[#121212] px-4 py-3 text-left shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:w-auto sm:text-right">
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Score</span>
                {pending ? <LoaderCircle aria-label="Saving lead status" className="h-4 w-4 animate-spin text-[#55e982] motion-reduce:animate-none" /> : null}
              </div>
              <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{lead.score}</div>
            </div>
          </div>

          <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <p className="text-[14px] leading-6 text-[#cbcbcb]">
              {lead.ai?.summary?.trim() || "No summary available yet for this lead."}
            </p>
          </div>

          {sourceText ? (
            <div className="border-t border-white/8 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Source text</p>
              <p className={`mt-2 text-[14px] leading-6 text-[#bdbdbd] ${expanded ? "whitespace-pre-wrap" : ""}`} id={sourceTextId}>
                {visibleSourceText}
              </p>
              {canExpandSourceText ? (
                <button
                  aria-controls={sourceTextId}
                  aria-expanded={expanded}
                  className="mt-2 inline-flex min-h-9 cursor-pointer items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fdfdfd] transition-colors duration-200 hover:bg-white/[0.06] hover:text-[#55e982] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={onToggleExpanded}
                  type="button"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1 sm:justify-end">
          {canDelete && onDelete && !lead.isDemo ? (
            <DeleteCampaignLeadDialog
              campaignId={campaignId}
              lead={{
                id: lead.id,
                score: lead.score,
                subreddit: lead.redditItem.subreddit,
                title: lead.redditItem.title,
              }}
              onDeleted={onDelete}
            />
          ) : null}

          {lead.redditItem.url ? (
            <a
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#1ed760] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] sm:w-auto"
              href={lead.redditItem.url}
              onClick={onOpenReddit}
              rel="noreferrer"
              target="_blank"
            >
              View on Reddit
            </a>
          ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function FreshnessBadge({
  icon: Icon,
  label,
}: {
  icon: typeof Clock3;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#121212] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function LeadCardBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "neutral" | "muted";
}) {
  const className = tone === "good"
    ? "bg-[#121212] text-[#1ed760]"
    : tone === "muted"
      ? "bg-[#121212] text-[#b3b3b3]"
      : "bg-[#121212] text-[#fdfdfd]";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}>
      {children}
    </span>
  );
}

function InboxState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Clock3;
  title: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#111111] px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#1f1f1f] text-[#8f8f8f]">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-[18px] font-bold text-[#ffffff]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[#a7a7a7]">{description}</p>
    </div>
  );
}

function InboxLoadingSkeleton() {
  return (
    <div aria-live="polite" className="space-y-3">
      <p className="sr-only">Loading campaign leads.</p>
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="rounded-[20px] border border-white/[0.06] bg-[#111111] p-5" key={index}>
          <div className="flex animate-pulse flex-col gap-3">
            <div className="h-5 w-36 rounded-full bg-[#252525]" />
            <div className="h-5 w-4/5 rounded-full bg-[#252525]" />
            <div className="h-4 w-3/5 rounded-full bg-[#1f1f1f]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getSourceText(lead: CampaignLeadView) {
  return (lead.redditItem.body?.trim() || lead.redditItem.description?.trim() || "").trim();
}

function getSourceTextPreview(sourceText: string, expanded: boolean) {
  if (!sourceText || expanded) {
    return sourceText;
  }

  const normalizedSourceText = normalizeSourceText(sourceText);

  if (normalizedSourceText.length <= COLLAPSED_SOURCE_TEXT_LENGTH) {
    return sourceText;
  }

  return `${normalizedSourceText.slice(0, COLLAPSED_SOURCE_TEXT_LENGTH - 3).trimEnd()}...`;
}

function hasLongSourceText(sourceText: string) {
  return normalizeSourceText(sourceText).length > COLLAPSED_SOURCE_TEXT_LENGTH;
}

function normalizeSourceText(sourceText: string) {
  return sourceText.replace(/\s+/g, " ").trim();
}

function formatEnumLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
