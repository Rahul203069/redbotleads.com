"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  connectTelegram,
  disconnectSlack,
  disconnectTelegram,
  sendTelegramTestMessage,
  updateNotificationAlertThreshold,
  updateNotificationSettings,
  type SettingsActionState,
} from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const initialState: SettingsActionState = {
  status: "idle",
};

const notificationChannels = ["SLACK", "TELEGRAM"] as const;

type NotificationChannel = (typeof notificationChannels)[number];

export function NotificationSettingsForm({
  defaultEmailAlertsEnabled,
  slackChannelName,
  slackConfigurationUrl,
  slackTeamName,
  telegramConnectedAt,
  telegramUsername,
  defaultPreferredAlertChannel,
  notificationThresholdCampaigns,
}: {
  defaultEmailAlertsEnabled: boolean;
  defaultPreferredAlertChannel: "EMAIL" | "SLACK" | "TELEGRAM";
  notificationThresholdCampaigns?: Array<{
    id: string;
    minScoreToAlert: number;
    name: string;
    role: "OWNER" | "CLIENT";
  }>;
  slackChannelName?: string | null;
  slackConfigurationUrl?: string | null;
  slackTeamName?: string | null;
  telegramConnectedAt?: Date | string | null;
  telegramUsername?: string | null;
}) {
  const { toast } = useToast();
  const channelPreferenceFormRef = useRef<HTMLFormElement>(null);
  const channelPreferenceInputRef = useRef<HTMLInputElement>(null);
  const telegramConnectFormRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(updateNotificationSettings, initialState);
  const [disconnectState, disconnectAction, isDisconnecting] = useActionState(disconnectSlack, initialState);
  const [telegramConnectState, telegramConnectAction, isConnectingTelegram] = useActionState(connectTelegram, initialState);
  const [telegramDisconnectState, telegramDisconnectAction, isDisconnectingTelegram] = useActionState(disconnectTelegram, initialState);
  const [telegramTestState, telegramTestAction, isTestingTelegram] = useActionState(sendTelegramTestMessage, initialState);
  const [thresholdState, thresholdAction, isSavingThreshold] = useActionState(
    updateNotificationAlertThreshold,
    initialState,
  );
  const isSlackConnected = Boolean(slackTeamName || slackChannelName || slackConfigurationUrl);
  const slackLabel = [slackTeamName, slackChannelName ? `#${slackChannelName}` : null].filter(Boolean).join(" / ");
  const isTelegramConnected = Boolean(telegramConnectedAt);
  const telegramLabel = telegramUsername ? `@${telegramUsername}` : "Connected Telegram chat";
  const activeAlertChannel: NotificationChannel | null = defaultPreferredAlertChannel === "SLACK"
    || defaultPreferredAlertChannel === "TELEGRAM"
    ? defaultPreferredAlertChannel
    : null;
  const [managedChannel, setManagedChannel] = useState<NotificationChannel>(
    activeAlertChannel ?? (isSlackConnected ? "SLACK" : isTelegramConnected ? "TELEGRAM" : "SLACK"),
  );
  const [isOpeningSlack, setIsOpeningSlack] = useState(false);
  const managedChannelIsConnected = managedChannel === "SLACK" ? isSlackConnected : isTelegramConnected;
  const managedChannelIsActive = activeAlertChannel === managedChannel;
  const selectionPendingChannel: NotificationChannel | null = isPending
    ? managedChannel
    : isConnectingTelegram
      ? "TELEGRAM"
      : isOpeningSlack
        ? "SLACK"
        : null;
  const channelSelectionPending = selectionPendingChannel !== null;

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
    if (thresholdState.status === "success" && thresholdState.message) {
      toast({
        title: "Alert score updated",
        description: thresholdState.message,
      });
    }

    if (thresholdState.status === "error" && thresholdState.message) {
      toast({
        title: "Could not update alert score",
        description: thresholdState.message,
        variant: "destructive",
      });
    }
  }, [thresholdState, toast]);

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

  function handleChannelSelection(channel: NotificationChannel) {
    if (channelSelectionPending) return;

    const isConnected = channel === "SLACK" ? isSlackConnected : isTelegramConnected;
    setManagedChannel(channel);

    if (isConnected && activeAlertChannel === channel) return;

    if (!isConnected) {
      if (channel === "SLACK") {
        setIsOpeningSlack(true);
        window.location.assign("/api/slack/install");
      } else {
        telegramConnectFormRef.current?.requestSubmit();
      }
      return;
    }

    if (channelPreferenceInputRef.current) {
      channelPreferenceInputRef.current.value = channel;
    }
    channelPreferenceFormRef.current?.requestSubmit();
  }

  return (
    <div className="grid gap-5 rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <form action={formAction} className="hidden" ref={channelPreferenceFormRef}>
        {defaultEmailAlertsEnabled ? <input name="emailAlertsEnabled" type="hidden" value="on" /> : null}
        <input name="preferredAlertChannel" ref={channelPreferenceInputRef} type="hidden" />
      </form>
      <form action={telegramConnectAction} className="hidden" ref={telegramConnectFormRef} />

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
          Notifications
        </div>
        <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-[#fdfdfd]">
          Manage alert delivery
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#b3b3b3]">
          Connect both channels if you like, then choose which one should receive new lead alerts.
        </p>
      </div>

      <section
        aria-labelledby="notification-channel-manager"
        className="grid gap-4 rounded-[18px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:p-4"
      >
        <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-[#fdfdfd]" id="notification-channel-manager">
              Notification channels
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">
              Select a channel to use it. If setup is required, we will open its connection flow first.
            </p>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
            One active at a time
          </p>
        </div>

        <div
          aria-label="Choose the active notification channel"
          className="grid grid-cols-2 gap-1.5 rounded-[16px] border border-white/[0.07] bg-[#0d0d0d] p-1.5"
          role="group"
        >
          {notificationChannels.map((channel) => {
            const isActive = activeAlertChannel === channel;
            const isConnected = channel === "SLACK" ? isSlackConnected : isTelegramConnected;
            const isSelected = managedChannel === channel;
            const isChannelPending = selectionPendingChannel === channel;

            return (
              <button
                aria-busy={isChannelPending || undefined}
                aria-pressed={isActive}
                className={`flex min-h-[64px] cursor-pointer items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-wait disabled:opacity-70 sm:px-4 ${isSelected ? "bg-[#252525] text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)]" : "text-[#a7a7a7] hover:bg-[#181818] hover:text-white"}`}
                disabled={channelSelectionPending}
                key={channel}
                onClick={() => handleChannelSelection(channel)}
                type="button"
              >
                <ChannelLogo channel={channel} size="sm" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">
                    {channel === "SLACK" ? "Slack" : "Telegram"}
                  </span>
                  <span className={`mt-0.5 block text-[9px] font-bold uppercase tracking-[0.12em] ${isActive ? "text-[#73f5a0]" : isConnected ? "text-[#c7c7c7]" : "text-[#8f8f8f]"}`}>
                    {isChannelPending
                      ? isConnected ? "Switching..." : "Opening setup..."
                      : getChannelStatusLabel({ isActive, isConnected })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          aria-label={`${managedChannel === "SLACK" ? "Slack" : "Telegram"} channel details`}
          className="grid gap-5 rounded-[16px] border border-white/[0.06] bg-[#181818] p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <ChannelLogo channel={managedChannel} />
              <div className="min-w-0">
                <h4 className="text-[15px] font-bold text-[#fdfdfd]">
                  {managedChannel === "SLACK" ? "Slack workspace" : "Telegram bot"}
                </h4>
                <p className="mt-1 break-words text-[12px] leading-5 text-[#a7a7a7]">
                  {managedChannel === "SLACK"
                    ? isSlackConnected
                      ? slackLabel || "Connected with Slack OAuth"
                      : "Connect a workspace and choose the Slack channel for lead alerts."
                    : isTelegramConnected
                      ? telegramLabel
                      : "Connect a Telegram chat to receive new lead alerts."}
                </p>
              </div>
            </div>
            <ChannelStatusBadge
              isActive={managedChannelIsActive}
              isConnected={managedChannelIsConnected}
            />
          </div>

          {managedChannelIsActive && !managedChannelIsConnected ? (
            <div className="rounded-[14px] border border-[#ffd66e]/20 bg-[#251f10] px-4 py-3" role="status">
              <p className="text-[12px] font-bold text-[#ffd66e]">Connection required</p>
              <p className="mt-1 text-[11px] leading-5 text-[#c7b989]">
                This is your active channel, but alerts cannot be delivered until it is connected again.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-[14px] bg-[#111111] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <p className="text-[12px] font-bold text-white">Alert destination</p>
              <p className="mt-1 text-[11px] leading-5 text-[#8f8f8f]">
                {selectionPendingChannel === managedChannel
                  ? managedChannelIsConnected
                    ? `Switching lead alerts to ${managedChannel === "SLACK" ? "Slack" : "Telegram"}.`
                    : `Opening ${managedChannel === "SLACK" ? "Slack" : "Telegram"} setup. It will become active after connection succeeds.`
                  : managedChannelIsActive
                  ? `${managedChannel === "SLACK" ? "Slack" : "Telegram"} is currently selected for qualified lead alerts.`
                  : managedChannelIsConnected
                    ? `Select the ${managedChannel === "SLACK" ? "Slack" : "Telegram"} channel above to route new alerts here.`
                    : `Select the ${managedChannel === "SLACK" ? "Slack" : "Telegram"} channel above to complete setup.`}
              </p>
            </div>
            <span
              aria-live="polite"
              className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.13em] ${managedChannelIsActive && managedChannelIsConnected ? "bg-[#1ed760]/10 text-[#73f5a0]" : selectionPendingChannel === managedChannel ? "bg-[#3b2d10] text-[#ffd66e]" : "bg-[#252525] text-[#a7a7a7]"}`}
            >
              {selectionPendingChannel === managedChannel
                ? managedChannelIsConnected ? "Switching..." : "Opening setup..."
                : managedChannelIsActive ? "Active channel" : managedChannelIsConnected ? "Ready" : "Setup required"}
            </span>
          </div>

          {managedChannelIsConnected ? (
            <div className="grid gap-3 border-t border-white/[0.07] pt-5 sm:flex sm:flex-wrap sm:items-center">
            {managedChannel === "SLACK" ? (
              <>
                {isSlackConnected ? (
                  <a
                    className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-[#252525] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] transition-colors duration-200 hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    href="/api/slack/install"
                  >
                    Reconnect Slack
                  </a>
                ) : null}
                {slackConfigurationUrl ? (
                  <a
                    className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-[#252525] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] transition-colors duration-200 hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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
                      className="w-full rounded-full border-none bg-[#2a1515] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#fecaca] shadow-none hover:bg-[#3a1c1c]"
                      disabled={isDisconnecting}
                      type="submit"
                    >
                      {isDisconnecting ? "Disconnecting..." : "Disconnect Slack"}
                    </Button>
                  </form>
                ) : null}
              </>
            ) : (
              <>
                {isTelegramConnected ? (
                  <>
                    <form action={telegramConnectAction}>
                      <Button
                        className="w-full rounded-full border-none bg-[#252525] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-none hover:bg-[#303030]"
                        disabled={isConnectingTelegram}
                        type="submit"
                      >
                        {isConnectingTelegram ? "Opening Telegram..." : "Reconnect Telegram"}
                      </Button>
                    </form>
                    <form action={telegramTestAction}>
                      <input
                        name="message"
                        type="hidden"
                        value="Test notification from Redbot Leads. If this appears in Telegram, bot delivery is working."
                      />
                      <Button
                        className="w-full rounded-full border-none bg-[#252525] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-none hover:bg-[#303030]"
                        disabled={isTestingTelegram}
                        type="submit"
                      >
                        {isTestingTelegram ? "Sending..." : "Send test"}
                      </Button>
                    </form>
                    <form action={telegramDisconnectAction}>
                      <Button
                        className="w-full rounded-full border-none bg-[#2a1515] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#fecaca] shadow-none hover:bg-[#3a1c1c]"
                        disabled={isDisconnectingTelegram}
                        type="submit"
                      >
                        {isDisconnectingTelegram ? "Disconnecting..." : "Disconnect Telegram"}
                      </Button>
                    </form>
                  </>
                ) : null}
              </>
            )}
            </div>
          ) : null}

          {state.status === "error" && state.message ? (
            <div className="rounded-[14px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2]" role="alert">
              {state.message}
            </div>
          ) : null}

          {managedChannel === "SLACK" && disconnectState.status === "error" && disconnectState.message ? (
            <div className="rounded-[14px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2]" role="alert">
              {disconnectState.message}
            </div>
          ) : null}

          {managedChannel === "TELEGRAM"
            ? [telegramConnectState, telegramDisconnectState, telegramTestState].map((telegramState, index) =>
                telegramState.status === "error" && telegramState.message ? (
                  <div
                    className="rounded-[14px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2]"
                    key={`${telegramState.message}-${index}`}
                    role="alert"
                  >
                    {telegramState.message}
                  </div>
                ) : null,
              )
            : null}
        </div>
      </section>

      {notificationThresholdCampaigns?.length ? (
        <section
          aria-labelledby="campaign-alert-thresholds"
          className="grid gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
        >
          <div>
            <div className="text-sm font-medium text-[#fdfdfd]" id="campaign-alert-thresholds">
              Campaign alert scores
            </div>
            <div className="mt-1 text-sm leading-6 text-[#b3b3b3]">
              Set the minimum lead score separately for every campaign assigned to you.
            </div>
          </div>

          <div className="grid gap-3">
            {notificationThresholdCampaigns.map((campaign) => {
              const inputId = `minScoreToAlert-${campaign.id}`;

              return (
                <form
                  action={thresholdAction}
                  className="grid gap-4 rounded-[16px] bg-[#1f1f1f] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end"
                  key={campaign.id}
                >
                  <input name="notificationCampaignId" type="hidden" value={campaign.id} />
                  <div className="min-w-0">
                    <label className="text-sm font-medium text-[#fdfdfd]" htmlFor={inputId}>
                      {campaign.name}
                    </label>
                    <div className="mt-1 text-sm leading-6 text-[#b3b3b3]">
                      Only leads at or above this score will alert you through your selected channel.
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7c7c7c]">
                      {campaign.role === "CLIENT" ? "Your client threshold" : "Campaign owner threshold"}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <Input
                      aria-describedby={`${inputId}-help`}
                      className="h-12 rounded-2xl border-0 bg-[#121212] px-4 text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] placeholder:text-[#7c7c7c] focus-visible:ring-[#1ed760]"
                      defaultValue={campaign.minScoreToAlert}
                      disabled={isSavingThreshold}
                      id={inputId}
                      inputMode="numeric"
                      max={100}
                      min={1}
                      name="minScoreToAlert"
                      type="number"
                    />
                    <span className="sr-only" id={`${inputId}-help`}>
                      Enter a whole number from 1 to 100.
                    </span>
                    <Button
                      className="h-11 rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-none hover:bg-[#3be477]"
                      disabled={isSavingThreshold}
                      type="submit"
                    >
                      {isSavingThreshold ? "Saving..." : "Save score"}
                    </Button>
                  </div>
                </form>
              );
            })}
          </div>

          {thresholdState.status === "error" && thresholdState.message ? (
            <div className="rounded-[18px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]" role="alert">
              {thresholdState.message}
            </div>
          ) : null}
        </section>
      ) : null}

    </div>
  );
}

function getChannelStatusLabel({
  isActive,
  isConnected,
}: {
  isActive: boolean;
  isConnected: boolean;
}) {
  if (isActive && isConnected) return "Active";
  if (isActive) return "Active · setup needed";
  return isConnected ? "Connected" : "Setup needed";
}

function ChannelStatusBadge({
  isActive,
  isConnected,
}: {
  isActive: boolean;
  isConnected: boolean;
}) {
  const toneClass = isActive && isConnected
    ? "bg-[#1ed760]/10 text-[#73f5a0]"
    : isActive
      ? "bg-[#3b2d10] text-[#ffd66e]"
      : isConnected
        ? "bg-[#252525] text-[#d5d5d5]"
        : "bg-[#2a1515] text-[#ff9aa5]";

  return (
    <span className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.13em] ${toneClass}`}>
      {getChannelStatusLabel({ isActive, isConnected })}
    </span>
  );
}

function ChannelLogo({
  channel,
  size = "md",
}: {
  channel: "SLACK" | "TELEGRAM";
  size?: "sm" | "md";
}) {
  const boxSize = size === "sm" ? "h-7 w-7" : "h-10 w-10";

  return (
    <span
      aria-hidden="true"
      className={`grid ${boxSize} shrink-0 place-items-center rounded-full bg-[#1f1f1f] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]`}
    >
      {channel === "SLACK" ? <SlackLogo /> : <TelegramLogo />}
    </span>
  );
}

function SlackLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 122.8 122.8">
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9Z"
        fill="#E01E5A"
      />
      <path
        d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6Z"
        fill="#E01E5A"
      />
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2Z"
        fill="#36C5F0"
      />
      <path
        d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3Z"
        fill="#36C5F0"
      />
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2Z"
        fill="#2EB67D"
      />
      <path
        d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3Z"
        fill="#2EB67D"
      />
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9Z"
        fill="#ECB22E"
      />
      <path
        d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

function TelegramLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 240 240">
      <circle cx="120" cy="120" fill="#2AABEE" r="120" />
      <path
        d="M177.4 74.5 157.7 168c-1.5 6.6-5.4 8.2-10.9 5.1l-30.1-22.2-14.5 14c-1.6 1.6-3 3-6.1 3l2.2-30.6 55.7-50.3c2.4-2.2-.5-3.4-3.8-1.2l-68.8 43.3-29.6-9.3c-6.4-2-6.6-6.4 1.3-9.5l115.8-44.6c5.4-2 10.1 1.3 8.5 8.8Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
