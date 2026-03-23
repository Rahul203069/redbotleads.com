"use client";

import { useState, useTransition } from "react";

import { deleteCampaign } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

type DeleteCampaignDialogProps = {
  campaignId: string;
  campaignName: string;
};

export function DeleteCampaignDialog({ campaignId, campaignName }: DeleteCampaignDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("campaignId", campaignId);

    startTransition(async () => {
      const result = await deleteCampaign(formData);

      if (result.status === "success") {
        toast({
          title: "Campaign deleted",
          description: result.message,
        });
        setOpen(false);
        window.location.assign("/campaigns");
        return;
      }

      toast({
        title: "Could not delete campaign",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="text-[#f87171] hover:text-white" variant="secondary">
          <TrashIcon />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>Delete campaign</DialogTitle>
            <DialogDescription>
              This will permanently remove <span className="font-medium text-[#F3F5F4]">{campaignName}</span> and any leads tied only
              to this campaign. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 rounded-2xl border border-[#7f1d1d] bg-[#241313] px-4 py-4 text-sm leading-6 text-[#FEE2E2]">
            Confirm only if you want to remove this campaign from the workspace entirely.
          </div>

          <DialogFooter className="mt-6 border-t border-[#27312E] pt-5">
            <div className="text-sm text-[#6F7C77]">You can cancel safely if you only meant to pause or edit the campaign.</div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setOpen(false)} type="button" variant="secondary">
                Cancel
              </Button>
              <Button className="border-[#7f1d1d] bg-[#dc2626] text-white hover:bg-[#ef4444]" disabled={isPending} onClick={handleDelete} type="button">
                <TrashIcon />
                {isPending ? "Deleting..." : "Delete campaign"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 7h16M9 7V5h6v2m-8 0 1 12h8l1-12M10 11v5M14 11v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
