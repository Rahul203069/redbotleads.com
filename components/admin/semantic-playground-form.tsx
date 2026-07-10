"use client";

import { ClipboardPaste, Copy, Plus, Play, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState, useTransition } from "react";

import { startSemanticPlaygroundRun } from "@/app/(app)/admin/analytics/playground/actions";
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
const MAX_QUERY_TEXT_LENGTH = 700;
const MAX_QUERY_CATEGORY_LENGTH = 80;
const MAX_RUN_TITLE_LENGTH = 120;
const MAX_RUN_DESCRIPTION_LENGTH = 1000;

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
  const activeSubmitSignatureRef = useRef<string | null>(null);
  const [campaignId, setCampaignId] = useState(selectedCampaignId ?? campaigns[0]?.id ?? "");
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === campaignId) ?? null,
    [campaignId, campaigns],
  );
  const [runTitle, setRunTitle] = useState("");
  const [runDescription, setRunDescription] = useState("");
  const [rows, setRows] = useState<QueryRow[]>(() => buildQueryRows(selectedCampaign));
  const [fetchedFrom, setFetchedFrom] = useState(() => toLocalInputValue(defaultFetchedFrom));
  const [fetchedTo, setFetchedTo] = useState(() => toLocalInputValue(defaultFetchedTo));
  const [threshold, setThreshold] = useState(String(defaultThreshold));
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [bulkPasteValue, setBulkPasteValue] = useState("");
  const [activeSubmitSignature, setActiveSubmitSignature] = useState<string | null>(null);
  const isSubmitPending = isPending || activeSubmitSignature !== null;

  function handleCampaignChange(nextCampaignId: string) {
    const nextCampaign = campaigns.find((campaign) => campaign.id === nextCampaignId) ?? null;

    setCampaignId(nextCampaignId);
    setRows(buildQueryRows(nextCampaign));
    router.push(`/admin/analytics/playground?campaignId=${encodeURIComponent(nextCampaignId)}`);
  }

  function handleResetQueries() {
    setRows(buildQueryRows(selectedCampaign));
  }

  function handleClearQueries() {
    setRows([]);
    toast({
      title: "Semantic test set cleared",
      description: "Add or bulk paste semantic queries before running the playground.",
    });
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

  async function handleCopyQueries() {
    const cleanedRows = cleanQueryRows(rows);

    if (cleanedRows.length === 0) {
      toast({
        title: "No semantic queries to copy",
        description: "Keep at least one valid query in the test set.",
        variant: "destructive",
      });
      return;
    }

    const copied = await copyTextToClipboard(
      JSON.stringify(
        {
          semanticQueries: cleanedRows,
        },
        null,
        2,
      ),
    );

    toast({
      title: copied ? "Semantic queries copied" : "Could not copy semantic queries",
      description: copied
        ? `Copied ${cleanedRows.length} semantic ${cleanedRows.length === 1 ? "query" : "queries"} as JSON.`
        : "Your browser blocked clipboard access. Try copying again.",
      variant: copied ? undefined : "destructive",
    });
  }

  function handleBulkPasteOpenChange(open: boolean) {
    setBulkPasteOpen(open);

    if (!open) {
      setBulkPasteValue("");
    }
  }

  function handleImportQueries() {
    const result = parseBulkQueryInput(bulkPasteValue);

    if (result.error || result.queries.length === 0) {
      toast({
        title: "No valid semantic queries found",
        description: result.error ?? "Paste JSON or plain text queries separated with triple commas.",
        variant: "destructive",
      });
      return;
    }

    setRows(
      result.queries.map((query) => ({
        id: createLocalId(),
        category: query.category,
        text: query.text,
      })),
    );
    setBulkPasteOpen(false);
    setBulkPasteValue("");
    toast({
      title: "Semantic queries imported",
      description: `${result.queries.length} semantic ${result.queries.length === 1 ? "query" : "queries"} replaced the current test set.`,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedRunTitle = runTitle.trim();
    const cleanedRunDescription = runDescription.trim();
    const cleanedRows = cleanQueryRows(rows);

    if (cleanedRunTitle.length < 2) {
      toast({
        title: "Playground run not started",
        description: "Add a playground run title.",
        variant: "destructive",
      });
      return;
    }

    if (cleanedRunTitle.length > MAX_RUN_TITLE_LENGTH) {
      toast({
        title: "Playground run not started",
        description: `Title must be ${MAX_RUN_TITLE_LENGTH} characters or less.`,
        variant: "destructive",
      });
      return;
    }

    if (cleanedRunDescription.length < 3) {
      toast({
        title: "Playground run not started",
        description: "Add a playground run description.",
        variant: "destructive",
      });
      return;
    }

    if (cleanedRunDescription.length > MAX_RUN_DESCRIPTION_LENGTH) {
      toast({
        title: "Playground run not started",
        description: `Description must be ${MAX_RUN_DESCRIPTION_LENGTH} characters or less.`,
        variant: "destructive",
      });
      return;
    }

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

    const submitSignature = buildSubmitSignature({
      campaignId,
      description: cleanedRunDescription,
      fetchedFrom: fromIso,
      fetchedTo: toIso,
      queries: cleanedRows,
      threshold,
      title: cleanedRunTitle,
    });

    if (activeSubmitSignatureRef.current === submitSignature) {
      toast({
        title: "Playground already starting",
        description: "This exact test configuration is already being queued.",
      });
      return;
    }

    activeSubmitSignatureRef.current = submitSignature;
    setActiveSubmitSignature(submitSignature);

    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("description", cleanedRunDescription);
    formData.set("fetchedFrom", fromIso);
    formData.set("fetchedTo", toIso);
    formData.set("threshold", threshold);
    formData.set("title", cleanedRunTitle);
    formData.set("queriesJson", JSON.stringify(cleanedRows));

    startTransition(async () => {
      let navigatedToRun = false;

      try {
        const result = await startSemanticPlaygroundRun(formData);

        if (result.runId) {
          toast({
            title: result.status === "success" ? "Playground queued" : "Could not queue playground",
            description: result.message,
            variant: result.status === "success" ? undefined : "destructive",
          });
          navigatedToRun = true;
          setRunTitle("");
          setRunDescription("");
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
      } catch (error) {
        toast({
          title: "Could not start playground",
          description: error instanceof Error ? error.message : "The playground request failed.",
          variant: "destructive",
        });
        router.refresh();
      } finally {
        if (!navigatedToRun) {
          activeSubmitSignatureRef.current = null;
          setActiveSubmitSignature(null);
        }
      }
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
    <>
      <form className="grid gap-5 xl:grid-cols-[0.8fr_1.25fr]" onSubmit={handleSubmit}>
        <section className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5 xl:max-h-[calc(100dvh-7rem)]">
          <div className="shrink-0 border-b border-[#27272a] pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Campaign</p>
            <h2 className="mt-2 text-[17px] font-bold text-[#ffffff]">Test target</h2>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="grid gap-4 pt-4">
              <label className="grid gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Run title</span>
                <Input
                  disabled={isSubmitPending}
                  maxLength={MAX_RUN_TITLE_LENGTH}
                  onChange={(event) => setRunTitle(event.target.value)}
                  required
                  value={runTitle}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Run description</span>
                <Textarea
                  className="min-h-24 resize-y"
                  disabled={isSubmitPending}
                  maxLength={MAX_RUN_DESCRIPTION_LENGTH}
                  onChange={(event) => setRunDescription(event.target.value)}
                  required
                  value={runDescription}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Campaign</span>
                <select
                  className="h-11 w-full rounded-xl border border-[#27272a] bg-[#09090b] px-3 text-sm text-[#fafafa] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
                  disabled={isSubmitPending}
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
                    disabled={isSubmitPending}
                    onChange={(event) => setFetchedFrom(event.target.value)}
                    type="datetime-local"
                    value={fetchedFrom}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Fetched to</span>
                  <Input
                    disabled={isSubmitPending}
                    onChange={(event) => setFetchedTo(event.target.value)}
                    type="datetime-local"
                    value={fetchedTo}
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Minimum semantic score</span>
                <Input
                  disabled={isSubmitPending}
                  max="1"
                  min="0"
                  onChange={(event) => setThreshold(event.target.value)}
                  step="0.01"
                  type="number"
                  value={threshold}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 shrink-0 border-t border-[#27272a] pt-4">
            <Button
              className="w-full rounded-full border-none bg-[#1ed760] text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              disabled={isSubmitPending}
              type="submit"
            >
              <Play className="h-4 w-4" />
              {isSubmitPending ? "Queueing..." : "Run Playground"}
            </Button>
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
              <Button className="rounded-full" disabled={rows.length === 0} onClick={handleClearQueries} size="sm" type="button" variant="secondary">
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>
              <Button className="rounded-full" onClick={handleCopyQueries} size="sm" type="button" variant="secondary">
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button className="rounded-full" onClick={() => setBulkPasteOpen(true)} size="sm" type="button" variant="secondary">
                <ClipboardPaste className="h-4 w-4" />
                Bulk paste
              </Button>
              <Button className="rounded-full" onClick={handleAddQuery} size="sm" type="button" variant="secondary">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pt-4 pr-1">
            {rows.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[#3f3f46] bg-[#121212] p-4 text-[13px] leading-5 text-[#b3b3b3]">
                No draft semantic queries. Add a query or bulk paste a test set before running the playground.
              </div>
            ) : (
              rows.map((row, index) => (
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
              Replace the current test set with JSON or plain text queries separated by triple commas.
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

function parseBulkQueryInput(value: string): { queries: CleanQuery[]; error?: string } {
  const input = value.trim();

  if (!input) {
    return {
      queries: [],
      error: "Paste JSON or plain text queries first.",
    };
  }

  const structuredInput = parseStructuredBulkQueryInput(input);

  if (structuredInput.status === "error") {
    return {
      queries: [],
      error: structuredInput.message,
    };
  }

  if (structuredInput.status === "parsed") {
    const queries = cleanQueryRows(structuredInput.rows);

    return {
      queries,
      error: queries.length === 0 ? "The pasted JSON did not include any valid query text." : undefined,
    };
  }

  const queries = cleanQueryRows(
    input.split(BULK_QUERY_SEPARATOR).map((text) => ({
      category: "",
      text,
    })),
  );

  return {
    queries,
    error: queries.length === 0 ? "Plain text queries must include at least 3 characters." : undefined,
  };
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

function cleanQueryRows(rows: Array<{ category?: unknown; text?: unknown; queryText?: unknown }>): CleanQuery[] {
  const cleanedRows: CleanQuery[] = [];
  const seenTexts = new Set<string>();

  for (const row of rows) {
    const textValue = typeof row.text === "string" ? row.text : typeof row.queryText === "string" ? row.queryText : "";
    const categoryValue = typeof row.category === "string" ? row.category : "";
    const text = textValue.trim().slice(0, MAX_QUERY_TEXT_LENGTH).trim();

    if (text.length < 3) {
      continue;
    }

    const dedupeKey = text.replace(/\s+/g, " ").toLowerCase();

    if (seenTexts.has(dedupeKey)) {
      continue;
    }

    cleanedRows.push({
      category: categoryValue.trim().slice(0, MAX_QUERY_CATEGORY_LENGTH),
      text,
    });
    seenTexts.add(dedupeKey);

    if (cleanedRows.length >= MAX_QUERY_COUNT) {
      break;
    }
  }

  return cleanedRows;
}

function buildSubmitSignature({
  campaignId,
  description,
  fetchedFrom,
  fetchedTo,
  queries,
  threshold,
  title,
}: {
  campaignId: string;
  description: string;
  fetchedFrom: string;
  fetchedTo: string;
  queries: CleanQuery[];
  threshold: string;
  title: string;
}) {
  return JSON.stringify({
    campaignId,
    description,
    fetchedFrom,
    fetchedTo,
    queries,
    threshold: threshold.trim(),
    title,
  });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
