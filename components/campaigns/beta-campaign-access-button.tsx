"use client";

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

const BETA_OWNER_ONLY_MESSAGE =
  "Currently in beta stage. Only the owner can create or run campaigns.";

export function BetaCampaignAccessButton({ label }: { label: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
          size="lg"
          type="button"
          variant="secondary"
        >
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md overflow-hidden rounded-[28px] border-none bg-[linear-gradient(180deg,#1f1f1f_0%,#121212_100%)] p-0 shadow-[rgba(0,0,0,0.5)_0px_8px_24px]">
        <div className="p-6">
          <DialogHeader>
            <div
              aria-hidden="true"
              className="grid h-12 w-12 place-items-center rounded-full bg-[#121212] text-[#f3727f] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
            >
              <LockIcon />
            </div>
            <DialogTitle className="mt-4 text-[1.5rem] font-bold tracking-[-0.04em] text-[#fdfdfd]">
              Campaign creation is restricted
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-6 text-[#cbcbcb]">
              {BETA_OWNER_ONLY_MESSAGE}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 rounded-[18px] bg-[#181818] px-4 py-3 text-[13px] leading-6 text-[#b3b3b3] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
            You can still view campaigns shared with your account. Creating new campaigns is
            limited while beta access is controlled by the owner.
          </div>
        </div>

        <DialogFooter className="border-t border-white/8 bg-[#181818] px-6 py-5 sm:justify-end">
          <DialogClose asChild>
            <Button
              className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
              type="button"
              variant="secondary"
            >
              Got it
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M7.5 10V8a4.5 4.5 0 0 1 9 0v2M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
