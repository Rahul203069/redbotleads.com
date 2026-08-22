"use client";

import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, LoaderCircle, MessageSquareText, RotateCcw, Star, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { markLiveLeadReviewed, saveLiveLeadNote, updateLiveLeadStatus } from "@/actions/live-mode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { CAMPAIGN_LEAD_STATUS_LABELS, type CampaignLeadStatus } from "@/lib/campaign-lead-status";
import type { LiveLeadView } from "@/lib/live-leads";

export function LiveLeadFeed({
  autoRefresh = false,
  compact = false,
  leads,
  selectedLeadId,
  timeZone,
}: {
  autoRefresh?: boolean;
  compact?: boolean;
  leads: LiveLeadView[];
  selectedLeadId?: string | null;
  timeZone: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [localLeads, setLocalLeads] = useState(leads);
  const [expandedIds, setExpandedIds] = useState<string[]>(selectedLeadId ? [selectedLeadId] : []);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setLocalLeads(leads), [leads]);
  useEffect(() => {
    setNow(Date.now());
    const minuteTimer = window.setInterval(() => setNow(Date.now()), 60_000);
    const refreshTimer = autoRefresh ? window.setInterval(() => router.refresh(), 30_000) : null;
    return () => {
      window.clearInterval(minuteTimer);
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, [autoRefresh, router]);

  useEffect(() => {
    if (!selectedLeadId) return;
    setExpandedIds((current) => current.includes(selectedLeadId) ? current : [...current, selectedLeadId]);
    const lead = localLeads.find((item) => item.id === selectedLeadId);
    if (lead?.status === "NEW") void markReviewed(lead);
    // The selected ID is the trigger; local status updates are intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId]);

  const orderedLeads = useMemo(
    () => [...localLeads].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [localLeads],
  );

  function updateLocalLead(leadId: string, change: Partial<LiveLeadView>) {
    setLocalLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, ...change } : lead));
  }

  async function markReviewed(lead: LiveLeadView) {
    if (lead.status !== "NEW" || pendingIds.includes(lead.id)) return;
    setPendingIds((current) => [...current, lead.id]);
    updateLocalLead(lead.id, { status: "REVIEWED" });
    const result = await markLiveLeadReviewed({ campaignId: lead.campaign.id, leadId: lead.id });
    if (result.status === "error") {
      updateLocalLead(lead.id, { status: "NEW" });
      toast({ title: "Could not mark lead reviewed", description: result.message, variant: "destructive" });
    }
    setPendingIds((current) => current.filter((id) => id !== lead.id));
  }

  async function changeStatus(lead: LiveLeadView, status: CampaignLeadStatus) {
    if (pendingIds.includes(lead.id) || lead.status === status) return;
    const previousStatus = lead.status;
    setPendingIds((current) => [...current, lead.id]);
    updateLocalLead(lead.id, { status });
    const result = await updateLiveLeadStatus({ campaignId: lead.campaign.id, leadId: lead.id, status });
    if (result.status === "error") {
      updateLocalLead(lead.id, { status: previousStatus });
      toast({ title: "Could not update lead", description: result.message, variant: "destructive" });
    } else {
      toast({ title: CAMPAIGN_LEAD_STATUS_LABELS[status], description: result.message });
    }
    setPendingIds((current) => current.filter((id) => id !== lead.id));
  }

  function toggleLead(lead: LiveLeadView) {
    const expanding = !expandedIds.includes(lead.id);
    setExpandedIds((current) => expanding ? [...current, lead.id] : current.filter((id) => id !== lead.id));
    if (expanding) void markReviewed(lead);
  }

  if (orderedLeads.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/[0.12] bg-[#111111] px-5 py-12 text-center">
        <p className="text-[16px] font-bold text-white">Nothing waiting here</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[#9f9f9f]">New qualified Reddit opportunities will stay in this queue until you review them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orderedLeads.map((lead) => {
        const expanded = expandedIds.includes(lead.id);
        const pending = pendingIds.includes(lead.id);
        return (
          <article className={`overflow-hidden rounded-[20px] border bg-[#111111] transition-colors duration-200 ${lead.status === "NEW" ? "border-[#1ed760]/40" : "border-white/[0.08]"}`} id={`lead-${lead.id}`} key={lead.id}>
            <div className={compact ? "p-4" : "p-4 sm:p-5"}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={lead.status} />
                    <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d4d4d4]">{lead.campaign.name}</span>
                    <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-semibold text-[#a7a7a7]">r/{lead.redditItem.subreddit}</span>
                  </div>
                  <h3 className="mt-3 text-[16px] font-bold leading-6 text-white [overflow-wrap:anywhere] sm:text-[17px]">{lead.redditItem.title || lead.redditItem.body || "Untitled Reddit item"}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                    <time className="font-bold text-[#55e982]" dateTime={lead.redditItem.createdUtc} title={formatExact(lead.redditItem.createdUtc, timeZone)}>Posted {formatRelative(lead.redditItem.createdUtc, now)}</time>
                    <time className="text-[#8f8f8f]" dateTime={lead.createdAt} title={formatExact(lead.createdAt, timeZone)}>Found {formatRelative(lead.createdAt, now)}</time>
                    <span className="font-semibold text-[#d4d4d4]">{lead.score}% match</span>
                    {lead.semanticScore !== null ? <span className="text-[#8f8f8f]">Semantic {Math.round(lead.semanticScore * 100)}%</span> : null}
                  </div>
                  <p className={`${expanded ? "" : "line-clamp-2"} mt-3 max-w-3xl text-[13px] leading-5 text-[#b8b8b8]`}>{lead.ai?.summary?.trim() || lead.redditItem.description || lead.redditItem.body || "No AI match explanation is available."}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {pending ? <LoaderCircle aria-label="Saving lead" className="h-4 w-4 animate-spin text-[#55e982]" /> : null}
                  <Button className="cursor-pointer rounded-full" onClick={() => toggleLead(lead)} size="sm" type="button" variant="secondary">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {expanded ? "Close" : "Review"}
                  </Button>
                </div>
              </div>

              {expanded ? (
                <div className="mt-5 grid gap-4 border-t border-white/[0.08] pt-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailBlock label="Why it matched" value={lead.ai?.summary || "No explanation available."} />
                    <DetailBlock label="Intent" value={[lead.ai?.intentType, lead.ai?.buyerStage, lead.ai?.category].filter(Boolean).join(" · ") || "Not classified"} />
                  </div>
                  {lead.ai?.painPoints.length ? <DetailBlock label="Pain points" value={lead.ai.painPoints.join(" · ")} /> : null}
                  <LeadNoteEditor key={`${lead.id}-${lead.notes ?? ""}`} lead={lead} onSaved={(notes) => updateLocalLead(lead.id, { notes })} />
                  <div className="flex flex-wrap gap-2">
                    <ActionButton disabled={pending} icon={Star} label="Save" onClick={() => void changeStatus(lead, "SAVED")} selected={lead.status === "SAVED"} />
                    <ActionButton disabled={pending} icon={CheckCircle2} label="Contacted" onClick={() => void changeStatus(lead, "CONTACTED")} selected={lead.status === "CONTACTED"} />
                    <ActionButton disabled={pending} icon={XCircle} label="Dismiss" onClick={() => void changeStatus(lead, "DISMISSED")} selected={lead.status === "DISMISSED"} />
                    {lead.status !== "NEW" && lead.status !== "REVIEWED" ? <ActionButton disabled={pending} icon={RotateCcw} label="Reviewed" onClick={() => void changeStatus(lead, "REVIEWED")} /> : null}
                    {lead.redditItem.url ? (
                      <a className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d160f] transition-colors hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" href={lead.redditItem.url} onClick={() => void markReviewed(lead)} rel="noreferrer" target="_blank">
                        <ExternalLink className="h-4 w-4" /> View Reddit
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LeadNoteEditor({ lead, onSaved }: { lead: LiveLeadView; onSaved: (notes: string | null) => void }) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [isPending, startTransition] = useTransition();
  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-[#181818] p-4">
      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#b3b3b3]" htmlFor={`lead-notes-${lead.id}`}><MessageSquareText className="h-4 w-4" /> Shared campaign note</label>
      <Textarea className="mt-3 min-h-24 resize-y border-white/[0.08] bg-[#101010]" id={`lead-notes-${lead.id}`} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder="Add context for anyone with access to this campaign..." value={notes} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[10px] text-[#777]">{notes.length}/4000</span>
        <Button className="cursor-pointer rounded-full bg-[#1f1f1f]" disabled={isPending || notes === (lead.notes ?? "")} onClick={() => startTransition(async () => {
          const result = await saveLiveLeadNote({ campaignId: lead.campaign.id, leadId: lead.id, notes });
          if (result.status === "error") toast({ title: "Could not save note", description: result.message, variant: "destructive" });
          else { onSaved(notes.trim() || null); toast({ title: "Note saved", description: result.message }); }
        })} size="sm" type="button" variant="secondary">{isPending ? "Saving..." : "Save note"}</Button>
      </div>
    </div>
  );
}

function ActionButton({ disabled, icon: Icon, label, onClick, selected = false }: { disabled: boolean; icon: typeof Star; label: string; onClick: () => void; selected?: boolean }) {
  return <button aria-pressed={selected} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "bg-[#1ed760]/15 text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]" : "bg-[#1f1f1f] text-[#d4d4d4] hover:bg-[#292929] hover:text-white"}`} disabled={disabled} onClick={onClick} type="button"><Icon className="h-4 w-4" />{label}</button>;
}

function StatusBadge({ status }: { status: CampaignLeadStatus }) {
  const tone = status === "NEW" ? "bg-[#1ed760]/15 text-[#73f5a0]" : status === "SAVED" ? "bg-[#332c12] text-[#ffd66e]" : status === "CONTACTED" ? "bg-[#102742] text-[#8fc8ff]" : status === "DISMISSED" ? "bg-[#3a151b] text-[#ff9aa5]" : "bg-[#252525] text-[#c7c7c7]";
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${tone}`}>{CAMPAIGN_LEAD_STATUS_LABELS[status]}</span>;
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[16px] bg-[#181818] p-4"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#737373]">{label}</p><p className="mt-2 text-[13px] leading-5 text-[#d4d4d4]">{value}</p></div>;
}

function formatRelative(value: string, now: number | null) {
  if (now === null) return "recently";
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatExact(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}
