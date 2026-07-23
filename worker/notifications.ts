import "dotenv/config";

import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { isTelegramRateLimitError, sendTelegramMessage } from "@/lib/telegram";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { Resend } from "resend";

import { telegramNotificationIntervalMs, workerNotificationsConcurrency, workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { notificationsQueueName } from "./queues";

const telegramThrottleKey = "redbot:notifications:telegram:next-send-at";
const telegramThrottleRedis = new Redis(workerRedisConnection.url, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  notificationsQueueName,
  async (job) => {
    if (job.name === "SEND_SLACK") {
      return runSlackNotification(
        job.data as { notificationId: string; leadId: string; channel: "SLACK" },
        job.id ?? "unknown",
      );
    }

    if (job.name === "SEND_EMAIL") {
      return runEmailNotification(
        job.data as { notificationId: string; leadId: string; channel: "EMAIL" },
        job.id ?? "unknown",
      );
    }

    if (job.name === "SEND_TELEGRAM") {
      return runTelegramNotification(
        job.data as { notificationId: string; leadId: string; channel: "TELEGRAM" },
        job.id ?? "unknown",
      );
    }

    workerLogger.info({ jobId: job.id, name: job.name, data: job.data }, "Ignoring unsupported notification job");
    return;
  },
  {
    connection: workerRedisConnection,
    concurrency: workerNotificationsConcurrency,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Notification job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Notification job failed");
});

workerLogger.info("Notification worker started");

async function runSlackNotification(
  data: {
    notificationId: string;
    leadId: string;
    channel: "SLACK";
  },
  jobId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: data.notificationId,
      leadId: data.leadId,
      channel: "SLACK",
    },
    select: {
      id: true,
      campaignDisplayName: true,
      recipientRole: true,
      status: true,
      campaignClientAccess: {
        select: {
          campaignId: true,
          id: true,
          userId: true,
        },
      },
      recipient: {
        select: {
          email: true,
          id: true,
          preferredAlertChannel: true,
          slackWebhookUrl: true,
          telegramChatId: true,
        },
      },
      lead: {
        select: {
          campaignId: true,
          id: true,
          score: true,
          label: true,
          ai: {
            select: {
              summary: true,
              category: true,
            },
          },
          redditItem: {
            select: {
              subreddit: true,
              title: true,
              url: true,
            },
          },
        },
      },
    },
  });

  if (!notification) {
    workerLogger.warn({ jobId, notificationId: data.notificationId }, "Slack notification record not found");
    return { skipped: true, reason: "notification_not_found" };
  }

  if (notification.status !== "PENDING") {
    return { skipped: true, reason: "notification_not_pending" };
  }

  const recipientError = getRecipientDeliveryError(notification, "SLACK");

  if (recipientError) {
    await failNotification(notification.id, recipientError);
    return { skipped: true, reason: "recipient_not_eligible" };
  }

  const webhookUrl = notification.recipient.slackWebhookUrl?.trim();

  if (!webhookUrl) {
    await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: "FAILED",
        error: "Slack webhook URL is not configured.",
      },
    });

    return { skipped: true, reason: "missing_webhook" };
  }

  const title = notification.lead.redditItem.title?.trim() || "New high-intent Reddit lead";
  const redditUrl = notification.lead.redditItem.url?.trim() || "https://www.reddit.com";
  const summary = notification.lead.ai?.summary?.trim() || "A lead crossed the alert threshold and is ready for review.";
  const category = notification.lead.ai?.category?.trim();

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `New lead for ${notification.campaignDisplayName}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `New lead: ${notification.campaignDisplayName}`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Score*\n${notification.lead.score}`,
              },
              {
                type: "mrkdwn",
                text: `*Label*\n${notification.lead.label}`,
              },
              {
                type: "mrkdwn",
                text: `*Subreddit*\nr/${notification.lead.redditItem.subreddit}`,
              },
              {
                type: "mrkdwn",
                text: `*Category*\n${category || "General"}`,
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${escapeSlackText(title)}*\n${escapeSlackText(summary)}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View on Reddit",
                },
                url: redditUrl,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status} ${response.statusText}`);
    }

    await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: "SENT",
        error: null,
        sentAt: new Date(),
      },
    });

    workerLogger.info(
      {
        jobId,
        notificationId: notification.id,
        leadId: notification.lead.id,
        campaignName: notification.campaignDisplayName,
        recipientRole: notification.recipientRole,
        recipientUserId: notification.recipient.id,
      },
      "Slack notification sent",
    );

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack webhook delivery failed.";

    await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: "FAILED",
        error: message,
      },
    });

    workerLogger.error(
      {
        jobId,
        notificationId: notification.id,
        error,
      },
      "Slack notification failed",
    );

    throw error;
  }
}

function escapeSlackText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function runTelegramNotification(
  data: {
    notificationId: string;
    leadId: string;
    channel: "TELEGRAM";
  },
  jobId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: data.notificationId,
      leadId: data.leadId,
      channel: "TELEGRAM",
    },
    select: {
      id: true,
      campaignDisplayName: true,
      recipientRole: true,
      status: true,
      campaignClientAccess: {
        select: {
          campaignId: true,
          id: true,
          userId: true,
        },
      },
      recipient: {
        select: {
          email: true,
          id: true,
          preferredAlertChannel: true,
          slackWebhookUrl: true,
          telegramChatId: true,
        },
      },
      lead: {
        select: {
          campaignId: true,
          id: true,
          score: true,
          label: true,
          ai: {
            select: {
              summary: true,
              category: true,
            },
          },
          redditItem: {
            select: {
              subreddit: true,
              title: true,
              url: true,
            },
          },
        },
      },
    },
  });

  if (!notification) {
    workerLogger.warn({ jobId, notificationId: data.notificationId }, "Telegram notification record not found");
    return { skipped: true, reason: "notification_not_found" };
  }

  if (notification.status !== "PENDING") {
    return { skipped: true, reason: "notification_not_pending" };
  }

  const recipientError = getRecipientDeliveryError(notification, "TELEGRAM");

  if (recipientError) {
    await failNotification(notification.id, recipientError);
    return { skipped: true, reason: "recipient_not_eligible" };
  }

  const chatId = notification.recipient.telegramChatId?.trim();

  if (!chatId) {
    await failNotification(notification.id, "Telegram chat is not configured.");
    return { skipped: true, reason: "missing_chat_id" };
  }

  const title = notification.lead.redditItem.title?.trim() || "New high-intent Reddit lead";
  const redditUrl = notification.lead.redditItem.url?.trim() || "https://www.reddit.com";
  const summary = notification.lead.ai?.summary?.trim() || "A lead crossed the alert threshold and is ready for review.";
  const category = notification.lead.ai?.category?.trim() || "General";

  try {
    await waitForTelegramSendSlot(jobId, notification.id);

    await sendTelegramMessage({
      chatId,
      disableWebPagePreview: false,
      text: buildLeadAlertText({
        campaignName: notification.campaignDisplayName,
        category,
        label: notification.lead.label,
        redditUrl,
        score: notification.lead.score,
        subreddit: notification.lead.redditItem.subreddit,
        summary,
        title,
      }),
    });

    await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: "SENT",
        error: null,
        sentAt: new Date(),
      },
    });

    workerLogger.info(
      {
        jobId,
        notificationId: notification.id,
        leadId: notification.lead.id,
        campaignName: notification.campaignDisplayName,
        recipientRole: notification.recipientRole,
        recipientUserId: notification.recipient.id,
      },
      "Telegram notification sent",
    );

    return { sent: true };
  } catch (error) {
    if (isTelegramRateLimitError(error)) {
      const retryAfterMs = Math.max(1000, error.retryAfterSeconds * 1000);

      await keepNotificationPending(notification.id, `Telegram rate limit hit. Retrying after ${error.retryAfterSeconds}s.`);
      await worker.rateLimit(retryAfterMs);

      workerLogger.warn(
        {
          jobId,
          notificationId: notification.id,
          retryAfterMs,
          error,
        },
        "Telegram notification rate limited; job returned to waiting",
      );

      throw Worker.RateLimitError();
    }

    const message = error instanceof Error ? error.message : "Telegram delivery failed.";

    await failNotification(notification.id, message);

    workerLogger.error(
      {
        jobId,
        notificationId: notification.id,
        error,
      },
      "Telegram notification failed",
    );

    throw error;
  }
}

async function waitForTelegramSendSlot(jobId: string, notificationId: string) {
  if (telegramNotificationIntervalMs <= 0) {
    return;
  }

  while (true) {
    const delayMs = await reserveTelegramSendSlot();

    if (delayMs <= 0) {
      return;
    }

    workerLogger.info(
      {
        jobId,
        notificationId,
        waitMs: delayMs,
        telegramNotificationIntervalMs,
      },
      "Waiting for Telegram notification send slot",
    );

    await sleep(delayMs);
  }
}

async function reserveTelegramSendSlot() {
  const result = await telegramThrottleRedis.eval(
    `
      local key = KEYS[1]
      local interval = tonumber(ARGV[1])
      local time = redis.call("TIME")
      local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
      local nextSendAt = tonumber(redis.call("GET", key) or "0")

      if nextSendAt <= now then
        redis.call("SET", key, now + interval, "PX", math.max(interval * 4, 10000))
        return 0
      end

      return nextSendAt - now
    `,
    1,
    telegramThrottleKey,
    String(telegramNotificationIntervalMs),
  );

  return typeof result === "number" ? result : Number(result);
}

async function runEmailNotification(
  data: {
    notificationId: string;
    leadId: string;
    channel: "EMAIL";
  },
  jobId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: data.notificationId,
      leadId: data.leadId,
      channel: "EMAIL",
    },
    select: {
      id: true,
      campaignDisplayName: true,
      recipientRole: true,
      status: true,
      campaignClientAccess: {
        select: {
          campaignId: true,
          id: true,
          userId: true,
        },
      },
      recipient: {
        select: {
          email: true,
          id: true,
          preferredAlertChannel: true,
          slackWebhookUrl: true,
          telegramChatId: true,
        },
      },
      lead: {
        select: {
          campaignId: true,
          id: true,
          score: true,
          label: true,
          ai: {
            select: {
              summary: true,
              category: true,
            },
          },
          redditItem: {
            select: {
              subreddit: true,
              title: true,
              url: true,
            },
          },
        },
      },
    },
  });

  if (!notification) {
    workerLogger.warn({ jobId, notificationId: data.notificationId }, "Email notification record not found");
    return { skipped: true, reason: "notification_not_found" };
  }

  if (notification.status !== "PENDING") {
    return { skipped: true, reason: "notification_not_pending" };
  }

  const recipientError = getRecipientDeliveryError(notification, "EMAIL");

  if (recipientError) {
    await failNotification(notification.id, recipientError);
    return { skipped: true, reason: "recipient_not_eligible" };
  }

  const recipient = notification.recipient.email?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!recipient) {
    await failNotification(notification.id, "User email is not configured.");
    return { skipped: true, reason: "missing_recipient" };
  }

  if (!apiKey || !from) {
    await failNotification(notification.id, "Resend email configuration is missing.");
    return { skipped: true, reason: "missing_email_config" };
  }

  const title = notification.lead.redditItem.title?.trim() || "New high-intent Reddit lead";
  const redditUrl = notification.lead.redditItem.url?.trim() || "https://www.reddit.com";
  const summary = notification.lead.ai?.summary?.trim() || "A lead crossed the alert threshold and is ready for review.";
  const category = notification.lead.ai?.category?.trim() || "General";
  const subject = `New Reddit lead for ${notification.campaignDisplayName}`;

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from,
      to: recipient,
      subject,
      html: buildLeadAlertHtml({
        campaignName: notification.campaignDisplayName,
        category,
        label: notification.lead.label,
        redditUrl,
        score: notification.lead.score,
        subreddit: notification.lead.redditItem.subreddit,
        summary,
        title,
      }),
      text: buildLeadAlertText({
        campaignName: notification.campaignDisplayName,
        category,
        label: notification.lead.label,
        redditUrl,
        score: notification.lead.score,
        subreddit: notification.lead.redditItem.subreddit,
        summary,
        title,
      }),
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: "SENT",
        error: null,
        sentAt: new Date(),
      },
    });

    workerLogger.info(
      {
        jobId,
        notificationId: notification.id,
        leadId: notification.lead.id,
        campaignName: notification.campaignDisplayName,
        recipientRole: notification.recipientRole,
        recipientUserId: notification.recipient.id,
      },
      "Email notification sent",
    );

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";

    await failNotification(notification.id, message);

    workerLogger.error(
      {
        jobId,
        notificationId: notification.id,
        error,
      },
      "Email notification failed",
    );

    throw error;
  }
}

async function failNotification(notificationId: string, error: string) {
  await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      status: "FAILED",
      error,
    },
  });
}

function getRecipientDeliveryError(
  notification: {
    campaignClientAccess: {
      campaignId: string;
      id: string;
      userId: string | null;
    } | null;
    lead: {
      campaignId: string;
    };
    recipient: {
      email: string | null;
      id: string;
      preferredAlertChannel: "EMAIL" | "SLACK" | "TELEGRAM";
      slackWebhookUrl: string | null;
      telegramChatId: string | null;
    };
    recipientRole: "OWNER" | "CLIENT";
  },
  channel: "EMAIL" | "SLACK" | "TELEGRAM",
) {
  if (notification.recipientRole === "OWNER") {
    return null;
  }

  const access = notification.campaignClientAccess;

  if (
    !access
    || access.campaignId !== notification.lead.campaignId
    || access.userId !== notification.recipient.id
  ) {
    return "Client campaign access is no longer active for this recipient.";
  }

  if (canViewAnalytics(notification.recipient.email)) {
    return "Admin accounts do not receive assigned-client notifications.";
  }

  if (channel === "EMAIL" || notification.recipient.preferredAlertChannel !== channel) {
    return "The client selected a different notification channel.";
  }

  if (channel === "SLACK" && !notification.recipient.slackWebhookUrl?.trim()) {
    return "The client's selected Slack channel is disconnected.";
  }

  if (channel === "TELEGRAM" && !notification.recipient.telegramChatId?.trim()) {
    return "The client's selected Telegram channel is disconnected.";
  }

  return null;
}

async function keepNotificationPending(notificationId: string, error: string) {
  await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      status: "PENDING",
      error,
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

type LeadAlertEmail = {
  campaignName: string;
  category: string;
  label: string;
  redditUrl: string;
  score: number;
  subreddit: string;
  summary: string;
  title: string;
};

function buildLeadAlertText(email: LeadAlertEmail) {
  return [
    `New Reddit lead for ${email.campaignName}`,
    "",
    `Score: ${email.score}`,
    `Label: ${email.label}`,
    `Subreddit: r/${email.subreddit}`,
    `Category: ${email.category}`,
    "",
    email.title,
    email.summary,
    "",
    `View on Reddit: ${email.redditUrl}`,
  ].join("\n");
}

function buildLeadAlertHtml(email: LeadAlertEmail) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b">
      <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#71717a">
        Redbot Leads
      </p>
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 16px">New Reddit lead for ${escapeHtml(email.campaignName)}</h1>
      <p style="margin:0 0 16px">${escapeHtml(email.summary)}</p>
      <table style="border-collapse:collapse;margin:0 0 20px">
        <tr><td style="padding:4px 16px 4px 0;color:#71717a">Score</td><td style="padding:4px 0">${email.score}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#71717a">Label</td><td style="padding:4px 0">${escapeHtml(email.label)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#71717a">Subreddit</td><td style="padding:4px 0">r/${escapeHtml(email.subreddit)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#71717a">Category</td><td style="padding:4px 0">${escapeHtml(email.category)}</td></tr>
      </table>
      <h2 style="font-size:18px;line-height:1.3;margin:0 0 12px">${escapeHtml(email.title)}</h2>
      <a href="${escapeHtml(email.redditUrl)}" style="display:inline-block;border-radius:999px;background:#18181b;color:#ffffff;padding:10px 16px;text-decoration:none">
        View on Reddit
      </a>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
