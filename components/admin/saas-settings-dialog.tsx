"use client";

import { Settings2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { updateSaasSettings, type AdminSettingsActionState } from "@/actions/admin-settings";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { LEAD_SCORING_MODEL_OPTIONS, formatModelPrice, type LeadScoringModelId } from "@/lib/openai-models";
import { MAX_SUBREDDIT_SUGGESTION_COUNT, MIN_SUBREDDIT_SUGGESTION_COUNT } from "@/lib/saas-config-constants";

const initialState: AdminSettingsActionState = {
  status: "idle",
};

export function SaasSettingsDialog({
  leadScoringModel,
  subredditSuggestionCount,
}: {
  leadScoringModel: LeadScoringModelId;
  subredditSuggestionCount: number;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateSaasSettings, initialState);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast({
        title: "Settings saved",
        description: state.message,
      });
      setOpen(false);
    }

    if (state.status === "error" && state.message) {
      toast({
        title: "Could not save settings",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full rounded-full border-none bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
          type="button"
          variant="secondary"
        >
          <Settings2 className="h-4 w-4" />
          SaaS Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form action={formAction}>
          <div className="space-y-6 p-6">
            <DialogHeader>
              <DialogTitle>SaaS Settings</DialogTitle>
              <DialogDescription>
                Control global lead generation settings used by the app and worker.
              </DialogDescription>
            </DialogHeader>

            <label className="grid gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                Subreddit suggestions
              </span>
              <Input
                defaultValue={subredditSuggestionCount}
                max={MAX_SUBREDDIT_SUGGESTION_COUNT}
                min={MIN_SUBREDDIT_SUGGESTION_COUNT}
                name="subredditSuggestionCount"
                type="number"
              />
              <span className="text-[12px] leading-5 text-[#b3b3b3]">
                Allowed range: {MIN_SUBREDDIT_SUGGESTION_COUNT}-{MAX_SUBREDDIT_SUGGESTION_COUNT}.
              </span>
            </label>

            <div className="grid gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                  Lead scoring model
                </div>
                <div className="mt-1 text-[13px] leading-5 text-[#b3b3b3]">
                  New worker classification calls use the saved model.
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {LEAD_SCORING_MODEL_OPTIONS.map((model) => (
                  <label
                    className="min-h-[112px] cursor-pointer rounded-[16px] bg-[#121212] p-4 text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#1f1f1f]"
                    key={model.id}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        className="mt-1 h-4 w-4 border-[#27272a] bg-[#121212] accent-[#1ed760]"
                        defaultChecked={leadScoringModel === model.id}
                        name="leadScoringModel"
                        type="radio"
                        value={model.id}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#ffffff]">{model.label}</div>
                        <div className="mt-2 grid gap-1 text-[12px] leading-5 text-[#b3b3b3]">
                          <span>Input {formatModelPrice(model.inputPerMillion)}</span>
                          <span>Output {formatModelPrice(model.outputPerMillion)}</span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {state.status === "error" && state.message ? (
              <p className="rounded-[14px] bg-[#2a1014] px-3 py-2 text-[13px] leading-5 text-[#f3727f]">
                {state.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-[#27272a] p-4">
            <Button
              className="rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525]"
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
