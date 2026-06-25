"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  connectTelegram,
  disconnectSlack,
  disconnectTelegram,
  sendTelegramTestMessage,
  updateNotificationSettings,
  type SettingsActionState,
} from "@/actions/settings";
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
  telegramConnectedAt,
  telegramUsername,
  defaultPreferredAlertChannel,
}: {
  deliveryEmail: string;
  defaultEmailAlertsEnabled: boolean;
  defaultPreferredAlertChannel: "EMAIL" | "SLACK" | "TELEGRAM";
  slackChannelName?: string | null;
  slackConfigurationUrl?: string | null;
  slackTeamName?: string | null;
  telegramConnectedAt?: Date | string | null;
  telegramUsername?: string | null;
}) {
  const { toast } = useToast();
  const emailFormRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(updateNotificationSettings, initialState);
  const [disconnectState, disconnectAction, isDisconnecting] = useActionState(disconnectSlack, initialState);
  const [telegramConnectState, telegramConnectAction, isConnectingTelegram] = useActionState(connectTelegram, initialState);
  const [telegramDisconnectState, telegramDisconnectAction, isDisconnectingTelegram] = useActionState(disconnectTelegram, initialState);
  const [telegramTestState, telegramTestAction, isTestingTelegram] = useActionState(sendTelegramTestMessage, initialState);
  const isSlackConnected = Boolean(slackTeamName || slackChannelName || slackConfigurationUrl);
  const slackLabel = [slackTeamName, slackChannelName ? `#${slackChannelName}` : null].filter(Boolean).join(" / ");
  const isTelegramConnected = Boolean(telegramConnectedAt);
  const telegramLabel = telegramUsername ? `@${telegramUsername}` : "Connected Telegram chat";

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

  useEffect(() => {
    const states = [
      {
        state: telegramConnectState,
        successTitle: "Telegram setup",
        errorTitle: "Could not connect Telegram",
      },
      {
        state: telegramDisconnectState,
        successTitle: "Telegram disconnected",
        errorTitle: "Could not disconnect Telegram",
      },
      {
        state: telegramTestState,
        successTitle: "Telegram test sent",
        errorTitle: "Could not send Telegram test",
      },
    ];

    for (const item of states) {
      if (item.state.status === "success" && item.state.message) {
        toast({
          title: item.successTitle,
          description: item.state.message,
        });
      }

      if (item.state.status === "error" && item.state.message) {
        toast({
          title: item.errorTitle,
          description: item.state.message,
          variant: "destructive",
        });
      }
    }
  }, [telegramConnectState, telegramDisconnectState, telegramTestState, toast]);

  return (
    <div className="grid gap-5 rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <form ref={emailFormRef} action={formAction} className="grid gap-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            Notifications
          </div>
          <div className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
            Choose the primary lead alert channel and configure delivery fallbacks.
          </div>
        </div>

        <div className="grid gap-3 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
          <div>
            <div className="text-sm font-medium text-[#fdfdfd]">Primary alert channel</div>
            <div className="mt-1 text-sm text-[#b3b3b3]">
              Lead alerts use this first, then fall back to another configured channel.
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["SLACK", "TELEGRAM", "EMAIL"] as const).map((channel) => (
              <label
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-[#1f1f1f] px-3 py-2 text-sm text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
                key={channel}
              >
                <input
                  className="h-4 w-4 border-[#27272a] bg-[#121212] accent-[#1ed760]"
                  defaultChecked={defaultPreferredAlertChannel === channel}
                  disabled={isPending}
                  name="preferredAlertChannel"
                  onChange={() => emailFormRef.current?.requestSubmit()}
                  type="radio"
                  value={channel}
                />
                {channel === "SLACK" ? "Slack" : channel === "TELEGRAM" ? "Telegram" : "Email"}
              </label>
            ))}
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
            Notification preferences save automatically. Connect Slack or Telegram before choosing them as primary channels.
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

      <div className="grid gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-[#fdfdfd]">Telegram bot</div>
            <div className="mt-1 text-sm text-[#b3b3b3]">
              {isTelegramConnected ? telegramLabel : "Connect Telegram to receive lead alerts in chat."}
            </div>
          </div>
          <span
            className={
              isTelegramConnected
                ? "rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]"
                : "rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3727f]"
            }
          >
            {isTelegramConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <form action={telegramConnectAction}>
            <Button
              disabled={isConnectingTelegram}
              type="submit"
              className="w-full rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-none hover:bg-[#3be477]"
            >
              {isConnectingTelegram ? "Opening Telegram..." : isTelegramConnected ? "Reconnect Telegram" : "Connect Telegram"}
            </Button>
          </form>

          {isTelegramConnected ? (
            <>
              <form action={telegramTestAction}>
                <input
                  name="message"
                  type="hidden"
                  value="Test notification from Redbot Leads. If this appears in Telegram, bot delivery is working."
                />
                <Button
                  disabled={isTestingTelegram}
                  type="submit"
                  className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525]"
                >
                  {isTestingTelegram ? "Sending..." : "Send test"}
                </Button>
              </form>
              <form action={telegramDisconnectAction}>
                <Button
                  disabled={isDisconnectingTelegram}
                  type="submit"
                  className="w-full rounded-full border-none bg-[#2a1515] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#fecaca] shadow-none hover:bg-[#3a1c1c]"
                >
                  {isDisconnectingTelegram ? "Disconnecting..." : "Disconnect Telegram"}
                </Button>
              </form>
            </>
          ) : null}
        </div>

        {[telegramConnectState, telegramDisconnectState, telegramTestState].map((telegramState, index) =>
          telegramState.status === "error" && telegramState.message ? (
            <div
              className="rounded-[18px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
              key={`${telegramState.message}-${index}`}
            >
              {telegramState.message}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
