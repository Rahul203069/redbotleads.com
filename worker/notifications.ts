import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import { workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { notificationsQueueName } from "./queues";

const worker = new Worker(
  notificationsQueueName,
  async (job) => {
    if (job.name !== "SEND_SLACK") {
      workerLogger.info({ jobId: job.id, name: job.name, data: job.data }, "Ignoring unsupported notification job");
      return;
    }

    return runSlackNotification(job.data as { notificationId: string; leadId: string; channel: "SLACK" }, job.id ?? "unknown");
  },
  {
    connection: workerRedisConnection,
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
      lead: {
        select: {
          id: true,
          score: true,
          label: true,
          campaign: {
            select: {
              name: true,
            },
          },
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
          user: {
            select: {
              slackWebhookUrl: true,
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

  const webhookUrl = notification.lead.user.slackWebhookUrl?.trim();

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
        text: `New lead for ${notification.lead.campaign.name}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `New lead: ${notification.lead.campaign.name}`,
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
        campaignName: notification.lead.campaign.name,
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
