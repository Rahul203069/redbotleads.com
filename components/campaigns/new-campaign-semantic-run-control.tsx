"use client";

import { BrainCircuit, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  getCampaignManualSemanticStatus,
  runNewCampaignSemanticOverride,
} from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { ManualCampaignSemanticState } from "@/lib/manual-campaign-semantic";

export function NewCampaignSemanticRunControl({
  campaignId,
  hideWhenComplete = false,
  initialState,
  surface = "compact",
}: {
  campaignId: string;
  hideWhenComplete?: boolean;
  initialState: ManualCampaignSemanticState;
  surface?: "compact" | "panel";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();
  const completionToastShown = useRef(initialState.status === "COMPLETED");
  const isRunning = state.status === "QUEUED" || state.status === "PROCESSING";

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    let cancelled = false;

    const poll = () => {
      startTransition(async () => {
        const nextState = await getCampaignManualSemanticStatus(campaignId);

        if (cancelled) {
          return;
        }

        setState(nextState);

        if (nextState.status === "COMPLETED") {
          router.refresh();

          if (!completionToastShown.current) {
            completionToastShown.current = true;
            toast({
              title: "Lead search complete",
              description: formatCompletionMessage(nextState),
            });
          }
        }
      });
    };

    poll();
    const intervalId = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [campaignId, isRunning, router, toast]);

  function handleRun() {
    startTransition(async () => {
      const result = await runNewCampaignSemanticOverride(campaignId);
      setState(result.state);

      toast({
        title: result.status === "success" ? "Lead search queued" : "Could not run lead search",
        description: result.message,
        variant: result.status === "success" ? "default" : "destructive",
      });
    });
  }

  if (hideWhenComplete && state.status === "COMPLETED") {
    return null;
  }

  const button = state.canRun ? (
    <Button
      className="w-full rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477] sm:w-auto"
      disabled={isPending}
      onClick={handleRun}
      type="button"
    >
      {state.status === "FAILED" ? <RefreshCw className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
      {isPending ? "Queueing..." : state.status === "FAILED" ? "Retry lead search" : "Run leads now"}
    </Button>
  ) : isRunning ? (
    <Button
      className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#cbcbcb] sm:w-auto"
      disabled
      type="button"
      variant="secondary"
    >
      <RefreshCw className="h-4 w-4 animate-spin" />
      {state.status === "PROCESSING" ? "Finding leads..." : "Queued..."}
    </Button>
  ) : state.status === "COMPLETED" ? (
    <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#73f5a0]">
      <CheckCircle2 className="h-4 w-4" />
      First search complete
    </span>
  ) : null;

  if (surface === "compact") {
    return button;
  }

  return (
    <div className="rounded-[22px] bg-[#121212] p-5 shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#fdfdfd]">
            {state.status === "COMPLETED" ? "Your first lead search is complete" : "Want to see leads immediately?"}
          </p>
          <p className="mt-1 max-w-xl text-[12px] leading-5 text-[#b3b3b3]">{state.message}</p>
          {state.stats ? (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#73f5a0]">
              {state.stats.matchedPosts ?? 0} matched / {state.stats.classifiedLeads ?? 0} classified / {state.stats.strongLeads ?? 0} strong
            </p>
          ) : null}
        </div>
        <div className="shrink-0">{button}</div>
      </div>
    </div>
  );
}

function formatCompletionMessage(state: ManualCampaignSemanticState) {
  if (!state.stats) {
    return state.message;
  }

  return `${state.stats.classifiedLeads ?? 0} leads classified, including ${state.stats.strongLeads ?? 0} strong matches.`;
}
