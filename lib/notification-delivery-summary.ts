export function summarizeNotificationDeliveries<
  T extends {
    channel: string;
    createdAt: Date;
    error: string | null;
    sentAt: Date | null;
    status: "PENDING" | "SENT" | "FAILED";
  },
>(notifications: T[]) {
  if (notifications.length === 0) {
    return null;
  }

  const sentCount = notifications.filter((notification) => notification.status === "SENT").length;
  const failedCount = notifications.filter((notification) => notification.status === "FAILED").length;
  const pendingCount = notifications.filter((notification) => notification.status === "PENDING").length;
  const channels = Array.from(new Set(notifications.map((notification) => notification.channel)));
  const errors = Array.from(
    new Set(
      notifications
        .map((notification) => notification.error?.trim())
        .filter((error): error is string => Boolean(error)),
    ),
  );
  const latestCreatedAt = notifications.reduce(
    (latest, notification) =>
      notification.createdAt > latest ? notification.createdAt : latest,
    notifications[0].createdAt,
  );
  const sentDates = notifications
    .map((notification) => notification.sentAt)
    .filter((sentAt): sentAt is Date => Boolean(sentAt));
  const latestSentAt = sentDates.length > 0
    ? sentDates.reduce((latest, sentAt) => (sentAt > latest ? sentAt : latest))
    : null;
  const status =
    sentCount === notifications.length
      ? "SENT"
      : failedCount === notifications.length
        ? "FAILED"
        : pendingCount === notifications.length
          ? "PENDING"
          : "PARTIAL";

  return {
    channel: channels.join(", "),
    createdAt: latestCreatedAt,
    error: errors.length > 0 ? errors.join(" | ") : null,
    failedCount,
    pendingCount,
    recipientCount: notifications.length,
    sentAt: latestSentAt,
    sentCount,
    status,
  };
}
