"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";

import {
  type CampaignClientAccessActionState,
  upsertCampaignClientAccess,
} from "@/app/(app)/admin/analytics/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CampaignOption = {
  id: string;
  name: string;
  owner: string;
};

const initialState: CampaignClientAccessActionState = {
  status: "idle",
};

export function CampaignClientOnboardingForm({ campaigns }: { campaigns: CampaignOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(upsertCampaignClientAccess, initialState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Field hint="Choose the existing campaign to share." label="Campaign">
          <select
            className="flex h-11 w-full rounded-xl border border-[#27272a] bg-[#09090b] px-3 text-sm text-[#fafafa] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
            disabled={campaigns.length === 0}
            name="campaignId"
            required
          >
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} - {campaign.owner}
              </option>
            ))}
          </select>
        </Field>

        <Field hint="Access is matched to this email when the client logs in." label="Client email">
          <Input autoComplete="email" name="email" placeholder="client@example.com" required type="email" />
        </Field>
      </div>

      <Field hint="This name appears only in the client's campaign dashboard." label="Client-facing campaign name">
        <Input name="displayName" placeholder="Client campaign name" required />
      </Field>

      {state.message ? (
        <p
          className={`rounded-[16px] px-4 py-3 text-[13px] leading-5 ${
            state.status === "success"
              ? "bg-[#12331f] text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]"
              : "bg-[#3a151b] text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-[#27272a] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-5 text-[#8f8f8f]">
          The client can view this campaign and edit only the real campaign description.
        </p>
        <Button
          className="w-full rounded-full border-none bg-[#1ed760] text-[11px] font-bold uppercase tracking-[0.14em] text-[#121212] hover:bg-[#3be477] sm:w-auto"
          disabled={isPending || campaigns.length === 0}
          type="submit"
        >
          <UserPlus className="h-4 w-4" />
          {isPending ? "Creating..." : "Create access"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  children,
  hint,
  label,
}: {
  children: React.ReactNode;
  hint: string;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#f3f5f4]">{label}</span>
      {children}
      <span className="text-sm text-[#6f7c77]">{hint}</span>
    </label>
  );
}
