export type AlertChannel = "EMAIL" | "SLACK" | "TELEGRAM";
export type NotificationRecipientRole = "OWNER" | "CLIENT";
export type NotificationDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export type NotificationRecipient = {
  campaignClientAccessId: string | null;
  campaignDisplayName: string;
  channel: AlertChannel;
  recipientRole: NotificationRecipientRole;
  recipientUserId: string;
};

type OwnerNotificationInput = {
  campaignDisplayName: string;
  email: string | null;
  emailAlertsEnabled: boolean;
  existingChannels: AlertChannel[];
  minScoreToAlert: number;
  preferredAlertChannel: AlertChannel;
  recipientUserId: string;
  score: number;
  slackWebhookUrl: string | null;
  telegramChatId: string | null;
};

export type ClientNotificationAccess = {
  campaignDisplayName: string;
  id: string;
  isAdmin: boolean;
  minScoreToAlert: number;
  notificationsEnabledAt: Date;
  user: {
    id: string;
    preferredAlertChannel: AlertChannel;
    slackWebhookUrl: string | null;
    telegramChatId: string | null;
  } | null;
};

export function chooseOwnerNotificationRecipient(
  input: OwnerNotificationInput,
): NotificationRecipient | null {
  if (input.score < input.minScoreToAlert) {
    return null;
  }

  const orderedChannels = [
    input.preferredAlertChannel,
    "SLACK",
    "TELEGRAM",
    "EMAIL",
  ].filter((channel, index, channels): channel is AlertChannel => {
    return channels.indexOf(channel) === index;
  });
  const channel = orderedChannels.find((candidate) => {
    if (input.existingChannels.includes(candidate)) {
      return false;
    }

    if (candidate === "SLACK") {
      return Boolean(input.slackWebhookUrl?.trim());
    }

    if (candidate === "TELEGRAM") {
      return Boolean(input.telegramChatId?.trim());
    }

    return input.emailAlertsEnabled && Boolean(input.email?.trim());
  });

  return channel
    ? {
        campaignClientAccessId: null,
        campaignDisplayName: input.campaignDisplayName,
        channel,
        recipientRole: "OWNER",
        recipientUserId: input.recipientUserId,
      }
    : null;
}

export function chooseClientNotificationRecipients(input: {
  accesses: ClientNotificationAccess[];
  hadValidClassification: boolean;
  score: number;
  successfulClassificationAt: Date;
}) {
  if (input.hadValidClassification) {
    return [];
  }

  return input.accesses.flatMap((access): NotificationRecipient[] => {
    const user = access.user;

    if (
      !user
      || access.isAdmin
      || input.score < access.minScoreToAlert
      || input.successfulClassificationAt < access.notificationsEnabledAt
    ) {
      return [];
    }

    const channel = chooseStrictClientChannel({
      preferredAlertChannel: user.preferredAlertChannel,
      slackWebhookUrl: user.slackWebhookUrl,
      telegramChatId: user.telegramChatId,
    });

    return channel
      ? [{
          campaignClientAccessId: access.id,
          campaignDisplayName: access.campaignDisplayName,
          channel,
          recipientRole: "CLIENT",
          recipientUserId: user.id,
        }]
      : [];
  });
}

export function chooseStrictClientChannel(input: {
  preferredAlertChannel: AlertChannel;
  slackWebhookUrl: string | null;
  telegramChatId: string | null;
}) {
  if (input.preferredAlertChannel === "SLACK") {
    return input.slackWebhookUrl?.trim() ? "SLACK" : null;
  }

  if (input.preferredAlertChannel === "TELEGRAM") {
    return input.telegramChatId?.trim() ? "TELEGRAM" : null;
  }

  return null;
}

export function shouldEnqueueNotification(status: NotificationDeliveryStatus) {
  return status === "PENDING";
}
