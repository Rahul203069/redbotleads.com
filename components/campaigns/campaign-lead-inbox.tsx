"use client";

import {
  AlertCircle,
  Beaker,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Radio,
  SearchX,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  markCampaignLeadReviewed,
  setCampaignLeadStatus,
} from "@/actions/campaigns";
import { sendCampaignClientActivity } from "@/components/campaigns/client-activity-tracker";
import { DeleteCampaignLeadDialog } from "@/components/campaigns/delete-campaign-lead-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  countCampaignLeadStatuses,
  formatLeadRelativeTime,
  getCampaignLeadDateKey,
  getCampaignLeadGroupLabel,
  isCampaignLeadNewSinceVisit,
} from "@/lib/campaign-lead-inbox";
import {
  CAMPAIGN_LEAD_STATUS_LABELS,
  type CampaignLeadStatus,
} from "@/lib/campaign-lead-status";
import type {
  CampaignLeadEmptyStateMode,
  CampaignLeadSyncStatus,
} from "@/lib/campaign-lead-empty-state";
import { resolveCampaignLeadEmptyState } from "@/lib/campaign-lead-empty-state";
import type { CampaignLeadView } from "@/lib/campaign-leads";

type InboxFilter = "ALL" | CampaignLeadStatus;

const inboxFilters: InboxFilter[] = [
  "ALL",
  "NEW",
  "SAVED",
  "REVIEWED",
  "CONTACTED",
  "DISMISSED",
];

