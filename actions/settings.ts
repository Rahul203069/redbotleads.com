"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const slackWebhookUrl = String(formData.get("slackWebhookUrl") ?? "").trim();
  const emailAlertsEnabled = formData.get("emailAlertsEnabled") === "on";

  if (slackWebhookUrl && !isValidSlackWebhookUrl(slackWebhookUrl)) {
    return {
      status: "error",
      message: "Enter a valid Slack webhook URL.",
    };
  }

  try {
    await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        emailAlertsEnabled,
        slackWebhookUrl: slackWebhookUrl || null,
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

  return {
    status: "success",
    message: "Notification settings updated.",
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

function isValidSlackWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}
