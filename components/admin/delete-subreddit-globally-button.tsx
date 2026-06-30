"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteSubredditGlobally,
  type DeleteSubredditGloballyResult,
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

type DeleteSubredditGloballyButtonProps = {
  affectedCampaigns: number;
  subreddit: string;
};

export function DeleteSubredditGloballyButton({
  affectedCampaigns,
  subreddit,
}: DeleteSubredditGloballyButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("subreddit", subreddit);

    startTransition(async () => {
      const result: DeleteSubredditGloballyResult = await deleteSubredditGlobally(formData);

      if (result.status === "success") {
        toast({
          title: "Subreddit deleted",
          description: result.message,
        });
        setOpen(false);
        router.refresh();
        return;
      }

      toast({
        title: "Could not delete subreddit",
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
          disabled={isPending}
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
            <DialogTitle>Delete r/{subreddit} from all campaigns?</DialogTitle>
            <DialogDescription>
              This removes r/{subreddit} from {affectedCampaigns} campaign{affectedCampaigns === 1 ? "" : "s"} and
              disables daily RSS polling for it.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[16px] border border-[#522129] bg-[#2a1014] px-4 py-3 text-[13px] leading-5 text-[#f7b4bc]">
            Existing posts, leads, embeddings, classifications, and RSS logs will stay in the database. Historical rows
            can still appear on this analytics page.
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
            onClick={handleDelete}
            type="button"
          >
            {isPending ? "Deleting..." : "Delete subreddit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
