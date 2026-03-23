"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { submitCampaign } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type CampaignWizardProps = {
  triggerLabel: string;
  triggerVariant?: "default" | "secondary";
};

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

const initialDraft: Draft = {
  name: "",
  leadType: "PRODUCT",
  description: "",
  keywords: [],
  negativeKeywords: [],
  subreddits: [],
  recentDays: "7",
  minScoreToAlert: "75",
  isActive: true,
};

const steps = [
  {
    title: "Basics",
    description: "Start with a campaign name and whether you are tracking a product or a service.",
  },
  {
    title: "Description",
    description: "Add context for the offer so later recommendation and scoring flows have more signal.",
  },
  {
    title: "Keywords",
    description: "Optionally define positive and negative keyword filters that shape candidate matches.",
  },
  {
    title: "Subreddits",
    description: "Choose the communities this campaign should monitor first.",
  },
  {
    title: "Alerting",
    description: "Set the score threshold and activation state, then review before saving.",
  },
] as const;

const saveStageDefinitions = [
  {
    title: "Saving campaign",
    description: "Writing the campaign config and validation payload.",
  },
  {
    title: "Generating semantic queries",
    description: "Building high-intent semantic search strings from the description.",
  },
  {
    title: "Generating embeddings",
    description: "Embedding the semantic query strings for retrieval.",
  },
  {
    title: "Storing semantic search setup",
    description: "Saving semantic query rows and vectors in the database.",
  },
  {
    title: "Queueing campaign sync",
    description: "Scheduling the first ingestion run for the new campaign.",
  },
] as const;

