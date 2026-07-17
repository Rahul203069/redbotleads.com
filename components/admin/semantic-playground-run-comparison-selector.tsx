"use client";

import { BarChart3, Check, GitCompareArrows } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type PlaygroundComparisonRunOption = {
  candidateScope: string;
  createdAt: string;
  id: string;
  queryCount: number;
  strongLeads: number;
  threshold: number;
  title: string;
  totalLeads: number;
};

const MIN_SELECTED_RUNS = 2;
const MAX_SELECTED_RUNS = 4;

export function SemanticPlaygroundRunComparisonSelector({
  runs,
}: {
  runs: PlaygroundComparisonRunOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const canCompare = selectedRunIds.length >= MIN_SELECTED_RUNS && selectedRunIds.length <= MAX_SELECTED_RUNS;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setSelectionError(null);
    }
  }

  function handleToggle(runId: string, checked: boolean) {
    setSelectionError(null);

    if (!checked) {
      setSelectedRunIds((current) => current.filter((id) => id !== runId));
      return;
    }

    if (selectedRunIds.length >= MAX_SELECTED_RUNS) {
      setSelectionError("You can compare up to four runs at a time.");
      return;
    }

    setSelectedRunIds((current) => current.includes(runId) ? current : [...current, runId]);
  }

  function handleCompare() {
    if (!canCompare) {
      setSelectionError("Select at least two completed runs to compare.");
      return;
    }

    router.push(`/admin/analytics/playground/compare?runIds=${encodeURIComponent(selectedRunIds.join(","))}`);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          className="rounded-full border border-white/[0.08] bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffffff] hover:bg-[#292929]"
          disabled={runs.length < MIN_SELECTED_RUNS}
          type="button"
          variant="secondary"
        >
          <GitCompareArrows className="h-4 w-4" />
          Compare runs
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[86dvh] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-white/[0.06] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#1ed760]/10 text-[#55e982]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Compare playground runs</DialogTitle>
              <DialogDescription className="mt-1.5">
                Select two to four completed runs from this campaign. Shared and unique leads are matched by the exact Reddit item.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-[#111111] px-4 py-3">
            <div>
              <p className="text-[11px] font-bold text-[#ffffff]">{selectedRunIds.length} of {MAX_SELECTED_RUNS} selected</p>
              <p className="mt-1 text-[11px] text-[#8f8f8f]">Qualified lead overlap uses LLM score 50 or higher.</p>
            </div>
            {selectedRunIds.length > 0 ? (
              <button
                className="min-h-8 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a1a1aa] transition-colors hover:bg-[#252525] hover:text-[#ffffff]"
                onClick={() => {
                  setSelectedRunIds([]);
                  setSelectionError(null);
                }}
                type="button"
              >
                Clear selection
              </button>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {runs.map((run) => {
              const selected = selectedRunIds.includes(run.id);

              return (
                <label
                  className={`relative cursor-pointer rounded-[16px] border p-4 transition-colors ${
                    selected
                      ? "border-[#1ed760]/45 bg-[#1ed760]/[0.07]"
                      : "border-white/[0.06] bg-[#151515] hover:border-white/[0.12] hover:bg-[#1a1a1a]"
                  }`}
                  key={run.id}
                >
                  <input
                    checked={selected}
                    className="sr-only"
                    onChange={(event) => handleToggle(run.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border ${
                    selected ? "border-[#1ed760] bg-[#1ed760] text-[#0d160f]" : "border-white/[0.12] bg-[#202020] text-transparent"
                  }`}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div className="pr-8">
                    <p className="truncate text-[13px] font-bold text-[#ffffff]">{run.title}</p>
                    <p className="mt-1 text-[11px] text-[#737373]">{formatDate(run.createdAt)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Pill label={run.candidateScope} />
                    <Pill label={`min ${run.threshold.toFixed(2)}`} />
                    <Pill label={`${run.queryCount} queries`} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Metric label="Qualified" value={run.totalLeads} />
                    <Metric label="Strong" value={run.strongLeads} />
                  </div>
                </label>
              );
            })}
          </div>

          {selectionError ? (
            <p className="mt-4 rounded-[14px] border border-[#f3727f]/25 bg-[#3a151b] px-4 py-3 text-[12px] leading-5 text-[#ff9aa5]" role="alert">
              {selectionError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-white/[0.06] p-4 sm:p-5">
          <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            className="border-none bg-[#1ed760] text-[#0d160f] hover:bg-[#3be477]"
            disabled={!canCompare}
            onClick={handleCompare}
            type="button"
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare {selectedRunIds.length || ""} runs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pill({ label }: { label: string }) {
  return <span className="rounded-full bg-[#242424] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#a1a1aa]">{label}</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[11px] border border-white/[0.05] bg-black/20 px-3 py-2">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p className="mt-1 text-[15px] font-bold text-[#f4f4f5]">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
