"use client";

import { useActionState, useEffect } from "react";

import { updateNotificationSettings, type SettingsActionState } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const initialState: SettingsActionState = {
  status: "idle",
};

export function NotificationSettingsForm({
  deliveryEmail,
  defaultEmailAlertsEnabled,
  defaultSlackWebhookUrl,
}: {
  deliveryEmail: string;
  defaultEmailAlertsEnabled: boolean;
  defaultSlackWebhookUrl: string;
}) {
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(updateNotificationSettings, initialState);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast({
        title: "Settings updated",
        description: state.message,
      });
    }

    if (state.status === "error" && state.message) {
      toast({
        title: "Could not update settings",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction} className="grid gap-5 rounded-[24px] border border-[#27272a] bg-[#111113] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">Notifications</div>
        <div className="mt-2 text-sm text-[#a1a1aa]">Configure email alerts and connect a Slack webhook for future delivery flows.</div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-[#27272a] bg-[#09090b] px-4 py-4">
        <label className="flex items-center gap-3 text-sm text-[#d4d4d8]">
          <input
            className="h-4 w-4 rounded border-[#27272a] bg-[#09090b] accent-white"
            defaultChecked={defaultEmailAlertsEnabled}
            name="emailAlertsEnabled"
            type="checkbox"
          />
          Email alerts enabled
        </label>
        <div className="pl-7 text-sm text-[#71717a]">
          Alerts will be delivered to <span className="text-[#fafafa]">{deliveryEmail}</span>.
        </div>
      </div>

      <label className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#fafafa]">Connect Slack</span>
          <span
            className={
              defaultSlackWebhookUrl.trim()
                ? "rounded-full border border-[#3f3f46] bg-[#18181b] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#d4d4d8]"
                : "rounded-full border border-[#7f1d1d] bg-[#241313] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#fca5a5]"
            }
          >
            {defaultSlackWebhookUrl.trim() ? "Connected" : "Not connected"}
          </span>
        </div>
        <input
          className="flex h-11 w-full rounded-xl border border-[#27272a] bg-[#09090b] px-3 text-sm text-[#fafafa] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
          defaultValue={defaultSlackWebhookUrl}
          name="slackWebhookUrl"
          placeholder="https://hooks.slack.com/services/..."
          type="url"
        />
        <span className="text-sm text-[#71717a]">Paste a Slack incoming webhook URL to connect this workspace.</span>
      </label>

      {state.status === "error" && state.message ? (
        <div className="rounded-2xl border border-[#7f1d1d] bg-[#241313] px-4 py-3 text-sm text-[#FEE2E2]">
          {state.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t border-[#27272a] pt-5">
        <div className="text-sm text-[#71717a]">Slack notifications can be connected now even if delivery workflows expand later.</div>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save notifications"}
        </Button>
      </div>
    </form>
  );
}
