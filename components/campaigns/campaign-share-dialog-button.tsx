"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { buildPublicUrl, copyToClipboard } from "@/components/campaigns/copy-public-campaign-link-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export function CampaignShareDialogButton({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isCopied, setIsCopied] = useState(false);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return buildPublicUrl(window.location.origin, campaignId, searchParams, "campaign");
  }, [campaignId, searchParams]);

  async function handleCopy() {
    if (!publicUrl) {
      return;
    }

    try {
      await copyToClipboard(publicUrl);
      setIsCopied(true);
      toast({
        title: "Public link copied",
        description: "Anyone with this link can view the campaign results.",
      });
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast({
        title: "Could not copy link",
        description: publicUrl,
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog onOpenChange={() => setIsCopied(false)}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" variant="secondary">
          <Share2 aria-hidden="true" className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <DialogTitle>Share campaign</DialogTitle>
          <DialogDescription>
            Anyone with this public link can view the campaign results for the selected date filter.
          </DialogDescription>
        </DialogHeader>

        <label className="mt-5 grid gap-2">
          <span className="text-sm font-medium text-[#f3f5f4]">Public link</span>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              aria-label="Public campaign link"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={publicUrl}
            />
            <Button
              className="w-full border-none bg-[#1ed760] text-[#121212] shadow-[rgba(30,215,96,0.24)_0px_10px_28px] hover:bg-[#3be477] sm:w-auto"
              disabled={!publicUrl}
              onClick={handleCopy}
              type="button"
            >
              {isCopied ? (
                <>
                  <Check aria-hidden="true" className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </label>
      </DialogContent>
    </Dialog>
  );
}
