import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import {
  markCampaignFailed,
  updateCampaignProgress,
} from "./campaign-sync";
import { finalizeCampaignLeadProcessing } from "./campaign-finalization";
import { markCampaignRunFailed, markCampaignRunProcessing } from "./campaign-runs";
import { classifyLeadWithOpenAI } from "./classification-ai";
import { workerClassificationConcurrency, workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { enqueueNotification, type ClassificationJobData, classificationQueueName } from "./queues";

const SEMANTIC_FILTER_MODEL = "semantic-threshold-filter";
const CLASSIFICATION_ERROR_MODEL = "classification-error";
const CLASSIFICATION_ERROR_PROMPT_VERSION = "classification-error-v1";
const MAX_ERROR_SUMMARY_LENGTH = 400;
const MAX_ERROR_DISQUALIFIER_LENGTH = 200;

const worker = new Worker<ClassificationJobData>(
  classificationQueueName,
  async (job) => {
    if (job.name !== "CLASSIFY_LEAD") {
      workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported classification job");
      return;
    }

    return runClassification(job.data, job.id ?? "unknown");
  },
  {
    connection: workerRedisConnection,
    concurrency: workerClassificationConcurrency,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Classification job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Classification job failed");
});

workerLogger.info("Classification worker started");

async function runClassification(data: ClassificationJobData, jobId: string) {
  const isRssPollClassification = data.trigger === "rss_poll";
  const lead = await prisma.lead.findFirst({
    where: {
      id: data.leadId,
      campaignId: data.campaignId,
    },
    select: {
      id: true,
      campaignId: true,
      score: true,
      label: true,
      campaign: {
        select: {
          name: true,
          leadType: true,
          description: true,
          keywords: true,
          negativeKeywords: true,
          subreddits: true,
          minScoreToAlert: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          emailAlertsEnabled: true,
          preferredAlertChannel: true,
          slackWebhookUrl: true,
          telegramChatId: true,
        },
      },
      notifications: {
        select: {
          id: true,
          channel: true,
          status: true,
        },
      },
      redditItem: {
        select: {
          type: true,
          subreddit: true,
          title: true,
          description: true,
          body: true,
          author: true,
          url: true,
        },
      },
    },
  });

  if (!lead) {
    workerLogger.warn({ jobId, leadId: data.leadId, campaignId: data.campaignId }, "Lead not found for classification");
    return { skipped: true, reason: "lead_not_found" };
  }

  try {
    const remainingBefore = await countPendingLeadClassification(lead.campaignId);
    const classifiedBefore = await countClassifiedLeads(lead.campaignId);

    if (!isRssPollClassification) {
      await updateCampaignProgress(
        lead.campaignId,
        "CLASSIFYING",
        `Scoring lead ${Math.max(1, remainingBefore)} of the current campaign batch.`,
        {
          classifiedLeads: classifiedBefore,
        },
      );
      await markCampaignRunProcessing(data.campaignRunId, "Scoring campaign leads with AI.");
    }

    const result = await classifyLeadWithOpenAI({
      campaign: {
        name: lead.campaign.name,
        leadType: lead.campaign.leadType,
        description: lead.campaign.description,
        keywords: lead.campaign.keywords,
        negativeKeywords: lead.campaign.negativeKeywords,
        subreddits: lead.campaign.subreddits,
      },
      redditItem: {
        type: lead.redditItem.type,
        subreddit: lead.redditItem.subreddit,
        title: lead.redditItem.title,
        description: lead.redditItem.description,
        body: lead.redditItem.body,
        author: lead.redditItem.author,
        url: lead.redditItem.url,
      },
      campaignId: lead.campaignId,
      campaignRunId: data.campaignRunId,
      userId: lead.user.id,
    }).catch(async (error: unknown) => {
      if (isSystemicClassificationError(error)) {
        throw error;
      }

      const errorMessage = getErrorMessage(error);
      await recordLeadClassificationFailure(lead.id, errorMessage);

      if (!isRssPollClassification) {
        await finalizeCampaignClassificationProgress(
          lead.campaignId,
          data.campaignRunId,
          `${lead.id} could not be scored, so it was marked LOW and skipped.`,
        );
      }

      workerLogger.warn(
        {
          jobId,
          leadId: lead.id,
          campaignId: lead.campaignId,
          error,
        },
        "Lead classification failed without failing the campaign",
      );

      return null;
    });

    if (!result) {
      return {
        skipped: true,
        reason: "classification_failed",
      };
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          score: result.score,
          label: result.label,
        },
      }),
      prisma.leadAI.upsert({
        where: {
          leadId: lead.id,
        },
        update: {
          model: result.model,
          promptVersion: result.promptVersion,
          intentType: mapIntentType(result.intentType),
          buyerStage: mapBuyerStage(result.buyerStage),
          category: result.category,
          summary: result.summary,
          painPoints: result.painPoints,
          disqualifier: result.disqualifier,
        },
        create: {
          leadId: lead.id,
          model: result.model,
          promptVersion: result.promptVersion,
          intentType: mapIntentType(result.intentType),
          buyerStage: mapBuyerStage(result.buyerStage),
          category: result.category,
          summary: result.summary,
          painPoints: result.painPoints,
          disqualifier: result.disqualifier,
        },
      }),
    ]);

    const crossedAlertThreshold = result.score >= lead.campaign.minScoreToAlert;

    const notificationChannel = crossedAlertThreshold
      ? chooseNotificationChannel({
          existingChannels: lead.notifications.map((notification) => notification.channel),
          email: lead.user.email,
          emailAlertsEnabled: lead.user.emailAlertsEnabled,
          preferredAlertChannel: lead.user.preferredAlertChannel,
          slackWebhookUrl: lead.user.slackWebhookUrl,
          telegramChatId: lead.user.telegramChatId,
        })
      : null;

    if (notificationChannel) {
      const notification = await prisma.notification.create({
        data: {
          leadId: lead.id,
          channel: notificationChannel,
          status: "PENDING",
        },
        select: {
          id: true,
        },
      });

      await enqueueNotification({
        notificationId: notification.id,
        leadId: lead.id,
        channel: notificationChannel,
      });
    }

    if (!isRssPollClassification) {
      await finalizeCampaignClassificationProgress(lead.campaignId, data.campaignRunId);
    }

    workerLogger.info(
      {
        jobId,
        leadId: lead.id,
        campaignId: lead.campaignId,
        score: result.score,
        label: result.label,
        category: result.category,
        crossedAlertThreshold,
        selectedNotificationChannel: notificationChannel,
        emailAlertsEnabled: Boolean(lead.user.emailAlertsEnabled && lead.user.email?.trim()),
        slackNotificationsEnabled: Boolean(lead.user.slackWebhookUrl?.trim()),
        telegramNotificationsEnabled: Boolean(lead.user.telegramChatId?.trim()),
      },
      "Lead classified with OpenAI",
    );

    return {
      score: result.score,
      label: result.label,
      category: result.category,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    if (!isRssPollClassification) {
      await markCampaignFailed(lead.campaignId, "CLASSIFYING", errorMessage);
      await markCampaignRunFailed(data.campaignRunId, errorMessage);
    }

    throw error;
  }
}

