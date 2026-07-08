"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText } from "lucide-react";

import { updateCampaignDescription } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit campaign description</DialogTitle>
          <DialogDescription>
            This updates the real campaign description used by future AI classification.
          </DialogDescription>
        </DialogHeader>

        <label className="mt-4 grid gap-2">
          <span className="text-sm font-medium text-[#f3f5f4]">Description</span>
          <Textarea
            onChange={(event) => {
              setError(null);
              setDraft(event.target.value);
            }}
            value={draft}
          />
          <span className={error ? "text-sm text-[#f87171]" : "text-sm text-[#6f7c77]"}>
            {error ?? "Keep this aligned with the offer and buyer profile."}
          </span>
        </label>

        <DialogFooter className="mt-5">
          <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={isPending} onClick={handleSave} type="button">
            {isPending ? "Saving..." : "Save description"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
