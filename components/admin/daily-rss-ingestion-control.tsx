"use client";

import { Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  pauseDailySubredditIngestion,
  resumeDailySubredditIngestion,
} from "@/app/(app)/admin/analytics/actions";
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
import type { DailyRssPollerPauseState } from "@/lib/daily-rss-poller-control";

type DailyRssIngestionControlProps = {
  initialState: DailyRssPollerPauseState;
};

export function DailyRssIngestionControl({ initialState }: DailyRssIngestionControlProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState(initialState);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handlePause() {
    startTransition(async () => {
      const result = await pauseDailySubredditIngestion();

      if (result.status === "success" && result.state) {
        setState(result.state);
        setOpen(false);
        toast({
          title: "Daily RSS paused",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not pause daily RSS",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  function handleResume() {
    startTransition(async () => {
      const result = await resumeDailySubredditIngestion();

      if (result.status === "success" && result.state) {
        setState(result.state);
        toast({
          title: "Daily RSS resumed",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not resume daily RSS",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  if (state.paused) {
    return (
      <div className="grid gap-2">
        <Button
          className="w-full rounded-full border-none bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477] sm:w-auto"
          disabled={isPending}
          onClick={handleResume}
          type="button"
        >
          <Play className="h-4 w-4" />
          {isPending ? "Resuming..." : "Resume Daily RSS"}
        </Button>
        <p className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f2c94c]">
          Daily RSS paused
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger asChild>
          <Button
            className="w-full rounded-full border-none bg-[#2a1014] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#f3727f] shadow-[rgb(42,16,20)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#3a151b] sm:w-auto"
            disabled={isPending}
            type="button"
            variant="secondary"
          >
            <Pause className="h-4 w-4" />
            Pause Daily RSS
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <div className="space-y-5 p-6">
            <DialogHeader>
              <DialogTitle>Pause daily subreddit ingestion?</DialogTitle>
              <DialogDescription>
                This pauses only the 24/7 daily subreddit RSS poller. Campaign sync and manual test runs will still fetch Reddit RSS.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-[16px] border border-[#522129] bg-[#2a1014] px-4 py-3 text-[13px] leading-5 text-[#f7b4bc]">
              If a subreddit fetch is already running, that request may finish. The next daily subreddit poll will wait until you resume.
            </div>
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
              onClick={handlePause}
              type="button"
            >
              {isPending ? "Pausing..." : "Pause daily RSS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">
        Daily RSS active
      </p>
    </div>
  );
}
