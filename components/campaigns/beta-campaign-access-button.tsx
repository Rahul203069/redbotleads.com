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

const ACCOUNT_CAMPAIGN_LIMIT_MESSAGE =
  "Each account is limited to one campaign during beta.";

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

      <DialogContent className="max-w-[420px] overflow-hidden rounded-[24px] border-none bg-[linear-gradient(180deg,#1f1f1f_0%,#121212_100%)] p-0 shadow-[rgba(0,0,0,0.5)_0px_8px_24px]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <div
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#121212] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
            >
              <LockIcon />
            </div>
            <DialogHeader className="space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                Campaign limit
              </p>
              <DialogTitle className="text-[20px] font-bold leading-6 tracking-normal text-[#fdfdfd]">
                One campaign per account
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-5 text-[#cbcbcb]">
                {ACCOUNT_CAMPAIGN_LIMIT_MESSAGE}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="mt-5 rounded-[16px] bg-[#181818] p-3.5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">
              Current access
            </p>
            <p className="mt-2 text-[12.5px] leading-5 text-[#cbcbcb]">
              You can continue viewing campaigns already shared with this account. To add or
              change campaign access, contact the workspace owner.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-white/8 bg-[#181818] px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button
              className="h-10 w-full rounded-full border-none bg-[#1ed760] px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#121212] shadow-none hover:bg-[#3be477] sm:w-auto"
              type="button"
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
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
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
