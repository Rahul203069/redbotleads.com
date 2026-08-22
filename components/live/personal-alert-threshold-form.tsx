"use client";

import { useActionState, useEffect } from "react";

import { updateNotificationAlertThreshold, type SettingsActionState } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const initialState: SettingsActionState = { status: "idle" };

export function PersonalAlertThresholdForm({ campaignId, initialScore }: { campaignId: string; initialScore: number }) {
  const [state, action, pending] = useActionState(updateNotificationAlertThreshold, initialState);
  const { toast } = useToast();
  useEffect(() => { if (state.message) toast({ title: state.status === "success" ? "Alert threshold saved" : "Could not save threshold", description: state.message, variant: state.status === "error" ? "destructive" : undefined }); }, [state, toast]);
  return <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end"><input name="notificationCampaignId" type="hidden" value={campaignId} /><label className="grid gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#777]">Your minimum alert score</span><Input className="w-full border-white/[0.08] bg-[#101010] sm:w-44" defaultValue={initialScore} disabled={pending} max={100} min={1} name="minScoreToAlert" type="number" /></label><Button className="cursor-pointer rounded-full bg-[#1f1f1f]" disabled={pending} type="submit" variant="secondary">{pending ? "Saving..." : "Save threshold"}</Button></form>;
}