async function countPendingLeadClassification(campaignId: string) {
  return prisma.lead.count({
    where: {
      campaignId,
      ai: null,
    },
  });
}

async function countClassifiedLeads(campaignId: string) {
  return prisma.lead.count({
    where: {
      campaignId,
      ai: {
        isNot: null,
      },
      NOT: {
        ai: {
          model: SEMANTIC_FILTER_MODEL,
        },
      },
    },
  });
}

async function countFailedClassifications(campaignId: string) {
  return prisma.lead.count({
    where: {
      campaignId,
      ai: {
        model: CLASSIFICATION_ERROR_MODEL,
      },
    },
  });
}

async function recordLeadClassificationFailure(leadId: string, errorMessage: string) {
  const summary = clampText(`Classification failed for this lead: ${errorMessage}`, MAX_ERROR_SUMMARY_LENGTH);
  const disqualifier = clampText(errorMessage, MAX_ERROR_DISQUALIFIER_LENGTH);

  await prisma.$transaction([
    prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        score: 0,
        label: "LOW",
      },
    }),
    prisma.leadAI.upsert({
      where: {
        leadId,
      },
      update: {
        model: CLASSIFICATION_ERROR_MODEL,
        promptVersion: CLASSIFICATION_ERROR_PROMPT_VERSION,
        intentType: "NONE",
        buyerStage: "SOLVED",
        category: "classification_failed",
        summary,
        painPoints: [],
        disqualifier,
      },
      create: {
        leadId,
        model: CLASSIFICATION_ERROR_MODEL,
        promptVersion: CLASSIFICATION_ERROR_PROMPT_VERSION,
        intentType: "NONE",
        buyerStage: "SOLVED",
        category: "classification_failed",
        summary,
        painPoints: [],
        disqualifier,
      },
    }),
  ]);
}

