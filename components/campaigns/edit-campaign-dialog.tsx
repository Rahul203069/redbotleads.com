"use client";

import { useMemo, useState, useTransition } from "react";

import { updateCampaign } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type Draft = {
  name: string;
  leadType: "PRODUCT" | "SERVICE";
  description: string;
  keywords: string[];
  negativeKeywords: string[];
  subreddits: string[];
  recentDays: string;
  minScoreToAlert: string;
  isActive: boolean;
};

type EditCampaignDialogProps = {
  campaign: {
    id: string;
    name: string;
    leadType: "PRODUCT" | "SERVICE";
    description: string | null;
    keywords: string[];
    negativeKeywords: string[];
    subreddits: string[];
    recentDays: number;
    minScoreToAlert: number;
    isActive: boolean;
  };
};

export function EditCampaignDialog({ campaign }: EditCampaignDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Partial<Record<"name" | "description" | "keywords" | "subreddits" | "recentDays" | "minScoreToAlert", string>>>({});
  const initialDraft = useMemo<Draft>(
    () => ({
      name: campaign.name,
      leadType: campaign.leadType,
      description: campaign.description ?? "",
      keywords: campaign.keywords,
      negativeKeywords: campaign.negativeKeywords,
      subreddits: campaign.subreddits,
      recentDays: String(campaign.recentDays),
      minScoreToAlert: String(campaign.minScoreToAlert),
      isActive: campaign.isActive,
    }),
    [campaign],
  );
  const [draft, setDraft] = useState<Draft>(initialDraft);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDraft(initialDraft);
      setErrors({});
    }
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setErrors({});
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    if (!hasCampaignChanged(initialDraft, draft)) {
      toast({
        title: "No changes detected",
        description: "Nothing changed to update.",
      });
      return;
    }

    const formData = new FormData();
    formData.set("campaignId", campaign.id);
    formData.set("name", draft.name);
    formData.set("leadType", draft.leadType);
    formData.set("description", draft.description);
    formData.set("keywords", draft.keywords.join("\n"));
    formData.set("negativeKeywords", draft.negativeKeywords.join("\n"));
    formData.set("subreddits", draft.subreddits.join("\n"));
    formData.set("recentDays", draft.recentDays);
    formData.set("minScoreToAlert", draft.minScoreToAlert);
    if (draft.isActive) formData.set("isActive", "on");

    startTransition(async () => {
      const result = await updateCampaign(formData);
      if (result.status === "success") {
        toast({ title: "Campaign updated", description: result.message });
        setOpen(false);
        return;
      }

      setErrors(result.fieldErrors ?? {});
      toast({
        title: "Could not update campaign",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" variant="secondary">
          <EditIcon />
          Edit campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="no-scrollbar max-w-4xl p-0">
        <div className="p-6 lg:p-8">
          <DialogHeader>
            <DialogTitle>Edit campaign</DialogTitle>
            <DialogDescription>Update the targeting rules and campaign defaults from one place.</DialogDescription>
          </DialogHeader>

          <div className="mt-6 grid gap-6">
            <section className="grid gap-5 rounded-[24px] border border-[#27312E] bg-[#161D1B] p-5">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">Basics</div>
                <div className="mt-2 text-sm text-[#9DA9A4]">Core identity and context for the campaign.</div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Field error={errors.name} hint="Internal campaign label." label="Campaign name">
                  <Input onChange={(event) => updateDraft("name", event.target.value)} value={draft.name} />
                </Field>
                <Field hint="Offer type." label="Lead type">
                  <select
                    className="flex h-11 w-full rounded-xl border border-[#27272a] bg-[#09090b] px-3 text-sm text-[#fafafa] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
                    onChange={(event) => updateDraft("leadType", event.target.value as Draft["leadType"])}
                    value={draft.leadType}
                  >
                    <option value="PRODUCT">Product</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </Field>
              </div>

              <Field error={errors.description} hint="Optional context for the campaign." label="Description">
                <Textarea onChange={(event) => updateDraft("description", event.target.value)} value={draft.description} />
              </Field>
            </section>

            <section className="grid gap-5 rounded-[24px] border border-[#27312E] bg-[#161D1B] p-5">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">Targeting</div>
                <div className="mt-2 text-sm text-[#9DA9A4]">Adjust the matching terms and communities this campaign should monitor.</div>
              </div>

              <Field error={errors.keywords} hint="Single-word intent and category keywords only." label="Keywords">
                <TagInput
                  label="Single word only."
                  onChange={(values) => updateDraft("keywords", values)}
                  placeholder="Type a keyword and press Enter"
                  value={draft.keywords}
                />
              </Field>

              <Field hint="Optional. Terms to exclude." label="Negative keywords">
                <TagInput
                  label="Optional."
                  onChange={(values) => updateDraft("negativeKeywords", values)}
                  placeholder="Type a negative keyword and press Enter"
                  value={draft.negativeKeywords}
                />
              </Field>

              <Field error={errors.subreddits} hint="Communities to monitor." label="Subreddits">
                <TagInput onChange={(values) => updateDraft("subreddits", values)} placeholder="Type a subreddit and press Enter" value={draft.subreddits} />
              </Field>
            </section>

            <section className="grid gap-5 rounded-[24px] border border-[#27312E] bg-[#161D1B] p-5">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">Alerting</div>
                <div className="mt-2 text-sm text-[#9DA9A4]">Set the threshold and activation state for this campaign.</div>
              </div>

              <Field error={errors.recentDays} hint="How far back the first sync and refresh should scan. Maximum 10 days." label="Recent window">
                <div className="rounded-2xl border border-[#27312E] bg-[#111716] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#C3CBC8]">Scan the last</span>
                    <span className="text-sm font-medium text-[#F3F5F4]">{draft.recentDays} days</span>
                  </div>
                  <input
                    className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#18181b] accent-white"
                    max={10}
                    min={1}
                    onChange={(event) => updateDraft("recentDays", event.target.value)}
                    type="range"
                    value={draft.recentDays}
                  />
                  <div className="mt-2 flex justify-between text-xs uppercase tracking-[0.2em] text-[#6F7C77]">
                    <span>1 day</span>
                    <span>10 days</span>
                  </div>
                </div>
              </Field>

              <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                <Field error={errors.minScoreToAlert} hint="Alert threshold." label="Min score">
                  <Input
                    max={100}
                    min={1}
                    onChange={(event) => updateDraft("minScoreToAlert", event.target.value)}
                    type="number"
                    value={draft.minScoreToAlert}
                  />
                </Field>

                <label className="flex items-center gap-3 rounded-2xl border border-[#27312E] bg-[#111716] px-4 py-4 text-sm text-[#C3CBC8]">
                  <input
                    checked={draft.isActive}
                    className="h-4 w-4 rounded border-[#27272a] bg-[#09090b] accent-white"
                    onChange={(event) => updateDraft("isActive", event.target.checked)}
                    type="checkbox"
                  />
                  Campaign active
                </label>
              </div>
            </section>
          </div>

          <DialogFooter className="mt-8 border-t border-[#27312E] pt-5">
            <div className="text-sm text-[#6F7C77]">Changes will update this campaign immediately.</div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={isPending} onClick={handleSave} type="button">
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 20h4l10-10-4-4L4 16v4Zm9-13 4 4m-3-6 2-2 4 4-2 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function hasCampaignChanged(initialDraft: Draft, draft: Draft) {
  return (
    initialDraft.name !== draft.name ||
    initialDraft.leadType !== draft.leadType ||
    initialDraft.description !== draft.description ||
    initialDraft.recentDays !== draft.recentDays ||
    initialDraft.minScoreToAlert !== draft.minScoreToAlert ||
    initialDraft.isActive !== draft.isActive ||
    !areArraysEqual(initialDraft.keywords, draft.keywords) ||
    !areArraysEqual(initialDraft.negativeKeywords, draft.negativeKeywords) ||
    !areArraysEqual(initialDraft.subreddits, draft.subreddits)
  );
}

function areArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function Field({
  children,
  error,
  hint,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  hint: string;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#F3F5F4]">{label}</span>
      {children}
      <span className={error ? "text-sm text-[#F87171]" : "text-sm text-[#6F7C77]"}>{error ?? hint}</span>
    </label>
  );
}
