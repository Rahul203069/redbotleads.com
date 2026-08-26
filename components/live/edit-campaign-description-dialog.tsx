"use client";

import { LoaderCircle, PencilLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { updateCampaignDescription } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const MAX_DESCRIPTION_LENGTH = 4000;

export function EditCampaignDescriptionDialog({
  campaignId,
  description,
}: {
  campaignId: string;
  description: string | null;
}) {
  const [draft, setDraft] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const isDirty = draft.trim() !== (description ?? "").trim();

  function handleOpenChange(nextOpen: boolean) {
    if (pending && !nextOpen) {
      return;
    }

    setOpen(nextOpen);
    if (!nextOpen) {
      setDraft(description ?? "");
      setError(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateCampaignDescription(formData);
      if (result.status === "success") {
        setDraft(draft.trim());
        setOpen(false);
        toast({ title: "Campaign description updated", description: result.message });
        router.refresh();
        return;
      }

      const message = result.fieldErrors?.description ?? result.message ?? "Could not update the campaign description.";
      setError(message);
      toast({ title: "Could not update description", description: message, variant: "destructive" });
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="w-full cursor-pointer sm:w-auto" variant="secondary">
          <PencilLine aria-hidden="true" className="h-4 w-4" />
          Edit description
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0">
        <DialogClose asChild>
          <button
            aria-label="Close dialog"
            className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-[#111113] text-[#a1a1aa] outline-none transition-colors hover:bg-[#18181b] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
            disabled={pending}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </DialogClose>

        <form onSubmit={handleSubmit}>
          <div className="p-6 sm:p-7">
            <DialogHeader className="pr-12">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#27312E] bg-[#161D1B] text-[#1ed760]">
                <PencilLine aria-hidden="true" className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl">Edit campaign description</DialogTitle>
              <DialogDescription className="max-w-xl">
                Describe the service, customer problem, and signals that make a Reddit post relevant.
              </DialogDescription>
            </DialogHeader>

            <input name="campaignId" type="hidden" value={campaignId} />
            <div className="mt-6 grid gap-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a7a7a7]" htmlFor="live-campaign-description">
                Description
              </label>
              <Textarea
                aria-describedby={error ? "live-campaign-description-error live-campaign-description-count" : "live-campaign-description-count"}
                aria-invalid={Boolean(error)}
                className="min-h-44 resize-y border-white/[0.08] bg-[#101010]"
                disabled={pending}
                id="live-campaign-description"
                maxLength={MAX_DESCRIPTION_LENGTH}
                name="description"
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                }}
                value={draft}
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-[12px] leading-5 text-[#8f8f8f]" id="live-campaign-description-count">
                  {draft.length.toLocaleString()} / {MAX_DESCRIPTION_LENGTH.toLocaleString()} characters
                </p>
                {error ? <p className="text-[12px] leading-5 text-[#ff8b8b]" id="live-campaign-description-error" role="alert">{error}</p> : null}
              </div>
            </div>

            <DialogFooter className="mt-6 border-t border-[#27312E] pt-5 sm:justify-end">
              <DialogClose asChild>
                <Button className="w-full cursor-pointer sm:w-auto" disabled={pending} type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button className="w-full cursor-pointer bg-[#1ed760] text-[#0d160f] hover:bg-[#3be477] sm:w-auto" disabled={pending || !isDirty} type="submit">
                {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
                {pending ? "Saving..." : "Save description"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
