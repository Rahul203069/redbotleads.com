"use client";

import { LoaderCircle, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  setAdminCampaignRssPollingState,
  type CampaignRssPollingToggleResult,
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

type CampaignRssPollingToggleProps = {
  campaignId: string;
  campaignName: string;
  initialRssPollingEnabled: boolean;
  presentation?: "compact" | "page";
  subredditCount: number;
};

export function CampaignRssPollingToggle({
  campaignId,
  campaignName,
  initialRssPollingEnabled,
  presentation = "compact",
  subredditCount,
}: CampaignRssPollingToggleProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [rssPollingEnabled, setRssPollingEnabled] = useState(initialRssPollingEnabled);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(nextEnabled: boolean) {
    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("rssPollingEnabled", String(nextEnabled));

    startTransition(async () => {
      const result: CampaignRssPollingToggleResult = await setAdminCampaignRssPollingState(formData);

      if (result.status === "success" && typeof result.rssPollingEnabled === "boolean") {
        setRssPollingEnabled(result.rssPollingEnabled);
        setOpen(false);
        toast({
          title: result.rssPollingEnabled ? "RSS fetching resumed" : "RSS fetching paused",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not update RSS fetching",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  const buttonSize = presentation === "page"
    ? "h-11 px-5 text-[11px] tracking-[0.16em]"
    : "h-11 px-3 text-[10px] tracking-[0.12em]";
  const iconSize = presentation === "page" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (!rssPollingEnabled) {
    return (
      <Button
        className={`${buttonSize} rounded-full border-none bg-[#12331f] font-bold uppercase text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#184429]`}
        disabled={isPending}
        onClick={() => submit(true)}
        type="button"
      >
        {isPending ? (
          <LoaderCircle aria-hidden="true" className={`${iconSize} animate-spin`} />
        ) : (
          <Play aria-hidden="true" className={iconSize} />
        )}
        {isPending ? "Resuming..." : "Resume fetching"}
      </Button>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className={`${buttonSize} rounded-full border-none bg-[#2a1014] font-bold uppercase text-[#f3727f] shadow-[rgb(42,16,20)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#3a151b]`}
          disabled={isPending}
          type="button"
          variant="secondary"
        >
          <Pause aria-hidden="true" className={iconSize} />
          Pause fetching
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle>Pause subreddit fetching for {campaignName}?</DialogTitle>
            <DialogDescription>
              This campaign&apos;s {subredditCount} linked subreddit{subredditCount === 1 ? "" : "s"} will stop contributing to future RSS refill cycles.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[16px] border border-[#522129] bg-[#2a1014] px-4 py-3 text-[13px] leading-5 text-[#f7b4bc]">
            Already queued or running requests may finish. A shared subreddit will remain fetched when another RSS-enabled campaign still uses it.
          </div>
        </div>

        <DialogFooter className="border-t border-[#27272a] p-4">
          <Button
            className="h-11 rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525]"
            disabled={isPending}
            onClick={() => setOpen(false)}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            className="h-11 rounded-full border-none bg-[#f3727f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-[rgba(243,114,127,0.2)_0px_8px_24px] hover:bg-[#ff8a96]"
            disabled={isPending}
            onClick={() => submit(false)}
            type="button"
          >
            {isPending ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Pause aria-hidden="true" className="h-4 w-4" />
            )}
            {isPending ? "Pausing..." : "Pause fetching"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
