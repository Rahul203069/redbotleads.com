"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteCampaignLead } from "@/actions/campaigns";
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

type DeleteCampaignLeadDialogProps = {
  campaignId: string;
  lead: {
    id: string;
    score: number;
    subreddit: string;
    title: string | null;
  };
  onDeleted: (leadId: string) => void;
};

export function DeleteCampaignLeadDialog({ campaignId, lead, onDeleted }: DeleteCampaignLeadDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const leadTitle = lead.title?.trim() || "Untitled Reddit lead";

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) {
      return;
    }

    setOpen(nextOpen);
    setErrorMessage(null);
  }

  function handleDelete() {
    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("leadId", lead.id);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await deleteCampaignLead(formData);

      if (result.status !== "success") {
        const message = result.message || "The lead could not be deleted.";
        setErrorMessage(message);
        toast({
          title: "Could not delete lead",
          description: message,
          variant: "destructive",
        });
        return;
      }

      onDeleted(result.deletedLeadId || lead.id);
      setOpen(false);
      toast({
        title: "Lead deleted",
        description: result.message,
      });
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label={`Delete lead: ${leadTitle}`}
          className="w-full cursor-pointer rounded-full border-[#7f1d1d] text-[#fca5a5] transition-colors duration-200 hover:border-[#b91c1c] hover:bg-[#2b1414] hover:text-[#ffffff] sm:w-auto"
          size="sm"
          type="button"
          variant="secondary"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete lead
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>Delete campaign lead?</DialogTitle>
            <DialogDescription>
              This removes the lead from this campaign, its analytics, exports, and any existing public campaign or leads-only links.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Selected lead</p>
            <p className="mt-2 text-[15px] font-semibold leading-6 text-[#fdfdfd] [overflow-wrap:anywhere]">{leadTitle}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">
              <span>r/{lead.subreddit}</span>
              <span>Score {lead.score}</span>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-[#7f1d1d] bg-[#241313] px-4 py-4 text-[13px] leading-6 text-[#fee2e2]">
            The source Reddit item and leads in other campaigns will remain. A future semantic run may rediscover this item for this campaign.
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[16px] border border-[#b91c1c] bg-[#2b1414] px-4 py-3 text-[13px] leading-5 text-[#fecaca]" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <DialogFooter className="mt-6 border-t border-[#27272a] pt-5">
            <p className="text-[12px] leading-5 text-[#a1a1aa]">This deletion takes effect on shared links as soon as they refresh.</p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button className="cursor-pointer" disabled={isPending} onClick={() => handleOpenChange(false)} type="button" variant="secondary">
                Cancel
              </Button>
              <Button
                className="cursor-pointer border-[#b91c1c] bg-[#dc2626] text-white hover:bg-[#ef4444]"
                disabled={isPending}
                onClick={handleDelete}
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {isPending ? "Deleting..." : "Delete lead"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
