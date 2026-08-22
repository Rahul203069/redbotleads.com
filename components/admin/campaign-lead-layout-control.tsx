"use client";

import { Inbox, LayoutList, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateCampaignLeadLayout } from "@/actions/admin-settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { CampaignLeadLayout } from "@/lib/campaign-lead-layout";

const layoutOptions: Array<{
  description: string;
  icon: typeof LayoutList;
  label: string;
  value: CampaignLeadLayout;
}> = [
  {
    description: "Existing classified-leads page",
    icon: LayoutList,
    label: "Current",
    value: "CLASSIC",
  },
  {
    description: "Chronological workflow inbox",
    icon: Inbox,
    label: "New inbox",
    value: "INBOX",
  },
];

export function CampaignLeadLayoutControl({
  initialLayout,
}: {
  initialLayout: CampaignLeadLayout;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentLayout, setCurrentLayout] = useState(initialLayout);
  const [selectedLayout, setSelectedLayout] = useState(initialLayout);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasChange = selectedLayout !== currentLayout;

  useEffect(() => {
    setCurrentLayout(initialLayout);
    setSelectedLayout(initialLayout);
  }, [initialLayout]);

  function applyLayout() {
    startTransition(async () => {
      const result = await updateCampaignLeadLayout(selectedLayout);

      if (result.status === "error") {
        toast({
          title: "Could not change the lead page",
          description: result.message ?? "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      const nextLayout = result.layout ?? selectedLayout;
      setCurrentLayout(nextLayout);
      setSelectedLayout(nextLayout);
      setConfirmationOpen(false);
      toast({
        title: "Lead page updated",
        description: result.message,
      });
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-3">
        <div aria-label="Campaign lead page design" className="grid gap-2" role="group">
          {layoutOptions.map((option) => {
            const Icon = option.icon;
            const selected = option.value === selectedLayout;

            return (
              <button
                aria-pressed={selected}
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 ${
                  selected
                    ? "border-[#1ed760]/50 bg-[#1ed760]/10 text-[#ffffff]"
                    : "border-white/[0.07] bg-[#101010] text-[#b3b3b3] hover:border-white/[0.14] hover:bg-[#181818] hover:text-[#ffffff]"
                }`}
                key={option.value}
                onClick={() => setSelectedLayout(option.value)}
                type="button"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${selected ? "bg-[#1ed760]/15 text-[#55e982]" : "bg-[#1f1f1f] text-[#8f8f8f]"}`}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-[#8f8f8f]">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <Button
          className="w-full cursor-pointer rounded-full border-none bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] disabled:cursor-not-allowed"
          disabled={!hasChange || isPending}
          onClick={() => setConfirmationOpen(true)}
          type="button"
          variant="secondary"
        >
          Apply globally
        </Button>
      </div>

      <Dialog open={confirmationOpen} onOpenChange={(open) => !isPending && setConfirmationOpen(open)}>
        <DialogContent className="max-w-lg">
          <div className="space-y-5 p-6">
            <DialogHeader>
              <DialogTitle>Change the lead page for everyone?</DialogTitle>
              <DialogDescription>
                All authenticated campaign viewers will see the {selectedLayout === "INBOX" ? "New inbox" : "Current"} layout after their next refresh or navigation.
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-[#27272a] p-4">
            <Button
              className="cursor-pointer rounded-full"
              disabled={isPending}
              onClick={() => setConfirmationOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer rounded-full bg-[#1ed760] text-[#121212] hover:bg-[#3be477] disabled:cursor-not-allowed"
              disabled={isPending}
              onClick={applyLayout}
              type="button"
            >
              {isPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Applying..." : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