export function CampaignLeadInbox({
  campaignId,
  canDeleteLeads = false,
  emptyStateMode,
  includesDemo = false,
  isFilterLoading,
  justAddedLeadIds = [],
  leads,
  nextSyncLabel,
  onLeadDeleted,
  onLeadStatusChanged,
  previousVisitAt,
  selectedLeadId,
  selectedPeriodLabel,
  syncStatus,
  timeZone,
  todayDateKey,
  trackClientActivity = false,
  visitStartedAt,
}: {
  campaignId: string;
  canDeleteLeads?: boolean;
  emptyStateMode: CampaignLeadEmptyStateMode;
  includesDemo?: boolean;
  isFilterLoading: boolean;
  justAddedLeadIds?: string[];
  leads: CampaignLeadView[];
  nextSyncLabel: string;
  onLeadDeleted?: (leadId: string) => void;
  onLeadStatusChanged: (leadId: string, status: CampaignLeadStatus) => void;
  previousVisitAt: string | null;
  selectedLeadId?: string | null;
  selectedPeriodLabel: string;
  syncStatus: CampaignLeadSyncStatus;
  timeZone: string;
  todayDateKey: string;
  trackClientActivity?: boolean;
  visitStartedAt: string;
}) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("ALL");
  const [now, setNow] = useState<number | null>(null);
  const [pendingLeadIds, setPendingLeadIds] = useState<string[]>([]);

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
  const newSinceVisitLeadIdSet = useMemo(() => new Set(orderedLeads
    .filter((lead) => isCampaignLeadNewSinceVisit({
      createdAt: lead.createdAt,
      isDemo: lead.isDemo,
      previousVisitAt,
    }))
    .map((lead) => lead.id)), [orderedLeads, previousVisitAt]);
  const newSinceVisitCount = newSinceVisitLeadIdSet.size;
  const counts = useMemo(() => countCampaignLeadStatuses(orderedLeads), [orderedLeads]);
  const filteredLeads = useMemo(
    () => orderedLeads.filter((lead) => (
      activeFilter === "ALL"
      || lead.status === activeFilter
    )),
    [activeFilter, orderedLeads],
  );
  const groupedLeads = useMemo(() => {
    const groups = new Map<string, CampaignLeadView[]>();

    for (const lead of filteredLeads) {
      const dateKey = getCampaignLeadDateKey(lead.createdAt, timeZone);
      const group = groups.get(dateKey) ?? [];
      group.push(lead);
      groups.set(dateKey, group);
    }

    return Array.from(groups.entries());
  }, [filteredLeads, timeZone]);
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

  function selectFilter(filter: InboxFilter) {
    setActiveFilter(filter);
  }

  async function markReviewed(lead: CampaignLeadView) {
    if (lead.status !== "NEW" || pendingLeadIds.includes(lead.id)) {
      return;
    }

    if (lead.isDemo) {
      onLeadStatusChanged(lead.id, "REVIEWED");
      toast({
        title: "Demo lead reviewed",
        description: "This preview was updated only in your browser. Your database was not changed.",
      });
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

  async function changeStatus(lead: CampaignLeadView, status: CampaignLeadStatus) {
    if (lead.status === status || pendingLeadIds.includes(lead.id)) {
      return;
    }

    if (lead.isDemo) {
      onLeadStatusChanged(lead.id, status);
      toast({
        title: CAMPAIGN_LEAD_STATUS_LABELS[status],
        description: "This demo lead was updated only in your browser. Your database was not changed.",
      });
      return;
    }

    const previousStatus = lead.status;
    setPendingLeadIds((current) => [...current, lead.id]);
    onLeadStatusChanged(lead.id, status);

    try {
      const result = await setCampaignLeadStatus({
        campaignId,
        leadId: lead.id,
        status,
      });

      if (result.status === "error") {
        throw new Error(result.message);
      }

      onLeadStatusChanged(lead.id, result.leadStatus ?? status);
    } catch (error) {
      onLeadStatusChanged(lead.id, previousStatus);
      toast({
        title: "Could not update this lead",
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
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#55e982]">
              <Radio aria-hidden="true" className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Live today</span>
            </div>
            <h2 className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#ffffff]">
              {counts.ALL} qualified lead{counts.ALL === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-[#a7a7a7]">
              {freshnessSummary}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#777]">
              {counts.NEW} unreviewed · {lastVisitSummary}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filter leads by status">
            {inboxFilters.map((filter) => {
              const selected = activeFilter === filter;
              const label = filter === "ALL" ? "All" : filter === "NEW" ? "Unreviewed" : CAMPAIGN_LEAD_STATUS_LABELS[filter];

              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-10 cursor-pointer rounded-full px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 ${
                    selected
                      ? "bg-[#1ed760] text-[#0d160f]"
                      : "bg-[#101010] text-[#a7a7a7] shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] hover:text-[#ffffff]"
                  }`}
                  key={filter}
                  onClick={() => selectFilter(filter)}
                  type="button"
                >
                  {label} {counts[filter]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {justAddedLeadIds.length > 0 ? (
          <div className="flex items-center gap-3 border-b border-[#1ed760]/20 bg-[#101a13] px-5 py-3 text-[#b8e9c7] lg:px-6">
            <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-[#55e982]" />
            <p className="text-[11px] font-semibold leading-5">
              {justAddedLeadIds.length} new lead{justAddedLeadIds.length === 1 ? "" : "s"} just arrived and {justAddedLeadIds.length === 1 ? "is" : "are"} now at the top.
            </p>
          </div>
        ) : null}
      </div>

      {includesDemo ? (
        <div className="flex items-start gap-3 border-b border-[#1ed760]/15 bg-[#111811] px-5 py-4 text-[#b8e9c7] lg:px-6">
          <Beaker aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#55e982]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#73f5a0]">Demo leads for testing</p>
            <p className="mt-1 text-[12px] leading-5">No real qualified leads were found today, so these examples are shown temporarily. Status changes stay in this browser and never update your database.</p>
          </div>
        </div>
      ) : null}

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
        ) : filteredLeads.length === 0 ? (
          <InboxState
            description={`There are no ${activeFilter === "ALL" ? "matching" : activeFilter === "NEW" ? "unreviewed" : CAMPAIGN_LEAD_STATUS_LABELS[activeFilter].toLowerCase()} leads for ${selectedPeriodLabel}.`}
            icon={SearchX}
            title="Nothing in this view"
          />
        ) : (
          <div className="space-y-7">
            {groupedLeads.map(([dateKey, groupLeads]) => (
              <section aria-labelledby={`lead-group-${dateKey}`} key={dateKey}>
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3b3b3]" id={`lead-group-${dateKey}`}>
                    {getCampaignLeadGroupLabel({ dateKey, timeZone, todayDateKey })}
                  </h3>
                  <div className="h-px flex-1 bg-white/[0.07]" />
                  <span className="text-[10px] font-semibold text-[#6f6f6f]">{groupLeads.length}</span>
                </div>
                <div className="space-y-2.5">
                  {groupLeads.map((lead) => (
                    <InboxLeadCard
                      campaignId={campaignId}
                      canDelete={canDeleteLeads}
                      key={lead.id}
                      lead={lead}
                      isFirstVisit={previousVisitAt === null}
                      isJustAdded={justAddedLeadIdSet.has(lead.id)}
                      isNewSinceVisit={newSinceVisitLeadIdSet.has(lead.id)}
                      nowMs={nowMs}
                      onDelete={onLeadDeleted}
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
                      onStatusChange={(status) => void changeStatus(lead, status)}
                      pending={pendingLeadIds.includes(lead.id)}
                      selected={selectedLeadId === lead.id}
                      timeZone={timeZone}
                    />
                  ))}
                </div>
              </section>
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
  isFirstVisit,
  isJustAdded,
  isNewSinceVisit,
  lead,
  nowMs,
  onDelete,
  onOpenReddit,
  onStatusChange,
  pending,
  selected,
  timeZone,
}: {
  campaignId: string;
  canDelete: boolean;
  isFirstVisit: boolean;
  isJustAdded: boolean;
  isNewSinceVisit: boolean;
  lead: CampaignLeadView;
  nowMs: number;
  onDelete?: (leadId: string) => void;
  onOpenReddit: () => void;
  onStatusChange: (status: CampaignLeadStatus) => void;
  pending: boolean;
  selected: boolean;
  timeZone: string;
}) {
  const sourceText = getSourceText(lead);
  const freshnessClassName = isJustAdded
    ? "border-[#55e982]/75 bg-[#101a13] shadow-[0_0_0_1px_rgba(30,215,96,0.08),0_8px_24px_rgba(30,215,96,0.08)]"
    : isNewSinceVisit
      ? "border-[#1ed760]/35 bg-[#111511]"
      : lead.status === "NEW"
        ? "border-white/[0.12] bg-[#111111]"
        : "border-white/[0.07] bg-[#111111]";

  return (
    <article
      className={`scroll-mt-5 rounded-[18px] border transition-colors duration-200 ${freshnessClassName} ${selected ? "ring-2 ring-[#1ed760]/25" : ""}`}
      id={`lead-${lead.id}`}
    >
      <div className="p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {isJustAdded ? (
                <FreshnessBadge icon={Sparkles} label="Just added" />
              ) : isNewSinceVisit ? (
                <FreshnessBadge icon={Clock3} label={isFirstVisit ? "New to you" : "New since last visit"} />
              ) : null}
              <span className="rounded-full bg-[#1f1f1f] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#d4d4d4]">
                {lead.redditItem.type}
              </span>
              <LeadLabelBadge label={lead.label} />
              <StatusBadge status={lead.status} />
              {lead.isDemo ? (
                <span className="rounded-full bg-[#1ed760]/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.13em] text-[#73f5a0]">
                  Demo
                </span>
              ) : null}
              {lead.ai?.category ? (
                <span className="rounded-full bg-[#1f1f1f] px-2 py-0.5 text-[9px] font-semibold text-[#9f9f9f]">
                  {lead.ai.category}
                </span>
              ) : null}
            </div>

            <h4 className="mt-2 text-[15px] font-bold leading-5 text-[#ffffff] [overflow-wrap:anywhere] sm:text-[16px]">
              {lead.redditItem.title || lead.redditItem.body || "Untitled Reddit item"}
            </h4>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8f8f8f]">
              <span>r/{lead.redditItem.subreddit}</span>
              <time className="text-[#55e982]" dateTime={lead.redditItem.createdUtc} title={formatExactTime(lead.redditItem.createdUtc, timeZone)}>
                Posted {formatLeadRelativeTime(lead.redditItem.createdUtc, nowMs)}
              </time>
              <time dateTime={lead.createdAt} title={formatExactTime(lead.createdAt, timeZone)}>
                Found {formatLeadRelativeTime(lead.createdAt, nowMs)}
              </time>
              {lead.ai?.intentType ? <span>{formatEnumLabel(lead.ai.intentType)}</span> : null}
              {lead.ai?.buyerStage ? <span>{formatEnumLabel(lead.ai.buyerStage)}</span> : null}
            </div>

            <div className="mt-2 rounded-[12px] bg-[#181818] px-3 py-2.5">
              <p className="max-w-4xl text-[12px] leading-5 text-[#c6c6c6]">
                {lead.ai?.summary?.trim() || "No summary available yet for this lead."}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {pending ? <LoaderCircle aria-label="Saving lead status" className="h-4 w-4 animate-spin text-[#55e982]" /> : null}
            <div className="rounded-[12px] bg-[#181818] px-3 py-2 text-right shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset]">
              <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#777]">Score</div>
              <div className="mt-0.5 text-[20px] font-bold leading-none text-[#ffffff]">{lead.score}</div>
            </div>
          </div>
        </div>

        {sourceText ? (
          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#777]">Source text</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-5 text-[#c6c6c6]">
              {sourceText}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-3">
          <ActionButton
            active={lead.status === "SAVED"}
            disabled={pending}
            icon={Star}
            label={lead.status === "SAVED" ? "Unsave" : "Save"}
            onClick={() => onStatusChange(lead.status === "SAVED" ? "REVIEWED" : "SAVED")}
          />
          <ActionButton
            active={lead.status === "CONTACTED"}
            disabled={pending}
            icon={CheckCircle2}
            label={lead.status === "CONTACTED" ? "Undo contacted" : "Contacted"}
            onClick={() => onStatusChange(lead.status === "CONTACTED" ? "REVIEWED" : "CONTACTED")}
          />
          <ActionButton
            active={lead.status === "DISMISSED"}
            disabled={pending}
            icon={XCircle}
            label={lead.status === "DISMISSED" ? "Restore" : "Dismiss"}
            onClick={() => onStatusChange(lead.status === "DISMISSED" ? "REVIEWED" : "DISMISSED")}
          />

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
              className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#1ed760] px-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[#0d160f] transition-colors duration-200 hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffffff] sm:ml-auto"
              href={lead.redditItem.url}
              onClick={onOpenReddit}
              rel="noreferrer"
              target="_blank"
            >
              View Reddit
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ActionButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: typeof Star;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "bg-[#1ed760]/15 text-[#55e982]" : "text-[#a7a7a7] hover:bg-[#252525] hover:text-[#ffffff]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: CampaignLeadStatus }) {
  const Icon = status === "NEW"
    ? Clock3
    : status === "SAVED"
      ? Star
      : status === "CONTACTED"
        ? CheckCircle2
        : status === "DISMISSED"
          ? XCircle
          : CheckCircle2;
  const className = status === "NEW"
    ? "bg-[#1ed760]/12 text-[#55e982]"
    : status === "SAVED"
      ? "bg-[#f2c94c]/12 text-[#ffd66e]"
      : status === "DISMISSED"
        ? "bg-[#f3727f]/12 text-[#ff9aa5]"
        : "bg-[#1f1f1f] text-[#b8b8b8]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${className}`}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      {status === "NEW" ? "Unreviewed" : CAMPAIGN_LEAD_STATUS_LABELS[status]}
    </span>
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
    <span className="inline-flex items-center gap-1 rounded-full bg-[#1ed760]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#73f5a0]">
      <Icon aria-hidden="true" className="h-3 w-3" />
      {label}
    </span>
  );
}

function LeadLabelBadge({ label }: { label: CampaignLeadView["label"] }) {
  const className = label === "HIGH"
    ? "bg-[#1ed760]/12 text-[#55e982]"
    : label === "MED"
      ? "bg-[#1f1f1f] text-[#d4d4d4]"
      : "bg-[#1a1a1a] text-[#8f8f8f]";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${className}`}>
      {label}
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

function formatEnumLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatExactTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
