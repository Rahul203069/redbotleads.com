"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";

import {
  saveCampaignSemanticQueries,
  type SaveCampaignSemanticQueriesResult,
} from "@/app/(app)/admin/analytics/semantic-queries/actions";
import { SemanticQueryDraftEditor } from "@/components/semantic-queries/semantic-query-draft-editor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  cleanSemanticQueryRows,
  type SemanticQueryDraftRow,
} from "@/lib/semantic-queries";

type CampaignOption = {
  id: string;
  name: string;
  leadType: "PRODUCT" | "SERVICE";
  description: string | null;
  isActive: boolean;
  owner: string;
  subreddits: string[];
  semanticQueries: Array<{
    id: string;
    queryText: string;
    category: string | null;
  }>;
};

export function SemanticQueryEditor({
  campaigns,
  selectedCampaignId,
}: {
  campaigns: CampaignOption[];
  selectedCampaignId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [campaignId, setCampaignId] = useState(selectedCampaignId ?? campaigns[0]?.id ?? "");
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === campaignId) ?? null,
    [campaignId, campaigns],
  );
  const [rows, setRows] = useState<SemanticQueryDraftRow[]>(() => buildQueryRows(selectedCampaign));

  function handleCampaignChange(nextCampaignId: string) {
    const nextCampaign = campaigns.find((campaign) => campaign.id === nextCampaignId) ?? null;

    setCampaignId(nextCampaignId);
    setRows(buildQueryRows(nextCampaign));
    router.push(`/admin/analytics/semantic-queries?campaignId=${encodeURIComponent(nextCampaignId)}`);
  }

  function handleClearQueries() {
    setRows([]);
    toast({
      title: "Semantic query draft cleared",
      description: "Live queries are unchanged. Use Reset to restore them, or add a replacement set before saving.",
    });
  }

  async function handleCopyQueries() {
    const result = cleanSemanticQueryRows(rows);

    if (result.status === "error") {
      toast({
        title: "No semantic queries to copy",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    const copied = await copyTextToClipboard(
      JSON.stringify(
        {
          semanticQueries: result.queries,
        },
        null,
        2,
      ),
    );

    toast({
      title: copied ? "Semantic queries copied" : "Could not copy semantic queries",
      description: copied
        ? `Copied ${result.queries.length} semantic ${result.queries.length === 1 ? "query" : "queries"} as JSON.`
        : "Your browser blocked clipboard access. Try copying again.",
      variant: copied ? undefined : "destructive",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!campaignId) {
      toast({
        title: "Campaign missing",
        description: "Select a campaign before saving.",
        variant: "destructive",
      });
      return;
    }

    const result = cleanSemanticQueryRows(rows);

    if (result.status === "error") {
      toast({
        title: "Semantic queries not saved",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("queriesJson", JSON.stringify(result.queries));

    startTransition(async () => {
      let response: SaveCampaignSemanticQueriesResult;

      try {
        response = await saveCampaignSemanticQueries(formData);
      } catch (error) {
        toast({
          title: "Semantic queries not saved",
          description: error instanceof Error ? error.message : "The save request failed.",
          variant: "destructive",
        });
        return;
      }

      if (response.status === "error") {
        toast({
          title: "Semantic queries not saved",
          description: response.message,
          variant: "destructive",
        });
        return;
      }

      setRows(response.queries.map((query) => ({
        id: query.id,
        category: query.category ?? "",
        text: query.queryText,
      })));
      toast({
        title: "Live semantic queries saved",
        description: response.message,
      });
      router.refresh();
    });
  }

  if (campaigns.length === 0) {
    return (
      <section className="rounded-[24px] bg-[#181818] p-5 text-[14px] leading-6 text-[#cbcbcb] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
        No campaigns are available.
      </section>
    );
  }

  return (
    <form className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]" onSubmit={handleSubmit}>
      <section className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5 xl:max-h-[calc(100dvh-7rem)]">
        <div className="shrink-0 border-b border-[#27272a] pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Campaign</p>
          <h2 className="mt-2 text-[17px] font-bold text-[#ffffff]">Live query target</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="grid gap-4 pt-4">
            <label className="grid gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Campaign</span>
              <select
                className="h-11 w-full rounded-xl border border-[#27272a] bg-[#09090b] px-3 text-sm text-[#fafafa] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
                onChange={(event) => handleCampaignChange(event.target.value)}
                value={campaignId}
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedCampaign ? (
              <div className="rounded-[18px] bg-[#121212] p-4 text-[13px] leading-5 text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={selectedCampaign.leadType.toLowerCase()} />
                  <StatusPill label={selectedCampaign.isActive ? "active" : "paused"} />
                  <StatusPill label={`${rows.filter((row) => row.text.trim()).length} queries`} />
                </div>
                <p className="mt-3 truncate text-[#ffffff]">{selectedCampaign.name}</p>
                <p className="mt-1 text-[#b3b3b3]">{selectedCampaign.owner}</p>
                <p className="mt-3 text-[#b3b3b3]">{selectedCampaign.description || "No campaign description."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCampaign.subreddits.slice(0, 10).map((subreddit) => (
                    <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cbcbcb]" key={subreddit}>
                      r/{subreddit}
                    </span>
                  ))}
                  {selectedCampaign.subreddits.length > 10 ? (
                    <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cbcbcb]">
                      +{selectedCampaign.subreddits.length - 10}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 shrink-0 border-t border-[#27272a] pt-4">
          <Button
            className="w-full cursor-pointer rounded-full border-none bg-[#1ed760] text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving..." : "Save Live Queries"}
          </Button>
        </div>
      </section>

      <section className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5 xl:max-h-[calc(100dvh-7rem)]">
        <SemanticQueryDraftEditor
          disabled={isPending}
          emptyMessage="Add at least one semantic query before saving."
          eyebrow="Live queries"
          listClassName="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pt-4 pr-1"
          onChange={setRows}
          onClear={handleClearQueries}
          onCopy={handleCopyQueries}
          onReset={() => setRows(buildQueryRows(selectedCampaign))}
          rows={rows}
          title="Semantic worker set"
        />
      </section>
    </form>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      {label}
    </span>
  );
}

function buildQueryRows(campaign: CampaignOption | null): SemanticQueryDraftRow[] {
  return campaign?.semanticQueries.map((query) => ({
    id: query.id,
    category: query.category ?? "",
    text: query.queryText,
  })) ?? [];
}

async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the legacy copy path below.
    }
  }

  if (typeof document === "undefined" || !document.body) {
    return false;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}
