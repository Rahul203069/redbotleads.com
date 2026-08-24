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
  getCampaignLeadDateKey,
  getCampaignLeadGroupLabel,
} from "@/lib/campaign-lead-inbox";
import {
  CAMPAIGN_LEAD_STATUSES,
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
  leads,
  nextSyncLabel,
  onLeadDeleted,
  onLeadStatusChanged,
  selectedLeadId,
  selectedPeriodLabel,
  syncStatus,
  timeZone,
  todayDateKey,
  trackClientActivity = false,
}: {
  campaignId: string;
  canDeleteLeads?: boolean;
  emptyStateMode: CampaignLeadEmptyStateMode;
  includesDemo?: boolean;
  isFilterLoading: boolean;
  leads: CampaignLeadView[];
  nextSyncLabel: string;
  onLeadDeleted?: (leadId: string) => void;
  onLeadStatusChanged: (leadId: string, status: CampaignLeadStatus) => void;
  selectedLeadId?: string | null;
  selectedPeriodLabel: string;
  syncStatus: CampaignLeadSyncStatus;
  timeZone: string;
  todayDateKey: string;
  trackClientActivity?: boolean;
}) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("ALL");
  const [pendingLeadIds, setPendingLeadIds] = useState<string[]>([]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const orderedLeads = useMemo(
    () => [...leads].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [leads],
  );
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
              {counts.NEW > 0 ? `${counts.NEW} new for ${selectedPeriodLabel}.` : `You're caught up for ${selectedPeriodLabel}.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filter leads by status">
            {inboxFilters.map((filter) => {
              const selected = activeFilter === filter;
              const label = filter === "ALL" ? "All" : CAMPAIGN_LEAD_STATUS_LABELS[filter];

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
            description={`There are no ${activeFilter === "ALL" ? "matching" : CAMPAIGN_LEAD_STATUS_LABELS[activeFilter].toLowerCase()} leads for ${selectedPeriodLabel}.`}
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
                <div className="space-y-3">
                  {groupLeads.map((lead) => (
                    <InboxLeadCard
                      campaignId={campaignId}
                      canDelete={canDeleteLeads}
                      key={lead.id}
                      lead={lead}
                      now={now}
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
  lead,
  now,
  onDelete,
  onOpenReddit,
  onStatusChange,
  pending,
  selected,
  timeZone,
}: {
  campaignId: string;
  canDelete: boolean;
  lead: CampaignLeadView;
  now: number | null;
  onDelete?: (leadId: string) => void;
  onOpenReddit: () => void;
  onStatusChange: (status: CampaignLeadStatus) => void;
  pending: boolean;
  selected: boolean;
  timeZone: string;
}) {
  const sourceText = getSourceText(lead);
  const statusLabel = CAMPAIGN_LEAD_STATUS_LABELS[lead.status];

  return (
    <article
      className={`scroll-mt-5 rounded-[20px] border bg-[#111111] transition-colors duration-200 ${selected ? "border-[#73f5a0]/70 ring-2 ring-[#1ed760]/20" : lead.status === "NEW" ? "border-[#1ed760]/35" : "border-white/[0.07]"}`}
      id={`lead-${lead.id}`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              {lead.isDemo ? (
                <span className="rounded-full bg-[#1ed760]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#73f5a0]">
                  Demo
                </span>
              ) : null}
              <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d4d4d4]">
                r/{lead.redditItem.subreddit}
              </span>
              {lead.ai?.category ? (
                <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-semibold text-[#9f9f9f]">
                  {lead.ai.category}
                </span>
              ) : null}
            </div>

            <h4 className="mt-3 text-[16px] font-bold leading-6 text-[#ffffff] [overflow-wrap:anywhere] sm:text-[17px]">
              {lead.redditItem.title || lead.redditItem.body || "Untitled Reddit item"}
            </h4>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <time className="font-bold text-[#55e982]" dateTime={lead.redditItem.createdUtc} title={formatExactTime(lead.redditItem.createdUtc, timeZone)}>
                Posted {formatRelativeTime(lead.redditItem.createdUtc, now, timeZone)}
              </time>
              <time className="text-[#8f8f8f]" dateTime={lead.createdAt} title={formatExactTime(lead.createdAt, timeZone)}>
                Detected {formatRelativeTime(lead.createdAt, now, timeZone)}
              </time>
              <span className="font-semibold text-[#d4d4d4]">Match {lead.score}%</span>
            </div>

            <p className="mt-3 max-w-3xl text-[13px] leading-5 text-[#b8b8b8]">
              {lead.ai?.summary?.trim() || sourceText || "No summary is available for this lead."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {pending ? <LoaderCircle aria-label="Saving lead status" className="h-4 w-4 animate-spin text-[#55e982]" /> : null}
            <label className="sr-only" htmlFor={`lead-status-${lead.id}`}>Status for {lead.redditItem.title || "lead"}</label>
            <select
              className="h-10 cursor-pointer rounded-full border-none bg-[#1f1f1f] px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#ffffff] shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              id={`lead-status-${lead.id}`}
              onChange={(event) => onStatusChange(event.target.value as CampaignLeadStatus)}
              value={lead.status}
            >
              {CAMPAIGN_LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>{CAMPAIGN_LEAD_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-t border-white/[0.07] pt-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8f8f8f]">Reddit source</p>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#c6c6c6]">
                {sourceText || "No source text was stored for this Reddit item."}
              </p>
            </div>
            <div className="rounded-[16px] bg-[#181818] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8f8f8f]">Classification</p>
              <dl className="mt-3 grid gap-2 text-[12px]">
                <DetailRow label="Status" value={statusLabel} />
                <DetailRow label="Intent" value={formatEnumLabel(lead.ai?.intentType) || "Not available"} />
                <DetailRow label="Buyer stage" value={formatEnumLabel(lead.ai?.buyerStage) || "Not available"} />
                {lead.semanticScore !== null ? <DetailRow label="Semantic" value={`${Math.round(lead.semanticScore * 100)}%`} /> : null}
              </dl>
              {lead.ai?.painPoints.length ? (
                <div className="mt-4 border-t border-white/[0.07] pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f8f8f]">Pain points</p>
                  <ul className="mt-2 space-y-1 text-[12px] leading-5 text-[#b8b8b8]">
                    {lead.ai.painPoints.map((painPoint) => <li key={painPoint}>• {painPoint}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.07] pt-3 sm:flex-row sm:flex-wrap sm:items-center">
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
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d160f] transition-colors duration-200 hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffffff]"
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
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "bg-[#1ed760]/15 text-[#55e982]" : "text-[#a7a7a7] hover:bg-[#252525] hover:text-[#ffffff]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {CAMPAIGN_LEAD_STATUS_LABELS[status]}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[#8f8f8f]">{label}</dt>
      <dd className="text-right font-semibold text-[#d4d4d4]">{value}</dd>
    </div>
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

function formatRelativeTime(value: string, now: number | null, timeZone: string) {
  if (now === null) {
    return formatCompactTime(value, timeZone);
  }

  const differenceMs = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.floor(differenceMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatCompactTime(value, timeZone);
}

function formatCompactTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
  }).format(new Date(value));
}

function formatExactTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
