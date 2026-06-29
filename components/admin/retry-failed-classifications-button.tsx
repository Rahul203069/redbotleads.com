"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { retryFailedDailySemanticClassifications } from "@/app/(app)/admin/analytics/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function RetryFailedClassificationsButton({
  campaignId,
  from,
  to,
}: {
  campaignId?: string | null;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      const result = await retryFailedDailySemanticClassifications({
        campaignId,
        from,
        to,
      });

      if (result.status === "success") {
        toast({
          title: "Retry queued",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Retry failed",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Button
      className="h-9 rounded-full border-none bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525]"
      disabled={isPending}
      onClick={handleRetry}
      type="button"
      variant="secondary"
    >
      <RotateCcw className="h-4 w-4" />
      {isPending ? "Queueing..." : "Retry failed AI"}
    </Button>
  );
}
