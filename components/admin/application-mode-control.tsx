"use client";

import { CalendarClock, LoaderCircle, RadioTower } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateApplicationMode } from "@/actions/admin-settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { SaasAppMode } from "@/lib/app-mode";

const options = [
  { value: "DAILY" as const, label: "Daily Mode", description: "Legacy once-per-day filtering and reports.", icon: CalendarClock },
  { value: "LIVE" as const, label: "Live Mode", description: "Cross-campaign lead inbox, history, and notification center.", icon: RadioTower },
];

export function ApplicationModeControl({ initialMode }: { initialMode: SaasAppMode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentMode, setCurrentMode] = useState(initialMode);
  const [selectedMode, setSelectedMode] = useState(initialMode);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentMode(initialMode);
    setSelectedMode(initialMode);
  }, [initialMode]);

  function applyMode() {
    startTransition(async () => {
      const result = await updateApplicationMode(selectedMode);
      if (result.status === "error") {
        toast({ title: "Could not change application mode", description: result.message, variant: "destructive" });
        return;
      }
      const nextMode = result.appMode ?? selectedMode;
      setCurrentMode(nextMode);
      setSelectedMode(nextMode);
      setConfirmationOpen(false);
      toast({ title: `${nextMode === "LIVE" ? "Live" : "Daily"} Mode enabled`, description: result.message });
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-3">
        <div aria-label="Application mode" className="grid gap-2" role="group">
          {options.map((option) => {
            const Icon = option.icon;
            const selected = option.value === selectedMode;
            return (
              <button
                aria-pressed={selected}
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 ${selected ? "border-[#1ed760]/50 bg-[#1ed760]/10 text-white" : "border-white/[0.07] bg-[#101010] text-[#b3b3b3] hover:border-white/[0.14] hover:bg-[#181818] hover:text-white"}`}
                key={option.value}
                onClick={() => setSelectedMode(option.value)}
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
        <Button className="w-full cursor-pointer rounded-full bg-[#1f1f1f] text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-[#252525]" disabled={selectedMode === currentMode || isPending} onClick={() => setConfirmationOpen(true)} type="button">
          Apply globally
        </Button>
      </div>
      <Dialog open={confirmationOpen} onOpenChange={(open) => !isPending && setConfirmationOpen(open)}>
        <DialogContent className="max-w-lg">
          <div className="space-y-5 p-6">
            <DialogHeader>
              <DialogTitle>Enable {selectedMode === "LIVE" ? "Live Mode" : "Daily Mode"} for everyone?</DialogTitle>
              <DialogDescription>The navigation and campaign experience changes globally after the next refresh. Existing lead records are preserved.</DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-[#27272a] p-4">
            <Button className="cursor-pointer rounded-full" disabled={isPending} onClick={() => setConfirmationOpen(false)} type="button" variant="secondary">Cancel</Button>
            <Button className="cursor-pointer rounded-full bg-[#1ed760] text-[#121212] hover:bg-[#3be477]" disabled={isPending} onClick={applyMode} type="button">
              {isPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Applying..." : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
