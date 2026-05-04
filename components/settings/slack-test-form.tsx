"use client";

import { useActionState, useEffect } from "react";

import { sendSlackTestMessage, type SettingsActionState } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const initialState: SettingsActionState = {
  status: "idle",
};

export function SlackTestForm({
  hasWebhook,
  webhookLabel,
}: {
  hasWebhook: boolean;
  webhookLabel: string;
}) {
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(sendSlackTestMessage, initialState);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast({
        title: "Slack test sent",
        description: state.message,
      });
    }

    if (state.status === "error" && state.message) {
      toast({
        title: "Slack test failed",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  return (
    <form
      action={formAction}
      className="grid gap-5 rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            Slack test
          </div>
          <span
            className={
              hasWebhook
                ? "rounded-full bg-[#121212] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]"
                : "rounded-full bg-[#121212] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3727f]"
            }
          >
            {webhookLabel}
          </span>
        </div>
        <div className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
          Send a manual test notification to your saved Slack webhook and confirm it arrives on mobile.
        </div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-[#fdfdfd]">Message</span>
        <textarea
          className="min-h-[140px] rounded-[18px] border-none bg-[#121212] px-4 py-4 text-sm text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] outline-none transition-colors placeholder:text-[#71717a] focus-visible:ring-2 focus-visible:ring-white/10"
          defaultValue="Test notification from Redbot Leads. If this appears in Slack, webhook delivery is working."
          name="message"
          placeholder="Type any message to send to Slack..."
        />
      </label>

      {state.status === "error" && state.message ? (
        <div className="rounded-[18px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          {state.message}
        </div>
      ) : null}

      {state.status === "success" && state.message ? (
        <div className="rounded-[18px] bg-[#102414] px-4 py-3 text-sm text-[#d1fae5] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          {state.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-5">
        <div className="text-sm leading-6 text-[#b3b3b3]">
          The test uses the webhook already saved on your account. No worker queue is involved.
        </div>
        <Button
          disabled={isPending || !hasWebhook}
          type="submit"
          className="rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-none hover:bg-[#3be477]"
        >
          {isPending ? "Sending..." : "Send test"}
        </Button>
      </div>
    </form>
  );
}