async function finalizeCampaignClassificationProgress(campaignId: string, campaignRunId?: string, skipMessage?: string) {
  const [classifiedAfter, failedAfter, semanticCounts] = await Promise.all([
    countClassifiedLeads(campaignId),
    countFailedClassifications(campaignId),
    countSemanticProgress(campaignId),
  ]);
  const failedText =
    failedAfter > 0
      ? ` ${failedAfter} lead${failedAfter === 1 ? " was" : "s were"} skipped after scoring errors.`
      : "";

  const stats = {
    classifiedLeads: classifiedAfter,
    classificationFailedLeads: failedAfter,
    semanticCheckedLeads: semanticCounts.checked,
    semanticPassedLeads: semanticCounts.passed,
    semanticFilteredLeads: semanticCounts.filtered,
  };

  await finalizeCampaignLeadProcessing({
    campaignId,
    campaignRunId,
    completeMessage: `AI scoring complete for this campaign sync.${failedText}`,
    pendingMessage: (remainingAfter) => {
      const skippedText = skipMessage ? `${skipMessage} ` : "";
      return `${skippedText}${remainingAfter} lead${remainingAfter === 1 ? "" : "s"} still waiting for AI scoring.`;
    },
    stats,
  });
}

async function countSemanticProgress(campaignId: string) {
  const [embedded, filtered] = await Promise.all([
    prisma.lead.count({
      where: {
        campaignId,
        redditItem: {
          embedding: {
            isNot: null,
          },
        },
      },
    }),
    prisma.lead.count({
      where: {
        campaignId,
        ai: {
          model: SEMANTIC_FILTER_MODEL,
        },
      },
    }),
  ]);

  return {
    checked: embedded,
    passed: Math.max(0, embedded - filtered),
    filtered,
  };
}

function isSystemicClassificationError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("openai_api_key") || message.includes("database") || message.includes("prisma");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lead classification failed.";
}

function clampText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

type AlertChannel = "EMAIL" | "SLACK" | "TELEGRAM";

function chooseNotificationChannel(input: {
  existingChannels: AlertChannel[];
  email: string | null;
  emailAlertsEnabled: boolean;
  preferredAlertChannel: AlertChannel;
  slackWebhookUrl: string | null;
  telegramChatId: string | null;
}) {
  const orderedChannels = [
    input.preferredAlertChannel,
    "SLACK",
    "TELEGRAM",
    "EMAIL",
  ].filter((channel, index, channels): channel is AlertChannel => {
    return channels.indexOf(channel) === index;
  });

  return orderedChannels.find((channel) => {
    if (input.existingChannels.includes(channel)) {
      return false;
    }

    if (channel === "SLACK") {
      return Boolean(input.slackWebhookUrl?.trim());
    }

    if (channel === "TELEGRAM") {
      return Boolean(input.telegramChatId?.trim());
    }

    return input.emailAlertsEnabled && Boolean(input.email?.trim());
  }) ?? null;
}

function mapIntentType(value: "none" | "implicit" | "explicit" | "switching") {
  if (value === "none") return "NONE";
  if (value === "implicit") return "IMPLICIT";
  if (value === "explicit") return "EXPLICIT";
  return "SWITCHING";
}

function mapBuyerStage(value: "solved" | "problem_aware" | "solution_aware" | "evaluating") {
  if (value === "solved") return "SOLVED";
  if (value === "problem_aware") return "PROBLEM_AWARE";
  if (value === "solution_aware") return "SOLUTION_AWARE";
  return "EVALUATING";
}
