"use client";

import { BellOff, BellRing, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  setAdminCampaignNotificationsPaused,
  type CampaignNotificationsToggleResult,
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

type CampaignNotificationsToggleProps = {
  campaignId: string;
  campaignName: string;
  initialNotificationsPaused: boolean;
  presentation?: "compact" | "page";
};

export function CampaignNotificationsToggle({
  campaignId,
  campaignName,
  initialNotificationsPaused,
  presentation = "compact",
}: CampaignNotificationsToggleProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [notificationsPaused, setNotificationsPaused] = useState(initialNotificationsPaused);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const buttonSize = presentation === "page"
    ? "h-11 px-5 text-[11px] tracking-[0.16em]"
    : "h-11 px-3 text-[10px] tracking-[0.12em]";
  const iconSize = presentation === "page" ? "h-4 w-4" : "h-3.5 w-3.5";

  function submit(nextPaused: boolean) {
    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("notificationsPaused", String(nextPaused));

    startTransition(async () => {
      const result: CampaignNotificationsToggleResult = await setAdminCampaignNotificationsPaused(formData);

      if (result.status === "success" && typeof result.notificationsPaused === "boolean") {
        setNotificationsPaused(result.notificationsPaused);
        setOpen(false);
        toast({
          title: result.notificationsPaused ? "Notifications paused" : "Notifications resumed",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not update notifications",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  if (notificationsPaused) {
    return (
      <Button
        className={`${buttonSize} rounded-full border-none bg-[#12331f] font-bold uppercase text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#184429]`}
        disabled={isPending}
        onClick={() => submit(false)}
        type="button"
      >
        {isPending ? (
          <LoaderCircle aria-hidden="true" className={`${iconSize} animate-spin`} />
        ) : (
          <BellRing aria-hidden="true" className={iconSize} />
        )}
        {isPending ? "Resuming..." : "Resume notifications"}
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
          <BellOff aria-hidden="true" className={iconSize} />
          Pause notifications
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle>Pause notifications for {campaignName}?</DialogTitle>
            <DialogDescription>
              Telegram, Slack, and email alerts will stop for the campaign owner and every linked client account.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[16px] border border-[#522129] bg-[#2a1014] px-4 py-3 text-[13px] leading-5 text-[#f7b4bc]">
            Leads will keep collecting and remain visible. Queued alerts will be discarded and will not replay after you resume. An alert already being sent may finish.
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
            onClick={() => submit(true)}
            type="button"
          >
            {isPending ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <BellOff aria-hidden="true" className="h-4 w-4" />
            )}
            {isPending ? "Pausing..." : "Pause notifications"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
