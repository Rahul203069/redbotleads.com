"use client";

import { useState } from "react";
import {
  BrainCircuit,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { getAdminCampaignClassifiedLeads } from "@/actions/campaigns";
import { copyToClipboard } from "@/components/campaigns/copy-public-campaign-link-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  buildAdminClassifiedLeadsJson,
  type AdminClassifiedLead,
  type CampaignLeadDateFilter,
} from "@/lib/admin-classified-leads";

type LoadState = "idle" | "loading" | "loaded" | "error";

export function AdminClassifiedLeadsDialog({
  campaignId,
  campaignName,
  dateFilter,
  dateLabel,
}: {
  campaignId: string;
  campaignName: string;
  dateFilter: CampaignLeadDateFilter;
  dateLabel: string;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [leads, setLeads] = useState<AdminClassifiedLead[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const datePhrase = dateLabel === "All time" ? "across all time" : `during ${dateLabel}`;

  async function loadLeads() {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const result = await getAdminCampaignClassifiedLeads(campaignId, dateFilter);

      if (result.status === "error") {
        setErrorMessage(result.message);
        setLoadState("error");
        return;
      }

      setLeads(result.leads);
      setLoadState("loaded");
    } catch {
      setErrorMessage("The classified leads could not be loaded. Try again.");
      setLoadState("error");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen);
    setCopied(false);

    if (nextOpen && loadState === "idle") {
      void loadLeads();
    }
  }

  async function handleCopyJson() {
    const payload = buildAdminClassifiedLeadsJson({
      campaignId,
      campaignName,
      copiedAt: new Date().toISOString(),
      dateFilter,
      dateLabel,
      leads,
    });

    try {
      await copyToClipboard(JSON.stringify(payload, null, 2));
      setCopied(true);
      toast({
        title: "Classified leads copied",
        description: `${leads.length} classified lead${leads.length === 1 ? "" : "s"} copied as JSON.`,
      });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Could not copy JSON",
        description: "Your browser blocked clipboard access. Try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" variant="secondary">
          <BrainCircuit aria-hidden="true" className="h-4 w-4" />
          {loadState === "loaded" ? `All classified (${leads.length})` : "All classified"}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-6xl flex-col overflow-hidden">
        <div className="border-b border-[#27272a] bg-[#0f0f11] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <DialogHeader className="max-w-3xl">
              <DialogTitle>All LLM-classified leads</DialogTitle>
              <DialogDescription>
                Every lead ingested {datePhrase} that has an LLM classification, including scores below the
                campaign&apos;s normal visible threshold. Dates use the lead ingestion time in UTC.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Button
                className="w-full sm:w-auto"
                disabled={loadState !== "loaded" || leads.length === 0}
                onClick={handleCopyJson}
                type="button"
                variant="secondary"
              >
                {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                {copied ? "Copied" : "Copy JSON"}
              </Button>
              <DialogClose asChild>
                <Button className="w-full sm:w-auto" type="button" variant="ghost">
                  Close
                </Button>
              </DialogClose>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" aria-live="polite">
            <SummaryPill label="Selected period" value={dateLabel} />
            <SummaryPill
              label="Classified leads"
              value={loadState === "loaded" ? String(leads.length) : loadState === "loading" ? "Loading" : "—"}
            />
            <SummaryPill label="Date field" value="Lead created at" />
          </div>
        </div>

        <div className="scrollbar-subtle flex-1 overflow-y-auto p-4 sm:p-6">
          {loadState === "loading" || loadState === "idle" ? (
            <ClassifiedLeadsLoadingState />
          ) : loadState === "error" ? (
            <ClassifiedLeadsErrorState message={errorMessage} onRetry={loadLeads} />
          ) : leads.length === 0 ? (
            <ClassifiedLeadsEmptyState datePhrase={datePhrase} />
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <ClassifiedLeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClassifiedLeadCard({ lead }: { lead: AdminClassifiedLead }) {
  const sourceText = lead.redditItem.body?.trim() || lead.redditItem.description?.trim() || "";
  const title = lead.redditItem.title?.trim() || getSourceTitle(sourceText) || "Untitled Reddit item";

  return (
    <article className="rounded-[22px] border border-[#27272a] bg-[linear-gradient(180deg,#18181b_0%,#111113_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LeadPill>{lead.redditItem.type}</LeadPill>
            <LeadPill tone={lead.label === "HIGH" ? "good" : "neutral"}>{lead.label}</LeadPill>
            <LeadPill>{lead.status}</LeadPill>
            {lead.ai.category ? <LeadPill>{lead.ai.category}</LeadPill> : null}
          </div>

          <h3 className="mt-3 break-words text-base font-semibold leading-6 text-[#fafafa]">{title}</h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
            <span>r/{lead.redditItem.subreddit}</span>
            <span>Ingested {formatLeadDate(lead.createdAt)}</span>
            {lead.ai.intentType ? <span>{formatEnumLabel(lead.ai.intentType)}</span> : null}
            {lead.ai.buyerStage ? <span>{formatEnumLabel(lead.ai.buyerStage)}</span> : null}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <LeadMetric label="Lead score" value={String(lead.score)} />
          <LeadMetric label="Semantic" value={formatSemanticScore(lead.semanticScore)} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <LeadDetail label="LLM summary" value={lead.ai.summary?.trim() || "No summary was returned."} />
        <LeadDetail
          label="Pain points"
          value={lead.ai.painPoints.length > 0 ? lead.ai.painPoints.join(" • ") : "No pain points were returned."}
        />
      </div>

      {lead.ai.disqualifier ? (
        <div className="mt-4 rounded-[16px] border border-[#f59e0b]/20 bg-[#f59e0b]/8 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fbbf24]">Disqualifier</p>
          <p className="mt-2 text-sm leading-6 text-[#e4e4e7]">{lead.ai.disqualifier}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-[#27272a] pt-4 sm:flex-row sm:items-start sm:justify-between">
        {sourceText ? (
          <details className="group min-w-0 flex-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-[11px] font-bold uppercase tracking-[0.15em] text-[#d4d4d8] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/35">
              View source text
            </summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#b8b8be]">{sourceText}</p>
          </details>
        ) : (
          <p className="text-sm leading-6 text-[#71717a]">No source text was stored for this item.</p>
        )}

        {lead.redditItem.url ? (
          <a
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#27272a] bg-[#111113] px-4 text-sm font-medium text-[#fafafa] transition-colors hover:border-[#3f3f46] hover:bg-[#18181b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            href={lead.redditItem.url}
            rel="noreferrer"
            target="_blank"
          >
            View on Reddit
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function ClassifiedLeadsLoadingState() {
  return (
    <div aria-live="polite" className="space-y-4">
      <div className="flex min-h-11 items-center gap-3 rounded-[18px] border border-[#27272a] bg-[#111113] px-4 text-sm text-[#d4d4d8]">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading every classified lead in the selected period…
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="animate-pulse rounded-[22px] border border-[#27272a] bg-[#111113] p-5" key={index}>
          <div className="h-4 w-40 rounded-full bg-[#27272a]" />
          <div className="mt-4 h-5 w-3/4 rounded-full bg-[#27272a]" />
          <div className="mt-5 h-20 rounded-[16px] bg-[#18181b]" />
        </div>
      ))}
    </div>
  );
}

function ClassifiedLeadsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-[#ef4444]/25 bg-[#ef4444]/8 p-5 sm:p-6">
      <TriangleAlert aria-hidden="true" className="h-6 w-6 text-[#f87171]" />
      <h3 className="mt-4 text-lg font-semibold text-[#fafafa]">Could not load classified leads</h3>
      <p className="mt-2 text-sm leading-6 text-[#d4d4d8]">{message}</p>
      <Button className="mt-5" onClick={onRetry} type="button" variant="secondary">
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

function ClassifiedLeadsEmptyState({ datePhrase }: { datePhrase: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#3f3f46] bg-[#111113] p-6 text-center sm:p-10">
      <BrainCircuit aria-hidden="true" className="mx-auto h-8 w-8 text-[#71717a]" />
      <h3 className="mt-4 text-lg font-semibold text-[#fafafa]">No LLM-classified leads found</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#a1a1aa]">
        No lead ingested {datePhrase} has a completed LLM classification. Choose another date or range and open this view again.
      </p>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#27272a] bg-[#111113] px-3 text-[11px] text-[#d4d4d8]">
      <span className="font-semibold uppercase tracking-[0.12em] text-[#71717a]">{label}</span>
      <span className="font-semibold text-[#fafafa]">{value}</span>
    </span>
  );
}

function LeadPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "good" | "neutral";
}) {
  return (
    <span className={`inline-flex rounded-full bg-[#0b0b0d] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone === "good" ? "text-[#4ade80]" : "text-[#d4d4d8]"}`}>
      {children}
    </span>
  );
}

function LeadMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[100px] rounded-[16px] border border-[#27272a] bg-[#0b0b0d] px-3 py-3 sm:text-right">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#fafafa]">{value}</p>
    </div>
  );
}

function LeadDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#27272a] bg-[#0b0b0d] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-[#d4d4d8]">{value}</p>
    </div>
  );
}

function formatLeadDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatEnumLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatSemanticScore(value: number | null) {
  return value === null ? "—" : value.toFixed(3);
}

function getSourceTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}…`;
}
