"use client";

import { useMemo, useState, useTransition } from "react";

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
    description: "Define the buying-intent phrases and category terms that should trigger candidate matches.",
  },
  {
    title: "Negative keywords",
    description: "Filter out low-fit traffic before it reaches lead review.",
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
    fieldErrors?: Partial<Record<"name" | "description" | "keywords" | "subreddits" | "minScoreToAlert", string>>;
  }>({});
  const [isPending, startTransition] = useTransition();

  const currentStep = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  function resetWizard() {
    setOpen(false);
    setStepIndex(0);
    setDraft(initialDraft);
    setStepError(null);
    setServerState({});
  }

  function handleOpenChange(nextOpen: boolean) {
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
    if (stepIndex === 4) return serverState.fieldErrors?.subreddits;
    if (stepIndex === 5) return serverState.fieldErrors?.minScoreToAlert;
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
        <div>
          <div className="p-6 lg:p-8">
            <DialogHeader>
              <DialogTitle>Create campaign</DialogTitle>
              <DialogDescription>Build the targeting rule one step at a time so nothing important gets skipped.</DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              <div className="h-2 rounded-full bg-[#161D1B]">
                <div className="h-2 rounded-full bg-[#7BF179] transition-all" style={{ width: `${progress}%` }} />
              </div>

              {/* <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className={cn(
                      "min-w-fit rounded-full border px-3 py-2",
                      index === stepIndex ? "border-[#7BF179]/35 bg-[#18231b]" : "border-[#27312E] bg-[#111716]",
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
                <p className="text-xs uppercase tracking-[0.28em] text-[#7BF179]">Step {stepIndex + 1}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#F3F5F4]">{currentStep.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9DA9A4]">{currentStep.description}</p>
              </div>
            </div>

            <div className="mt-8 min-h-[320px]">
              {renderStep(stepIndex, draft, updateDraft, {
                aiPending,
                aiTarget,
                onGenerateKeywords: () => generateAiSuggestions("keywords"),
                onGenerateNegativeKeywords: () => generateAiSuggestions("negativeKeywords"),
                onGenerateSubreddits: generateSubreddits,
              })}
            </div>

            {stepError || serverFieldError ? (
              <div className="mt-4 rounded-2xl border border-[#7f1d1d] bg-[#241313] px-4 py-3 text-sm text-[#FEE2E2]">
                {stepError ?? serverFieldError}
              </div>
            ) : null}

            <DialogFooter className="mt-8 border-t border-[#27312E] pt-5">
              <div className="text-sm text-[#6F7C77]">All fields are saved only after the final step completes.</div>
              <div className="flex items-center gap-3">
                {stepIndex > 0 ? (
                  <Button onClick={previousStep} type="button" variant="secondary">
                    Back
                  </Button>
                ) : null}
                {stepIndex < steps.length - 1 ? (
                  <Button onClick={nextStep} type="button">
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
            className="flex h-11 w-full rounded-md border border-[#27312E] bg-[#111716] px-3 text-sm text-[#F3F5F4] outline-none transition-colors focus-visible:border-[#7BF179]/70 focus-visible:ring-2 focus-visible:ring-[#7BF179]/20"
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
          description="Use the campaign description to generate intent and category keywords automatically."
          onClick={options.onGenerateKeywords}
          title="Need keyword ideas?"
        />
        <Field hint="Add buying-intent and category terms one by one." label="Keywords">
          <TagInput
            label="Press Enter or comma to add a keyword."
            onChange={(values) => updateDraft("keywords", values)}
            placeholder="Type a keyword and press Enter"
            value={draft.keywords}
          />
        </Field>
      </div>
    );
  }

  if (stepIndex === 3) {
    return (
      <div className="space-y-4">
        <SuggestionPanel
          busy={options.aiPending && options.aiTarget === "negativeKeywords"}
          buttonLabel="Generate negative keywords with AI"
          description="Generate filtering terms that can remove low-fit, low-intent, or irrelevant Reddit matches."
          onClick={options.onGenerateNegativeKeywords}
          title="Need filtering ideas?"
        />
        <Field hint="Use these to exclude weak-fit or irrelevant conversations." label="Negative keywords">
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

  if (stepIndex === 4) {
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

      <label className="flex items-center gap-3 rounded-2xl border border-[#27312E] bg-[#161D1B] px-4 py-4 text-sm text-[#C3CBC8]">
        <input
          checked={draft.isActive}
          className="h-4 w-4 rounded border-[#27312E] bg-[#111716] accent-[#7BF179]"
          onChange={(event) => updateDraft("isActive", event.target.checked)}
          type="checkbox"
        />
        Start this campaign in active mode
      </label>
    </div>
  );
}

function validateStep(stepIndex: number, draft: Draft) {
  if (stepIndex === 0 && draft.name.trim().length < 2) {
    return "Campaign name must be at least 2 characters.";
  }

  if (stepIndex === 2 && countItems(draft.keywords) === 0) {
    return "Add at least one keyword before continuing.";
  }

  if (stepIndex === 4 && countItems(draft.subreddits) === 0) {
    return "Add at least one subreddit before continuing.";
  }

  if (stepIndex === 5) {
    const score = Number(draft.minScoreToAlert);

    if (!Number.isInteger(score) || score < 1 || score > 100) {
      return "Minimum score must be a whole number between 1 and 100.";
    }
  }

  return null;
}

function validateDraftForSubmit(draft: Draft) {
  const stepChecks = [0, 2, 4, 5] as const;

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
  fieldErrors?: Partial<Record<"name" | "description" | "keywords" | "subreddits" | "minScoreToAlert", string>>,
) {
  if (!fieldErrors) {
    return null;
  }

  if (fieldErrors.name) return 0;
  if (fieldErrors.description) return 1;
  if (fieldErrors.keywords) return 2;
  if (fieldErrors.subreddits) return 4;
  if (fieldErrors.minScoreToAlert) return 5;

  return null;
}

function countItems(value: string[]) {
  return value.length;
}

function Field({ children, hint, label }: { children: React.ReactNode; hint: string; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#F3F5F4]">{label}</span>
      {children}
      <span className="text-sm text-[#6F7C77]">{hint}</span>
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
    <div className="flex flex-col gap-3 rounded-2xl border border-[#27312E] bg-[#161D1B] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-[#F3F5F4]">{title}</div>
        <div className="mt-1 text-sm text-[#9DA9A4]">{description}</div>
      </div>
      <Button disabled={busy} onClick={onClick} type="button" variant="secondary">
        {busy ? "Generating..." : buttonLabel}
      </Button>
    </div>
  );
}
