"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText, X } from "lucide-react";

import { updateCampaignDescription } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export function EditCampaignDescriptionDialog({
  campaignId,
  description,
}: {
  campaignId: string;
  description: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initialDescription = useMemo(() => description ?? "", [description]);
  const [draft, setDraft] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDraft(initialDescription);
      setError(null);
    }
  }

  function handleSave() {
    if (draft.trim() === initialDescription.trim()) {
      toast({
        title: "No changes detected",
        description: "Nothing changed to update.",
      });
      return;
    }

    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("description", draft);

    startTransition(async () => {
      const result = await updateCampaignDescription(formData);

      if (result.status === "success") {
        toast({ title: "Description updated", description: result.message });
        setOpen(false);
        return;
      }

      setError(result.fieldErrors?.description ?? result.message ?? "Could not update campaign description.");
      toast({
        title: "Could not update description",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" variant="secondary">
          <FileText className="h-4 w-4" />
          Edit description
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0">
        <DialogClose asChild>
          <button
            aria-label="Close dialog"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#111113] text-[#a1a1aa] outline-none transition-colors hover:bg-[#18181b] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </DialogClose>

        <div className="p-6 sm:p-7">
          <DialogHeader className="pr-12">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#27312E] bg-[#161D1B] text-[#1ed760]">
              <FileText aria-hidden="true" className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">Edit campaign description</DialogTitle>
            <DialogDescription className="max-w-xl">
              Update the campaign context used for future AI classification and shared lead views.
            </DialogDescription>
          </DialogHeader>

          <label className="mt-6 grid gap-2">
            <span className="text-sm font-medium text-[#f3f5f4]">Description</span>
            <Textarea
              className="min-h-[190px] resize-y rounded-2xl border-[#34343a] bg-[#0c0c0f] px-4 py-3 leading-6"
              onChange={(event) => {
                setError(null);
                setDraft(event.target.value);
              }}
              value={draft}
            />
            <span className={error ? "text-sm leading-5 text-[#f87171]" : "text-sm leading-5 text-[#8b9490]"}>
              {error ?? "Keep this aligned with the offer, buyer profile, and lead qualification goals."}
            </span>
          </label>

          <DialogFooter className="mt-6 border-t border-[#27312E] pt-5 sm:justify-end">
            <Button className="w-full sm:w-auto" onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" disabled={isPending} onClick={handleSave} type="button">
              {isPending ? "Saving..." : "Save description"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
