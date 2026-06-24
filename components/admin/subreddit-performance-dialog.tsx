"use client";

import { BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
import { Input } from "@/components/ui/input";

export function SubredditPerformanceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = campaignName.trim();

    if (!normalizedName) {
      setError("Enter part of a campaign name.");
      return;
    }

    setError("");
    setOpen(false);
    router.push(`/admin/analytics/subreddit-performance?name=${encodeURIComponent(normalizedName)}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full rounded-full border-none bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
          type="button"
          variant="secondary"
        >
          <BarChart3 className="h-4 w-4" />
          Subreddit Performance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-6">
            <DialogHeader>
              <DialogTitle>Subreddit Performance</DialogTitle>
              <DialogDescription>
                Enter a campaign name fragment. Campaigns whose names include this text will be combined into one subreddit report.
              </DialogDescription>
            </DialogHeader>

            <label className="grid gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                Campaign name contains
              </span>
              <Input
                autoFocus
                onChange={(event) => {
                  setCampaignName(event.target.value);
                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Paycon"
                value={campaignName}
              />
            </label>

            {error ? (
              <p className="rounded-[14px] bg-[#2a1014] px-3 py-2 text-[13px] leading-5 text-[#f3727f]">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-[#27272a] p-4">
            <Button
              className="rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525]"
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              type="submit"
            >
              Open Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
