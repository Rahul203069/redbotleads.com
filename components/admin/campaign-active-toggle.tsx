"use client";

import { Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setAdminCampaignActiveState } from "@/app/(app)/admin/analytics/actions";
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

type CampaignActiveToggleProps = {
  campaignId: string;
  campaignName: string;
  initialIsActive: boolean;
  presentation?: "compact" | "page";
};

export function CampaignActiveToggle({
  campaignId,
  campaignName,
  initialIsActive,
  presentation = "compact",
}: CampaignActiveToggleProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(initialIsActive);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(nextIsActive: boolean) {
    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("isActive", String(nextIsActive));

    startTransition(async () => {
      const result = await setAdminCampaignActiveState(formData);

      if (result.status === "success" && typeof result.isActive === "boolean") {
        setIsActive(result.isActive);
        setOpen(false);
        toast({
          title: result.isActive ? "Campaign activated" : "Campaign paused",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not update campaign",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  if (!isActive) {
    return (
      <Button
        className={`${
          presentation === "page"
            ? "h-11 px-5 text-[11px] tracking-[0.16em]"
            : "h-8 px-3 text-[10px] tracking-[0.12em]"
        } rounded-full border-none bg-[#1ed760] font-bold uppercase text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] transition-colors hover:bg-[#3be477]`}
        disabled={isPending}
        onClick={() => submit(true)}
        type="button"
      >
        <Play className={presentation === "page" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {isPending ? "Activating" : "Activate"}
      </Button>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className={`${
            presentation === "page"
              ? "h-11 px-5 text-[11px] tracking-[0.16em]"
              : "h-8 px-3 text-[10px] tracking-[0.12em]"
          } rounded-full border-none bg-[#2a1014] font-bold uppercase text-[#f3727f] shadow-[rgb(42,16,20)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#3a151b]`}
          disabled={isPending}
          type="button"
          variant="secondary"
        >
          <Pause className={presentation === "page" ? "h-4 w-4" : "h-3.5 w-3.5"} />
          Pause
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle>Pause {campaignName}?</DialogTitle>
            <DialogDescription>
              Daily subreddit ingestion and daily semantic search will skip this campaign while it is inactive.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[16px] border border-[#522129] bg-[#2a1014] px-4 py-3 text-[13px] leading-5 text-[#f7b4bc]">
            Manual campaign sync also skips inactive campaigns. Activate the campaign again before running a test sync for it.
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
            onClick={() => submit(false)}
            type="button"
          >
            {isPending ? "Pausing..." : "Pause campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
