"use client";

import { Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  setSubredditDailyRssPollingState,
  type SetSubredditDailyRssPollingResult,
} from "@/app/(app)/admin/analytics/subreddit-performance/actions";
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
import { useToast } from "@/components/ui/use-toast";

type SubredditPollingToggleButtonProps = {
  disabledAt?: string | null;
  disabledBy?: string | null;
  initialEnabled: boolean;
  reportName: string;
  subreddit: string;
};

export function SubredditPollingToggleButton({
  disabledAt,
  disabledBy,
  initialEnabled,
  reportName,
  subreddit,
}: SubredditPollingToggleButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(nextEnabled: boolean) {
    const formData = new FormData();
    formData.set("enabled", String(nextEnabled));
    formData.set("reportName", reportName);
    formData.set("subreddit", subreddit);

    startTransition(async () => {
      const result: SetSubredditDailyRssPollingResult = await setSubredditDailyRssPollingState(formData);

      if (result.status === "success" && result.state) {
        setEnabled(result.state.enabled);
        setOpen(false);
        toast({
          title: result.state.enabled ? "Polling enabled" : "Polling disabled",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not update polling",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  if (!enabled) {
    return (
      <Button
        className="h-9 rounded-full border-none bg-[#1ed760] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
        disabled={isPending}
        onClick={() => submit(true)}
        type="button"
      >
        <Play className="h-3.5 w-3.5" />
        {isPending ? "Enabling" : "Enable polling"}
      </Button>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="h-9 rounded-full border-none bg-[#2a1014] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f3727f] shadow-[rgb(42,16,20)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#3a151b]"
          disabled={isPending}
          type="button"
          variant="secondary"
        >
          <Pause className="h-3.5 w-3.5" />
          Disable polling
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle>Disable daily RSS polling for r/{subreddit}?</DialogTitle>
            <DialogDescription>
              Daily RSS polling will skip r/{subreddit} across all campaigns. This does not remove it from campaign settings.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[16px] border border-[#522129] bg-[#2a1014] px-4 py-3 text-[13px] leading-5 text-[#f7b4bc]">
            Existing Reddit posts, leads, classifications, and RSS logs will stay in the database. Any pending fetch jobs
            for this subreddit will be removed when possible.
          </div>

          {disabledAt || disabledBy ? (
            <p className="text-[12px] leading-5 text-[#b3b3b3]">
              Current disabled record: {disabledAt ? formatDate(disabledAt) : "unknown time"}
              {disabledBy ? ` by ${disabledBy}` : ""}.
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
            className="rounded-full border-none bg-[#f3727f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-[rgba(243,114,127,0.2)_0px_8px_24px] hover:bg-[#ff8a96]"
            disabled={isPending}
            onClick={() => submit(false)}
            type="button"
          >
            {isPending ? "Disabling..." : "Disable polling"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
