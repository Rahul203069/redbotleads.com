"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const BETA_OWNER_ONLY_MESSAGE =
  "Currently in beta stage. Only the owner can create or run campaigns.";

export function BetaCampaignAccessButton({ label }: { label: string }) {
  const { toast } = useToast();

  return (
    <Button
      className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
      onClick={() =>
        toast({
          title: "Campaigns are owner-only during beta",
          description: BETA_OWNER_ONLY_MESSAGE,
          variant: "destructive",
        })
      }
      size="lg"
      type="button"
      variant="secondary"
    >
      {label}
    </Button>
  );
}
