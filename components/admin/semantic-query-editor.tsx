"use client";

import { ClipboardPaste, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";

import {
  saveCampaignSemanticQueries,
  type SaveCampaignSemanticQueriesResult,
} from "@/app/(app)/admin/analytics/semantic-queries/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

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

type QueryRow = {
  id: string;
  category: string;
  text: string;
};

type CleanQuery = {
  category: string;
  text: string;
};

const BULK_QUERY_SEPARATOR = ",,,";
const MAX_QUERY_COUNT = 100;
const MIN_QUERY_TEXT_LENGTH = 3;
const MAX_QUERY_TEXT_LENGTH = 700;
const MAX_QUERY_CATEGORY_LENGTH = 80;

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
  const [rows, setRows] = useState<QueryRow[]>(() => buildQueryRows(selectedCampaign));
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [bulkPasteValue, setBulkPasteValue] = useState("");

  function handleCampaignChange(nextCampaignId: string) {
    const nextCampaign = campaigns.find((campaign) => campaign.id === nextCampaignId) ?? null;

    setCampaignId(nextCampaignId);
    setRows(buildQueryRows(nextCampaign));
    router.push(`/admin/analytics/semantic-queries?campaignId=${encodeURIComponent(nextCampaignId)}`);
  }

  function handleAddQuery() {
    if (rows.length >= MAX_QUERY_COUNT) {
      toast({
        title: "Query limit reached",
        description: `Keep ${MAX_QUERY_COUNT} or fewer semantic queries.`,
        variant: "destructive",
      });
      return;
    }

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

  function handleResetQueries() {
    setRows(buildQueryRows(selectedCampaign));
  }

  function handleBulkPasteOpenChange(open: boolean) {
    setBulkPasteOpen(open);

    if (!open) {
      setBulkPasteValue("");
    }
  }

  function handleImportQueries() {
    const result = parseBulkQueryInput(bulkPasteValue);

    if (result.status === "error") {
      toast({
        title: "No valid semantic queries found",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    const mergedRows = cleanQueryRows([...rows, ...result.queries]);

    if (mergedRows.status === "error") {
      toast({
        title: "Semantic queries not imported",
        description: mergedRows.message,
        variant: "destructive",
      });
      return;
    }

    const existingCount = cleanQueryRows(rows);
    const currentCount = existingCount.status === "success" ? existingCount.queries.length : 0;
    const addedCount = Math.max(0, mergedRows.queries.length - currentCount);

    setRows(
      mergedRows.queries.map((query) => ({
        id: createLocalId(),
        category: query.category,
        text: query.text,
      })),
    );
    setBulkPasteOpen(false);
    setBulkPasteValue("");
    toast({
      title: "Semantic queries imported",
      description: `${addedCount} new semantic ${addedCount === 1 ? "query was" : "queries were"} added to the editor list.`,
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

    const result = cleanQueryRows(rows);

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

      setRows(
        response.queries.map((query) => ({
          id: query.id,
          category: query.category ?? "",
          text: query.queryText,
        })),
      );
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
    <>
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
              className="w-full rounded-full border-none bg-[#1ed760] text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Saving..." : "Save Live Queries"}
            </Button>
          </div>
        </section>

        <section className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5 xl:max-h-[calc(100dvh-7rem)]">
          <div className="flex shrink-0 flex-col gap-3 border-b border-[#27272a] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Live queries</p>
              <h2 className="mt-2 text-[17px] font-bold text-[#ffffff]">Semantic worker set</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" disabled={isPending} onClick={handleResetQueries} size="sm" type="button" variant="secondary">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button className="rounded-full" disabled={isPending} onClick={() => setBulkPasteOpen(true)} size="sm" type="button" variant="secondary">
                <ClipboardPaste className="h-4 w-4" />
                Bulk paste
              </Button>
              <Button className="rounded-full" disabled={isPending} onClick={handleAddQuery} size="sm" type="button" variant="secondary">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pt-4 pr-1">
            {rows.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[#3f3f46] bg-[#121212] p-4 text-[13px] leading-5 text-[#b3b3b3]">
                Add at least one semantic query before saving.
              </div>
            ) : (
              rows.map((row, index) => (
                <div className="rounded-[18px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]" key={row.id}>
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-start">
                    <label className="grid gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Query {index + 1}</span>
                      <Textarea
                        className="min-h-20 resize-y"
                        disabled={isPending}
                        maxLength={MAX_QUERY_TEXT_LENGTH}
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
                        disabled={isPending}
                        maxLength={MAX_QUERY_CATEGORY_LENGTH}
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
                      disabled={isPending}
                      onClick={() => handleRemoveQuery(row.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </form>

      <Dialog open={bulkPasteOpen} onOpenChange={handleBulkPasteOpenChange}>
        <DialogContent className="max-w-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-xl">Bulk paste semantic queries</DialogTitle>
            <DialogDescription>
              Add JSON or plain text queries separated by triple commas to the current editor list.
            </DialogDescription>
          </DialogHeader>

          <label className="mt-5 grid gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Queries</span>
            <Textarea
              className="max-h-[48dvh] min-h-[260px] resize-y font-mono text-[13px] leading-5"
              onChange={(event) => setBulkPasteValue(event.target.value)}
              placeholder={`{"semanticQueries":[{"category":"buyer-intent","text":"looking for a CRM recommendation"}]}

or
query one,,,query two`}
              value={bulkPasteValue}
            />
          </label>

          <DialogFooter className="mt-5 sm:justify-end">
            <Button onClick={() => handleBulkPasteOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              className="border-none bg-[#1ed760] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              onClick={handleImportQueries}
              type="button"
            >
              <ClipboardPaste className="h-4 w-4" />
              Import queries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  return campaign?.semanticQueries.map((query) => ({
    id: query.id,
    category: query.category ?? "",
    text: query.queryText,
  })) ?? [];
}

function parseBulkQueryInput(value: string): { status: "success"; queries: CleanQuery[] } | { status: "error"; message: string } {
  const input = value.trim();

  if (!input) {
    return {
      status: "error",
      message: "Paste JSON or plain text queries first.",
    };
  }

  const structuredInput = parseStructuredBulkQueryInput(input);

  if (structuredInput.status === "error") {
    return structuredInput;
  }

  const rows = structuredInput.status === "parsed"
    ? structuredInput.rows
    : input.split(BULK_QUERY_SEPARATOR).map((text) => ({
        category: "",
        text,
      }));

  return cleanQueryRows(rows);
}

function parseStructuredBulkQueryInput(
  input: string,
):
  | { status: "plainText" }
  | { status: "parsed"; rows: Array<Record<string, unknown>> }
  | { status: "error"; message: string } {
  if (!input.startsWith("{") && !input.startsWith("[")) {
    return { status: "plainText" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    return {
      status: "error",
      message: "The pasted JSON is not valid. Check the brackets, commas, and quotes.",
    };
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.semanticQueries)
      ? parsed.semanticQueries
      : null;

  if (!rows) {
    return {
      status: "error",
      message: "JSON must be an array, or an object with a semanticQueries array.",
    };
  }

  return {
    status: "parsed",
    rows: rows.filter(isRecord),
  };
}

function cleanQueryRows(rows: Array<{ category?: unknown; text?: unknown; queryText?: unknown }>): { status: "success"; queries: CleanQuery[] } | { status: "error"; message: string } {
  const cleanedRows: CleanQuery[] = [];
  const seenTexts = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const textValue = typeof row.text === "string" ? row.text : typeof row.queryText === "string" ? row.queryText : "";
    const categoryValue = typeof row.category === "string" ? row.category : "";
    const text = textValue.trim();
    const category = categoryValue.trim();

    if (!text) {
      continue;
    }

    if (text.length < MIN_QUERY_TEXT_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} must be at least ${MIN_QUERY_TEXT_LENGTH} characters.`,
      };
    }

    if (text.length > MAX_QUERY_TEXT_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} must be ${MAX_QUERY_TEXT_LENGTH} characters or less.`,
      };
    }

    if (category.length > MAX_QUERY_CATEGORY_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} category must be ${MAX_QUERY_CATEGORY_LENGTH} characters or less.`,
      };
    }

    const dedupeKey = text.replace(/\s+/g, " ").toLowerCase();

    if (seenTexts.has(dedupeKey)) {
      continue;
    }

    cleanedRows.push({
      category,
      text,
    });
    seenTexts.add(dedupeKey);
  }

  if (cleanedRows.length === 0) {
    return {
      status: "error",
      message: "Add at least one semantic query with 3 or more characters.",
    };
  }

  if (cleanedRows.length > MAX_QUERY_COUNT) {
    return {
      status: "error",
      message: `Keep ${MAX_QUERY_COUNT} or fewer semantic queries.`,
    };
  }

  return {
    status: "success",
    queries: cleanedRows,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `query-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
