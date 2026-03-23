"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { manualSyncCampaign } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function ManualSyncButton({
  campaignId,
  disabled = false,
}: {
  campaignId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    const formData = new FormData();
    formData.set("campaignId", campaignId);

    startTransition(async () => {
      const result = await manualSyncCampaign(formData);

      if (result.status === "success") {
        toast({
          title: "Manual sync queued",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not queue manual sync",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Button disabled={disabled || isPending} onClick={handleSync} variant="secondary">
      <SyncIcon />
      {isPending ? "Queueing..." : "Manual sync"}
    </Button>
  );
}

function SyncIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M20 12a8 8 0 0 0-14.9-4M4 4v4h4M4 12a8 8 0 0 0 14.9 4M20 20v-4h-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
