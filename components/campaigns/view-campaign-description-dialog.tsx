"use client";

import { FileText, X } from "lucide-react";

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

export function ViewCampaignDescriptionDialog({ description }: { description: string | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" variant="secondary">
          <FileText className="h-4 w-4" />
          View description
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
            <DialogTitle className="text-xl">Campaign description</DialogTitle>
            <DialogDescription className="max-w-xl">
              This context helps the AI understand the ideal customer, problem, and relevant lead criteria.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 rounded-2xl border border-[#34343a] bg-[#0c0c0f] px-4 py-4">
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#e4e4e7]">
              {description?.trim() || "No campaign description has been added yet."}
            </p>
          </div>

          <DialogFooter className="mt-6 border-t border-[#27312E] pt-5 sm:justify-end">
            <DialogClose asChild>
              <Button className="w-full sm:w-auto" type="button">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
