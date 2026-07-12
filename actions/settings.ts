"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { buildAccessibleCampaignWhere } from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";
import { getTelegramBotStartUrl, sendTelegramMessage } from "@/lib/telegram";

const alertChannels = ["EMAIL", "SLACK", "TELEGRAM"] as const;
const telegramPairingTtlMs = 10 * 60 * 1000;

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function updateNotificationSettings(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to update settings.",
    };
  }

  const emailAlertsEnabled = formData.get("emailAlertsEnabled") === "on";
  const preferredAlertChannel = normalizeAlertChannel(formData.get("preferredAlertChannel"));

  try {
    await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        emailAlertsEnabled,
        preferredAlertChannel,
      },
    });
  } catch (error) {
    console.error("Notification settings update failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Could not update notification settings.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/notifcation");

  return {
    status: "success",
    message: "Notification preferences updated.",
  };
}

export async function updateNotificationAlertThreshold(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to update notification score.",
    };
  }

  if (canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "Admin users should update campaign alert scores from campaign settings.",
    };
  }

  const campaignId = String(formData.get("notificationCampaignId") ?? "").trim();
  const rawScore = String(formData.get("minScoreToAlert") ?? "").trim();
  const minScoreToAlert = Number(rawScore);

  if (!campaignId) {
    return {
      status: "error",
      message: "No campaign is available for this notification setting.",
    };
  }

  if (!Number.isInteger(minScoreToAlert) || minScoreToAlert < 1 || minScoreToAlert > 100) {
    return {
      status: "error",
      message: "Minimum score must be a whole number between 1 and 100.",
    };
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: buildAccessibleCampaignWhere({
        campaignId,
        email: session.user.email,
        userId: session.user.id,
      }),
      select: {
        id: true,
      },
    });

    if (!campaign) {
      return {
        status: "error",
        message: "Campaign was not found for this account.",
      };
    }

    await prisma.campaign.update({
      where: {
        id: campaign.id,
      },
      data: {
        minScoreToAlert,
      },
    });
  } catch (error) {
    console.error("Notification alert threshold update failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Could not update notification score.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/notifcation");
  revalidatePath(`/campaigns/${campaignId}`);

  return {
    status: "success",
    message: "Notification score updated.",
  };
}

export async function connectTelegram(
  _prevState: SettingsActionState,
): Promise<SettingsActionState> {
  void _prevState;

  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to connect Telegram.",
    };
  }

  let startUrl: string;

  try {
    const code = randomBytes(24).toString("base64url");
    startUrl = getTelegramBotStartUrl(code);

    const pairing = await prisma.telegramPairing.create({
      data: {
        code,
        userId: session.user.id,
        expiresAt: new Date(Date.now() + telegramPairingTtlMs),
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    console.info("Telegram pairing created", {
      expiresAt: pairing.expiresAt.toISOString(),
      pairingId: pairing.id,
      userId: session.user.id,
    });
  } catch (error) {
    console.error("Telegram pairing creation failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Telegram setup failed: ${error.message}` : "Could not start Telegram setup.",
    };
  }

  redirect(startUrl);
}

export async function disconnectTelegram(
  _prevState: SettingsActionState,
): Promise<SettingsActionState> {
  void _prevState;

  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to disconnect Telegram.",
    };
  }

  try {
    await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        telegramChatId: null,
        telegramConnectedAt: null,
        telegramUsername: null,
      },
    });
  } catch (error) {
    console.error("Telegram disconnect failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Disconnect failed: ${error.message}` : "Could not disconnect Telegram.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/notifcation");

  return {
    status: "success",
    message: "Telegram disconnected.",
  };
}

export async function disconnectSlack(
  _prevState: SettingsActionState,
): Promise<SettingsActionState> {
  void _prevState;

  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to disconnect Slack.",
    };
  }

  try {
    await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        slackAuthedUserId: null,
        slackChannelId: null,
        slackChannelName: null,
        slackConfigurationUrl: null,
        slackTeamId: null,
        slackTeamName: null,
        slackWebhookUrl: null,
      },
    });
  } catch (error) {
    console.error("Slack disconnect failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Disconnect failed: ${error.message}` : "Could not disconnect Slack.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/notifcation");

  return {
    status: "success",
    message: "Slack disconnected.",
  };
}

export async function sendSlackTestMessage(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to send a test message.",
    };
  }

  const rawMessage = String(formData.get("message") ?? "").trim();
  const message = rawMessage || "Slack test from Redbot Leads.";

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      slackWebhookUrl: true,
    },
  });

  const webhookUrl = user?.slackWebhookUrl?.trim();

  if (!webhookUrl) {
    return {
      status: "error",
      message: "Connect a Slack webhook first.",
    };
  }

  if (!isValidSlackWebhookUrl(webhookUrl)) {
    return {
      status: "error",
      message: "The saved Slack webhook URL is invalid.",
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Slack test notification",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: message,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Sent from the notification test page.",
              },
            ],
          },
        ],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();

      return {
        status: "error",
        message: details ? `Slack rejected the test message: ${details}` : "Slack rejected the test message.",
      };
    }
  } catch (error) {
    console.error("Slack test message failed", error);

    return {
      status: "error",
      message:
        error instanceof Error ? `Could not send the Slack test message: ${error.message}` : "Could not send the Slack test message.",
    };
  }

  return {
    status: "success",
    message: "Test message sent to Slack.",
  };
}

export async function sendTelegramTestMessage(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to send a test message.",
    };
  }

  const rawMessage = String(formData.get("message") ?? "").trim();
  const message = rawMessage || "Telegram test from Redbot Leads.";

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      telegramChatId: true,
    },
  });

  const chatId = user?.telegramChatId?.trim();

  if (!chatId) {
    return {
      status: "error",
      message: "Connect Telegram first.",
    };
  }

  try {
    await sendTelegramMessage({
      chatId,
      text: message,
      disableWebPagePreview: true,
    });
  } catch (error) {
    console.error("Telegram test message failed", error);

    return {
      status: "error",
      message:
        error instanceof Error ? `Could not send the Telegram test message: ${error.message}` : "Could not send the Telegram test message.",
    };
  }

  return {
    status: "success",
    message: "Test message sent to Telegram.",
  };
}

function isValidSlackWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

function normalizeAlertChannel(value: FormDataEntryValue | null) {
  const channel = String(value ?? "SLACK").trim().toUpperCase();
  return alertChannels.includes(channel as (typeof alertChannels)[number])
    ? (channel as (typeof alertChannels)[number])
    : "SLACK";
}
