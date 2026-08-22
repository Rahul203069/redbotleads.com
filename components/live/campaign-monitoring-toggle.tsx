"use client";

import { Pause, Play, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setLiveCampaignActiveState } from "@/actions/live-mode";
import { useToast } from "@/components/ui/use-toast";

export function CampaignMonitoringToggle({ campaignId, initialActive }: { campaignId: string; initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  return <button className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-not-allowed disabled:opacity-60 ${active ? "bg-[#2d2510] text-[#ffd66e] hover:bg-[#3a2f12]" : "bg-[#1ed760] text-[#0d160f] hover:bg-[#3be477]"}`} disabled={pending} onClick={() => startTransition(async () => {
    const next = !active;
    const result = await setLiveCampaignActiveState(campaignId, next);
    if (result.status === "error") toast({ title: "Could not change monitoring", description: result.message, variant: "destructive" });
    else { setActive(next); toast({ title: next ? "Campaign resumed" : "Campaign paused", description: result.message }); router.refresh(); }
  })} type="button">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{pending ? "Saving..." : active ? "Pause" : "Resume"}</button>;
}
