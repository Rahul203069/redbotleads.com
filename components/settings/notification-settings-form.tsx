"use client";

import { useActionState, useEffect, useRef } from "react";

import { disconnectSlack, updateNotificationSettings, type SettingsActionState } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const initialState: SettingsActionState = {
  status: "idle",
};

export function NotificationSettingsForm({
  deliveryEmail,
  defaultEmailAlertsEnabled,
  slackChannelName,
  slackConfigurationUrl,
  slackTeamName,
}: {
  deliveryEmail: string;
  defaultEmailAlertsEnabled: boolean;
  slackChannelName?: string | null;
  slackConfigurationUrl?: string | null;
  slackTeamName?: string | null;
}) {
  const { toast } = useToast();
  const emailFormRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(updateNotificationSettings, initialState);
  const [disconnectState, disconnectAction, isDisconnecting] = useActionState(disconnectSlack, initialState);
  const isSlackConnected = Boolean(slackTeamName || slackChannelName || slackConfigurationUrl);
  const slackLabel = [slackTeamName, slackChannelName ? `#${slackChannelName}` : null].filter(Boolean).join(" / ");

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

  useEffect(() => {
    if (disconnectState.status === "success" && disconnectState.message) {
      toast({
        title: "Slack disconnected",
        description: disconnectState.message,
      });
    }

    if (disconnectState.status === "error" && disconnectState.message) {
      toast({
        title: "Could not disconnect Slack",
        description: disconnectState.message,
        variant: "destructive",
      });
    }
  }, [disconnectState, toast]);

  return (
    <div className="grid gap-5 rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <form ref={emailFormRef} action={formAction} className="grid gap-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            Notifications
          </div>
          <div className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
            Configure fallback email alerts and connect Slack for lead delivery.
          </div>
        </div>

        <div className="grid gap-2 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
          <label className="flex items-center gap-3 text-sm text-[#cbcbcb]">
            <input
              className="h-4 w-4 rounded border-[#27272a] bg-[#121212] accent-[#1ed760]"
              defaultChecked={defaultEmailAlertsEnabled}
              disabled={isPending}
              name="emailAlertsEnabled"
              onChange={() => emailFormRef.current?.requestSubmit()}
              type="checkbox"
            />
            {isPending ? "Saving email alerts..." : "Email alerts enabled"}
          </label>
          <div className="pl-7 text-sm text-[#b3b3b3]">
            When Slack is not connected, lead alerts will be sent to{" "}
            <span className="text-[#fdfdfd]">{deliveryEmail}</span>.
          </div>
        </div>

        {state.status === "error" && state.message ? (
          <div className="rounded-[18px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
            {state.message}
          </div>
        ) : null}

        <div className="border-t border-white/8 pt-5">
          <div className="text-sm leading-6 text-[#b3b3b3]">
            Email preference saves automatically. Slack is used when connected; email is only the fallback channel.
          </div>
        </div>
      </form>

      <div className="grid gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-[#fdfdfd]">Slack workspace</div>
            <div className="mt-1 text-sm text-[#b3b3b3]">
              {isSlackConnected ? slackLabel || "Connected with Slack OAuth" : "Connect Slack to choose an alert channel."}
            </div>
          </div>
          <span
            className={
              isSlackConnected
                ? "rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]"
                : "rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3727f]"
            }
          >
            {isSlackConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <a
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] transition hover:bg-[#3be477]"
            href="/api/slack/install"
          >
            {isSlackConnected ? "Reconnect Slack" : "Connect Slack"}
          </a>
          {slackConfigurationUrl ? (
            <a
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#252525]"
              href={slackConfigurationUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open Slack config
            </a>
          ) : null}
          {isSlackConnected ? (
            <form action={disconnectAction}>
              <Button
                disabled={isDisconnecting}
                type="submit"
                className="w-full rounded-full border-none bg-[#2a1515] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#fecaca] shadow-none hover:bg-[#3a1c1c]"
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect Slack"}
              </Button>
            </form>
          ) : null}
        </div>

        {disconnectState.status === "error" && disconnectState.message ? (
          <div className="rounded-[18px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
            {disconnectState.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
