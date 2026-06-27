"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  removeSubredditFromCombinedReport,
  type RemoveSubredditFromCombinedReportResult,
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

type RemoveSubredditFromReportButtonProps = {
  affectedCampaigns: number;
  reportName: string;
  subreddit: string;
};

export function RemoveSubredditFromReportButton({
  affectedCampaigns,
  reportName,
  subreddit,
}: RemoveSubredditFromReportButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    const formData = new FormData();
    formData.set("reportName", reportName);
    formData.set("subreddit", subreddit);

    startTransition(async () => {
      const result: RemoveSubredditFromCombinedReportResult = await removeSubredditFromCombinedReport(formData);

      if (result.status === "success") {
        toast({
          title: "Subreddit removed",
          description: result.message,
        });
        setOpen(false);
        router.refresh();
        return;
      }

      toast({
        title: "Could not remove subreddit",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="h-9 rounded-full border-none bg-[#2a1014] px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f3727f] shadow-[rgb(42,16,20)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#3a151b]"
          type="button"
          variant="secondary"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle>Delete r/{subreddit} from this report?</DialogTitle>
            <DialogDescription>
              This removes r/{subreddit} from {affectedCampaigns} matched campaign{affectedCampaigns === 1 ? "" : "s"}.
              Daily RSS polling will stop using it for those campaigns.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[16px] border border-[#522129] bg-[#2a1014] px-4 py-3 text-[13px] leading-5 text-[#f7b4bc]">
            Existing Reddit posts, leads, classifications, and RSS logs will stay in the database.
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
            onClick={handleRemove}
            type="button"
          >
            {isPending ? "Deleting..." : "Delete subreddit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
