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

function isValidSlackWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}
