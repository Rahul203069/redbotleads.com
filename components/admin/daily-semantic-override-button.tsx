"use client";

import { BrainCircuit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { runDailySemanticOverride } from "@/app/(app)/admin/analytics/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function DailySemanticOverrideButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    startTransition(async () => {
      const result = await runDailySemanticOverride();

      if (result.status === "success") {
        toast({
          title: "Daily semantic queued",
          description: `${result.message} Failed: ${result.failed ?? 0}.`,
        });
        router.refresh();
        return;
      }

      toast({
        title: "Could not queue semantic filtering",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Button
      className="w-full rounded-full border-none bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477] sm:w-auto"
      disabled={isPending}
      onClick={handleRun}
      type="button"
    >
      <BrainCircuit className="h-4 w-4" />
      {isPending ? "Queueing..." : "Run Semantic"}
    </Button>
  );
}
