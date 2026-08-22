"use client";

import { useActionState, useEffect } from "react";

import { updateLiveCampaignSettings, type LiveActionResult } from "@/actions/live-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const initialState: LiveActionResult = { status: "success", message: "" };

export function LiveCampaignSettingsForm({ campaign, readOnly }: { campaign: { description: string | null; id: string; keywords: string[]; minScoreToAlert: number; negativeKeywords: string[]; regions: string[]; subreddits: string[] }; readOnly: boolean }) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(updateLiveCampaignSettings, initialState);
  useEffect(() => {
    if (!state.message) return;
    toast({ title: state.status === "success" ? "Campaign settings saved" : "Could not save campaign", description: state.message, variant: state.status === "error" ? "destructive" : undefined });
  }, [state, toast]);
  return <form action={action} className="grid gap-5">
    <input name="campaignId" type="hidden" value={campaign.id} />
    <Field hint="Describe the service, customer problem, and signals that make a Reddit post relevant." label="Business or service description"><Textarea className="min-h-36 resize-y border-white/[0.08] bg-[#101010]" defaultValue={campaign.description ?? ""} disabled={readOnly || pending} maxLength={4000} name="description" /></Field>
    <div className="grid gap-5 lg:grid-cols-2">
      <Field hint="One region per line or comma separated. Stored for campaign context; worker filtering is unchanged." label="Regions served"><Textarea className="min-h-28 resize-y border-white/[0.08] bg-[#101010]" defaultValue={campaign.regions.join("\n")} disabled={readOnly || pending} name="regions" placeholder="Canada&#10;United States" /></Field>
      <Field hint="One subreddit per line. You can keep large lists here without rendering thousands of chips." label="Target subreddits"><Textarea className="min-h-28 resize-y border-white/[0.08] bg-[#101010] font-mono text-[12px]" defaultValue={campaign.subreddits.join("\n")} disabled={readOnly || pending} name="subreddits" /></Field>
      <Field hint="Positive terms, one per line or comma separated." label="Keywords"><Textarea className="min-h-28 resize-y border-white/[0.08] bg-[#101010]" defaultValue={campaign.keywords.join("\n")} disabled={readOnly || pending} name="keywords" /></Field>
      <Field hint="Terms that should reduce relevance." label="Negative keywords"><Textarea className="min-h-28 resize-y border-white/[0.08] bg-[#101010]" defaultValue={campaign.negativeKeywords.join("\n")} disabled={readOnly || pending} name="negativeKeywords" /></Field>
    </div>
    <Field hint="Only leads at or above this score should generate alerts." label="Notification score threshold"><Input className="max-w-48 border-white/[0.08] bg-[#101010]" defaultValue={campaign.minScoreToAlert} disabled={readOnly || pending} max={100} min={1} name="minScoreToAlert" type="number" /></Field>
    {readOnly ? <div className="rounded-[16px] border border-white/[0.08] bg-[#111111] p-4 text-[13px] leading-5 text-[#a7a7a7]">Campaign configuration is read-only for assigned clients. Your personal alert threshold can still be changed below.</div> : <div className="flex justify-end"><Button className="cursor-pointer rounded-full bg-[#1ed760] px-5 text-[#0d160f] hover:bg-[#3be477]" disabled={pending} type="submit">{pending ? "Saving..." : "Save campaign"}</Button></div>}
  </form>;
}

function Field({ children, hint, label }: { children: React.ReactNode; hint: string; label: string }) { return <label className="grid gap-2"><span className="text-[11px] font-bold text-white">{label}</span>{children}<span className="text-[11px] leading-5 text-[#777]">{hint}</span></label>; }