export function CampaignWizard({ triggerLabel, triggerVariant = "default" }: CampaignWizardProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [stepError, setStepError] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiTarget, setAiTarget] = useState<"keywords" | "negativeKeywords" | "subreddits" | null>(null);
  const [serverState, setServerState] = useState<{
    message?: string;
    fieldErrors?: Partial<Record<"name" | "description" | "keywords" | "subreddits" | "recentDays" | "minScoreToAlert", string>>;
  }>({});
  const [isPending, startTransition] = useTransition();
  const [saveStageIndex, setSaveStageIndex] = useState(0);

  const currentStep = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const saveStages = useMemo(() => {
    if (!draft.description.trim()) {
      return [
        saveStageDefinitions[0],
        saveStageDefinitions[4],
      ];
    }

    if (!draft.isActive) {
      return saveStageDefinitions.slice(0, 4);
    }

    return saveStageDefinitions;
  }, [draft.description, draft.isActive]);

  function resetWizard() {
    setOpen(false);
    setStepIndex(0);
    setDraft(initialDraft);
    setStepError(null);
    setServerState({});
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) {
      return;
    }

    if (!nextOpen) {
      resetWizard();
      return;
    }

    setOpen(true);
  }

  const serverFieldError = useMemo(() => {
    if (stepIndex === 0) return serverState.fieldErrors?.name;
    if (stepIndex === 1) return serverState.fieldErrors?.description;
    if (stepIndex === 2) return serverState.fieldErrors?.keywords;
    if (stepIndex === 3) return serverState.fieldErrors?.subreddits;
    if (stepIndex === 4) return serverState.fieldErrors?.recentDays ?? serverState.fieldErrors?.minScoreToAlert;
    return undefined;
  }, [serverState.fieldErrors, stepIndex]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setStepError(null);
    setServerState({});
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function nextStep() {
    const error = validateStep(stepIndex, draft);
    setStepError(error);
    setServerState({});

    if (error) {
      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setStepError(null);
    setServerState({});
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function saveCampaign() {
    const validation = validateDraftForSubmit(draft);
    setStepError(validation?.message ?? null);

    if (validation) {
      setStepIndex(validation.stepIndex);
      return;
    }

    const formData = new FormData();
    formData.set("name", draft.name);
    formData.set("leadType", draft.leadType);
    formData.set("description", draft.description);
    formData.set("keywords", draft.keywords.join("\n"));
    formData.set("negativeKeywords", draft.negativeKeywords.join("\n"));
    formData.set("subreddits", draft.subreddits.join("\n"));
    formData.set("recentDays", draft.recentDays);
    formData.set("minScoreToAlert", draft.minScoreToAlert);

    if (draft.isActive) {
      formData.set("isActive", "on");
    }

    startTransition(async () => {
      const result = await submitCampaign(formData);

      if (result.status === "success") {
        toast({
          title: "Campaign created",
          description: result.message,
        });
        resetWizard();
        return;
      }

      setServerState({
        message: result.message,
        fieldErrors: result.fieldErrors,
      });

      const erroredStep = getErroredStep(result.fieldErrors);
      if (erroredStep !== null) {
        setStepIndex(erroredStep);
      }

      if (result.message) {
        toast({
          title: "Could not create campaign",
          description: result.message,
          variant: "destructive",
        });
      }
    });
  }

  useEffect(() => {
    if (!isPending) {
      setSaveStageIndex(0);
      return;
    }

    setSaveStageIndex(0);

    const intervalId = window.setInterval(() => {
      setSaveStageIndex((current) => Math.min(current + 1, saveStages.length - 1));
    }, 1400);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPending, saveStages]);

  async function generateSubreddits() {
    await generateAiSuggestions("subreddits");
  }

  async function generateAiSuggestions(target: "keywords" | "negativeKeywords" | "subreddits") {
    if (draft.description.trim().length < 10) {
      toast({
        title: "Add more description first",
        description: "Describe the product or service before asking AI to generate suggestions.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAiPending(true);
      setAiTarget(target);

      const endpoint = target === "subreddits" ? "/api/subreddits/suggest" : "/api/campaigns/suggest-terms";
      const body =
        target === "subreddits"
          ? {
              description: draft.description,
              leadType: draft.leadType,
              keywords: draft.keywords,
              existing: draft.subreddits,
            }
          : {
              description: draft.description,
              leadType: draft.leadType,
              kind: target,
              existing: target === "keywords" ? draft.keywords : draft.negativeKeywords,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { error?: string; suggestions?: string[] };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not generate suggestions.");
      }

      if (!payload.suggestions || payload.suggestions.length === 0) {
        toast({
          title: "No suggestions returned",
          description: "Try adding more detail to the campaign description.",
          variant: "destructive",
        });
        return;
      }

      if (target === "subreddits") {
        updateDraft("subreddits", Array.from(new Set([...draft.subreddits, ...payload.suggestions])));
      } else if (target === "keywords") {
        updateDraft("keywords", Array.from(new Set([...draft.keywords, ...payload.suggestions])));
      } else {
        updateDraft("negativeKeywords", Array.from(new Set([...draft.negativeKeywords, ...payload.suggestions])));
      }

      toast({
        title: "Suggestions added",
        description: `Added ${payload.suggestions.length} ${target === "subreddits" ? "subreddit" : "term"} suggestions.`,
      });
    } catch (error) {
      toast({
        title: "AI suggestion failed",
        description: error instanceof Error ? error.message : "Could not generate suggestions.",
        variant: "destructive",
      });
    } finally {
      setAiPending(false);
      setAiTarget(null);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="lg" type="button" variant={triggerVariant}>
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="flex max-h-[calc(100vh-2rem)] flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <DialogHeader>
              <DialogTitle>Create campaign</DialogTitle>
              <DialogDescription>Build the targeting rule one step at a time so nothing important gets skipped.</DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              <div className="h-2 rounded-full bg-[#18181b]">
                <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
              </div>

              {/* <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className={cn(
                      "min-w-fit rounded-full border px-3 py-2",
                      index === stepIndex ? "border-[#52525b] bg-[#18181b]" : "border-[#27272a] bg-[#111113]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-[#6F7C77]">{index + 1}</span>
                      <span className="text-sm font-medium text-[#F3F5F4]">{step.title}</span>
                    </div>
                  </div>
                ))}
              </div> */}

              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.28em] text-[#d4d4d8]">Step {stepIndex + 1}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#fafafa]">{currentStep.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a1a1aa]">{currentStep.description}</p>
              </div>
            </div>

            <div className="mt-8 min-h-[320px] pb-2">
              {isPending ? (
                <SaveProgressPanel activeIndex={saveStageIndex} stages={saveStages} />
              ) : (
                renderStep(stepIndex, draft, updateDraft, {
                  aiPending,
                  aiTarget,
                  onGenerateKeywords: () => generateAiSuggestions("keywords"),
                  onGenerateNegativeKeywords: () => generateAiSuggestions("negativeKeywords"),
                  onGenerateSubreddits: generateSubreddits,
                })
              )}
            </div>

            {stepError || serverFieldError ? (
              <div className="mt-4 rounded-2xl border border-[#7f1d1d] bg-[#241313] px-4 py-3 text-sm text-[#FEE2E2]">
                {stepError ?? serverFieldError}
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#27272a] px-6 py-5 lg:px-8">
            <DialogFooter className="gap-4">
              <div className="text-sm text-[#71717a]">All fields are saved only after the final step completes.</div>
              <div className="flex items-center gap-3">
                {stepIndex > 0 && !isPending ? (
                  <Button onClick={previousStep} type="button" variant="secondary">
                    Back
                  </Button>
                ) : null}
                {stepIndex < steps.length - 1 ? (
                  <Button disabled={isPending} onClick={nextStep} type="button">
                    Next step
                  </Button>
                ) : (
                  <Button disabled={isPending} onClick={saveCampaign} type="button">
                    {isPending ? "Saving..." : "Save campaign"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderStep(
  stepIndex: number,
  draft: Draft,
  updateDraft: <K extends keyof Draft>(key: K, value: Draft[K]) => void,
  options: {
    aiPending: boolean;
    aiTarget: "keywords" | "negativeKeywords" | "subreddits" | null;
    onGenerateKeywords: () => void;
    onGenerateNegativeKeywords: () => void;
    onGenerateSubreddits: () => void;
  },
) {
  if (stepIndex === 0) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Field hint="Example: Startup CRM buyers" label="Campaign name">
          <Input onChange={(event) => updateDraft("name", event.target.value)} placeholder="Startup CRM buyers" value={draft.name} />
        </Field>
        <Field hint="Pick the offer shape users are looking for." label="Lead type">
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
    );
  }

  if (stepIndex === 1) {
    return (
      <Field hint="Optional but useful. Describe the product or service being marketed." label="Description">
        <Textarea
          onChange={(event) => updateDraft("description", event.target.value)}
          placeholder="We help SaaS teams organize pipelines, automate follow-up, and close deals faster."
          value={draft.description}
        />
      </Field>
    );
  }

  if (stepIndex === 2) {
    return (
      <div className="space-y-4">
        <SuggestionPanel
          busy={options.aiPending && options.aiTarget === "keywords"}
          buttonLabel="Generate keywords with AI"
          description="Use the campaign description to generate single-word intent and category keywords automatically."
          onClick={options.onGenerateKeywords}
          title="Need keyword ideas?"
        />
        <Field hint="Optional. Add single-word buying-intent or category terms one by one." label="Keywords">
          <TagInput
            label="Optional. Single word only. Press Enter or comma to add a keyword."
            onChange={(values) => updateDraft("keywords", values)}
            placeholder="Type a keyword and press Enter"
            value={draft.keywords}
          />
        </Field>
        <SuggestionPanel
          busy={options.aiPending && options.aiTarget === "negativeKeywords"}
          buttonLabel="Generate negative keywords with AI"
          description="Optionally generate filtering terms that can remove low-fit, low-intent, or irrelevant Reddit matches."
          onClick={options.onGenerateNegativeKeywords}
          title="Need filtering ideas?"
        />
        <Field hint="Optional. Use these to exclude weak-fit or irrelevant conversations." label="Negative keywords">
          <TagInput
            label="Optional. Add terms you want the campaign to ignore."
            onChange={(values) => updateDraft("negativeKeywords", values)}
            placeholder="Type a negative keyword and press Enter"
            value={draft.negativeKeywords}
          />
        </Field>
      </div>
    );
  }

  if (stepIndex === 3) {
    return (
      <div className="space-y-4">
        <SuggestionPanel
          busy={options.aiPending && options.aiTarget === "subreddits"}
          buttonLabel="Generate subreddits with AI"
          description="Generate subreddit suggestions from the campaign description to find communities with higher lead volume."
          onClick={options.onGenerateSubreddits}
          title="Need subreddit ideas?"
        />

        <Field hint="Add subreddit names. `r/` will be normalized automatically." label="Subreddits">
          <TagInput
            label="Example: startups, saas, smallbusiness."
            onChange={(values) => updateDraft("subreddits", values)}
            placeholder="Type a subreddit and press Enter"
            value={draft.subreddits}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Field hint="Choose how far back the first sync should scan. Maximum 10 days." label="How recent should leads be?">
        <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#d4d4d8]">Recent window</span>
            <span className="text-sm font-medium text-[#fafafa]">{draft.recentDays} days</span>
          </div>
          <input
            className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#18181b] accent-white"
            max={10}
            min={1}
            onChange={(event) => updateDraft("recentDays", event.target.value)}
            type="range"
            value={draft.recentDays}
          />
          <div className="mt-2 flex justify-between text-xs uppercase tracking-[0.2em] text-[#71717a]">
            <span>1 day</span>
            <span>10 days</span>
          </div>
        </div>
      </Field>

      <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <Field hint="Only leads at or above this score will alert later." label="Minimum score to alert">
          <Input
            max={100}
            min={1}
            onChange={(event) => updateDraft("minScoreToAlert", event.target.value)}
            type="number"
            value={draft.minScoreToAlert}
          />
        </Field>

        <label className="flex items-center gap-3 rounded-2xl border border-[#27272a] bg-[#111113] px-4 py-4 text-sm text-[#d4d4d8]">
          <input
            checked={draft.isActive}
            className="h-4 w-4 rounded border-[#27272a] bg-[#09090b] accent-white"
            onChange={(event) => updateDraft("isActive", event.target.checked)}
            type="checkbox"
          />
          Start this campaign in active mode
        </label>
      </div>
    </div>
  );
}

function validateStep(stepIndex: number, draft: Draft) {
  if (stepIndex === 0 && draft.name.trim().length < 2) {
    return "Campaign name must be at least 2 characters.";
  }

  if (stepIndex === 2 && draft.keywords.some((keyword) => /\s/.test(keyword))) {
    return "Each keyword must be a single word.";
  }

  if (stepIndex === 3 && countItems(draft.subreddits) === 0) {
    return "Add at least one subreddit before continuing.";
  }

  if (stepIndex === 4) {
    const recentDays = Number(draft.recentDays);
    const score = Number(draft.minScoreToAlert);

    if (!Number.isInteger(recentDays) || recentDays < 1 || recentDays > 10) {
      return "Recent window must be a whole number between 1 and 10 days.";
    }

    if (!Number.isInteger(score) || score < 1 || score > 100) {
      return "Minimum score must be a whole number between 1 and 100.";
    }
  }

  return null;
}

function validateDraftForSubmit(draft: Draft) {
  const stepChecks = [0, 2, 3, 4] as const;

  for (const step of stepChecks) {
    const message = validateStep(step, draft);
    if (message) {
      return {
        stepIndex: step,
        message,
      };
    }
  }

  return null;
}

function getErroredStep(
  fieldErrors?: Partial<Record<"name" | "description" | "keywords" | "subreddits" | "recentDays" | "minScoreToAlert", string>>,
) {
  if (!fieldErrors) {
    return null;
  }

  if (fieldErrors.name) return 0;
  if (fieldErrors.description) return 1;
  if (fieldErrors.keywords) return 2;
  if (fieldErrors.subreddits) return 3;
  if (fieldErrors.recentDays) return 4;
  if (fieldErrors.minScoreToAlert) return 4;

  return null;
}

function countItems(value: string[]) {
  return value.length;
}

function Field({ children, hint, label }: { children: React.ReactNode; hint: string; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#fafafa]">{label}</span>
      {children}
      <span className="text-sm text-[#71717a]">{hint}</span>
    </label>
  );
}

function SuggestionPanel({
  busy,
  buttonLabel,
  description,
  onClick,
  title,
}: {
  busy: boolean;
  buttonLabel: string;
  description: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#27272a] bg-[#111113] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-[#fafafa]">{title}</div>
        <div className="mt-1 text-sm text-[#a1a1aa]">{description}</div>
      </div>
      <Button disabled={busy} onClick={onClick} type="button" variant="secondary">
        {busy ? "Generating..." : buttonLabel}
      </Button>
    </div>
  );
}

function SaveProgressPanel({
  activeIndex,
  stages,
}: {
  activeIndex: number;
  stages: ReadonlyArray<{ title: string; description: string }>;
}) {
  return (
    <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-5">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <div>
          <div className="text-sm font-medium text-[#fafafa]">Creating campaign</div>
          <div className="text-sm text-[#a1a1aa]">
            {stages[activeIndex]?.description ?? "Working through the campaign setup steps."}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {stages.map((stage, index) => {
          const state =
            index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";

          return (
            <div
              key={stage.title}
              className={
                state === "complete"
                  ? "flex items-center justify-between rounded-xl border border-[#52525b] bg-[#18181b] px-3 py-2"
                  : state === "active"
                    ? "flex items-center justify-between rounded-xl border border-[#3f3f46] bg-[#141416] px-3 py-2"
                    : "flex items-center justify-between rounded-xl border border-[#27272a] bg-[#111113] px-3 py-2"
              }
            >
              <div className="min-w-0 pr-3">
                <div className="text-sm font-medium text-[#fafafa]">{stage.title}</div>
              </div>
              <div
                className={
                  state === "complete"
                    ? "text-[11px] uppercase tracking-[0.2em] text-[#fafafa]"
                    : state === "active"
                      ? "text-[11px] uppercase tracking-[0.2em] text-[#d4d4d8]"
                      : "text-[11px] uppercase tracking-[0.2em] text-[#71717a]"
                }
              >
                {state === "complete" ? "Done" : state === "active" ? "Running" : "Waiting"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
