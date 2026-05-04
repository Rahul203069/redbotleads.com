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
    <form
      action={formAction}
      className="grid gap-5 rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
    >
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
          Notifications
        </div>
        <div className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
          Configure email alerts and connect a Slack webhook for future delivery flows.
        </div>
      </div>

      <div className="grid gap-2 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <label className="flex items-center gap-3 text-sm text-[#cbcbcb]">
          <input
            className="h-4 w-4 rounded border-[#27272a] bg-[#121212] accent-[#1ed760]"
            defaultChecked={defaultEmailAlertsEnabled}
            name="emailAlertsEnabled"
            type="checkbox"
          />
          Email alerts enabled
        </label>
        <div className="pl-7 text-sm text-[#b3b3b3]">
          Alerts will be delivered to <span className="text-[#fdfdfd]">{deliveryEmail}</span>.
        </div>
      </div>

      <label className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#fdfdfd]">Connect Slack</span>
          <span
            className={
              defaultSlackWebhookUrl.trim()
                ? "rounded-full bg-[#121212] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]"
                : "rounded-full bg-[#121212] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3727f]"
            }
          >
            {defaultSlackWebhookUrl.trim() ? "Connected" : "Not connected"}
          </span>
        </div>
        <input
          className="flex h-11 w-full rounded-[16px] border-none bg-[#121212] px-4 text-sm text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] outline-none transition-colors placeholder:text-[#71717a] focus-visible:ring-2 focus-visible:ring-white/10"
          defaultValue={defaultSlackWebhookUrl}
          name="slackWebhookUrl"
          placeholder="https://hooks.slack.com/services/..."
          type="url"
        />
        <span className="text-sm text-[#b3b3b3]">
          Paste a Slack incoming webhook URL to connect this workspace.
        </span>
      </label>

      {state.status === "error" && state.message ? (
        <div className="rounded-[18px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          {state.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-5">
        <div className="text-sm leading-6 text-[#b3b3b3]">
          Slack notifications can be connected now even if delivery workflows expand later.
        </div>
        <Button
          disabled={isPending}
          type="submit"
          className="rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-none hover:bg-[#3be477]"
        >
          {isPending ? "Saving..." : "Save notifications"}
        </Button>
      </div>
    </form>
  );
}
