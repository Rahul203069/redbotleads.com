"use client";

import { Plus, Play, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";

import { startSemanticPlaygroundRun } from "@/app/(app)/admin/analytics/playground/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type CampaignOption = {
  id: string;
  name: string;
  leadType: "PRODUCT" | "SERVICE";
  description: string | null;
  isActive: boolean;
  subreddits: string[];
  semanticQueries: Array<{
    id: string;
    queryText: string;
    category: string | null;
  }>;
};

type QueryRow = {
  id: string;
  category: string;
  text: string;
};

export function SemanticPlaygroundForm({
  campaigns,
  defaultFetchedFrom,
  defaultFetchedTo,
  defaultThreshold,
  selectedCampaignId,
}: {
  campaigns: CampaignOption[];
  defaultFetchedFrom: string;
  defaultFetchedTo: string;
  defaultThreshold: number;
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
  const [rows, setRows] = useState<QueryRow[]>(() => buildQueryRows(selectedCampaign));
  const [fetchedFrom, setFetchedFrom] = useState(() => toLocalInputValue(defaultFetchedFrom));
  const [fetchedTo, setFetchedTo] = useState(() => toLocalInputValue(defaultFetchedTo));
  const [threshold, setThreshold] = useState(String(defaultThreshold));

  function handleCampaignChange(nextCampaignId: string) {
    const nextCampaign = campaigns.find((campaign) => campaign.id === nextCampaignId) ?? null;

    setCampaignId(nextCampaignId);
    setRows(buildQueryRows(nextCampaign));
    router.push(`/admin/analytics/playground?campaignId=${encodeURIComponent(nextCampaignId)}`);
  }

  function handleResetQueries() {
    setRows(buildQueryRows(selectedCampaign));
  }

  function handleAddQuery() {
    setRows((current) => [
      ...current,
      {
        id: createLocalId(),
        category: "",
        text: "",
      },
    ]);
  }

  function handleRemoveQuery(rowId: string) {
    setRows((current) => current.filter((row) => row.id !== rowId));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedRows = rows
      .map((row) => ({
        category: row.category.trim(),
        text: row.text.trim(),
      }))
      .filter((row) => row.text.length > 0);

    if (!campaignId || cleanedRows.length === 0) {
      toast({
        title: "Playground run not started",
        description: "Select a campaign and keep at least one semantic query.",
        variant: "destructive",
      });
      return;
    }

    const fromIso = localDateTimeToIso(fetchedFrom);
    const toIso = localDateTimeToIso(fetchedTo);

    if (!fromIso || !toIso || new Date(fromIso) >= new Date(toIso)) {
      toast({
        title: "Invalid time window",
        description: "Choose a valid fetched-time range before running the playground.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("fetchedFrom", fromIso);
    formData.set("fetchedTo", toIso);
    formData.set("threshold", threshold);
    formData.set("queriesJson", JSON.stringify(cleanedRows));

    startTransition(async () => {
      const result = await startSemanticPlaygroundRun(formData);

      if (result.status === "success" && result.runId) {
        toast({
          title: "Playground queued",
          description: result.message,
        });
        router.push(`/admin/analytics/playground?campaignId=${encodeURIComponent(campaignId)}&runId=${encodeURIComponent(result.runId)}`);
        router.refresh();
        return;
      }

      toast({
        title: "Could not start playground",
        description: result.message,
        variant: "destructive",
      });
      router.refresh();
    });
  }

  if (campaigns.length === 0) {
    return (
      <section className="rounded-[24px] bg-[#181818] p-5 text-[14px] leading-6 text-[#cbcbcb] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
        No campaigns are available for playground testing.
      </section>
    );
  }

  return (
    <form className="grid gap-5 xl:grid-cols-[0.8fr_1.25fr]" onSubmit={handleSubmit}>
      <section className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5 xl:max-h-[calc(100dvh-7rem)]">
        <div className="shrink-0 border-b border-[#27272a] pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Campaign</p>
          <h2 className="mt-2 text-[17px] font-bold text-[#ffffff]">Test target</h2>
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
                  <StatusPill label={`${selectedCampaign.semanticQueries.length} queries`} />
                </div>
                <p className="mt-3 text-[#b3b3b3]">{selectedCampaign.description || "No campaign description."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCampaign.subreddits.slice(0, 8).map((subreddit) => (
                    <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cbcbcb]" key={subreddit}>
                      r/{subreddit}
                    </span>
                  ))}
                  {selectedCampaign.subreddits.length > 8 ? (
                    <span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cbcbcb]">
                      +{selectedCampaign.subreddits.length - 8}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Fetched from</span>
                <Input
                  onChange={(event) => setFetchedFrom(event.target.value)}
                  type="datetime-local"
                  value={fetchedFrom}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Fetched to</span>
                <Input
                  onChange={(event) => setFetchedTo(event.target.value)}
                  type="datetime-local"
                  value={fetchedTo}
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Minimum semantic score</span>
              <Input
                max="1"
                min="0"
                onChange={(event) => setThreshold(event.target.value)}
                step="0.01"
                type="number"
                value={threshold}
              />
            </label>

            <Button
              className="rounded-full border-none bg-[#1ed760] text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              disabled={isPending}
              type="submit"
            >
              <Play className="h-4 w-4" />
              {isPending ? "Queueing..." : "Run Playground"}
            </Button>
          </div>
        </div>
      </section>

      <section className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5 xl:max-h-[calc(100dvh-7rem)]">
        <div className="flex shrink-0 flex-col gap-3 border-b border-[#27272a] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Draft queries</p>
            <h2 className="mt-2 text-[17px] font-bold text-[#ffffff]">Semantic test set</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={handleResetQueries} size="sm" type="button" variant="secondary">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button className="rounded-full" onClick={handleAddQuery} size="sm" type="button" variant="secondary">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pt-4 pr-1">
          {rows.map((row, index) => (
            <div className="rounded-[18px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]" key={row.id}>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-start">
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Query {index + 1}</span>
                  <Textarea
                    className="min-h-20 resize-y"
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) => (item.id === row.id ? { ...item, text: event.target.value } : item)),
                      )
                    }
                    value={row.text}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Category</span>
                  <Input
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) => (item.id === row.id ? { ...item, category: event.target.value } : item)),
                      )
                    }
                    value={row.category}
                  />
                </label>
                <Button
                  aria-label={`Remove query ${index + 1}`}
                  className="min-h-11 rounded-full md:mt-7"
                  onClick={() => handleRemoveQuery(row.id)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
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

function buildQueryRows(campaign: CampaignOption | null): QueryRow[] {
  const rows = campaign?.semanticQueries.map((query) => ({
    id: query.id,
    category: query.category ?? "",
    text: query.queryText,
  })) ?? [];

  return rows.length > 0
    ? rows
    : [
        {
          id: createLocalId(),
          category: "",
          text: "",
        },
      ];
}

function toLocalInputValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `query-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
