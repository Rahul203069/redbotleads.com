import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import {
  markCampaignCompleted,
  markCampaignFailed,
  updateCampaignProgress,
} from "./campaign-sync";
import { classifyLeadWithOpenAI } from "./classification-ai";
import { workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { enqueueNotification, type ClassificationJobData, classificationQueueName } from "./queues";

const SEMANTIC_FILTER_MODEL = "semantic-threshold-filter";

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
    concurrency: 1,
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
          emailAlertsEnabled: true,
          slackWebhookUrl: true,
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

    await updateCampaignProgress(
      lead.campaignId,
      "CLASSIFYING",
      `Scoring lead ${Math.max(1, remainingBefore)} of the current campaign batch.`,
      {
        classifiedLeads: classifiedBefore,
      },
    );

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
    });

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

    if (crossedAlertThreshold && lead.user.slackWebhookUrl && !lead.notifications.some((notification) => notification.channel === "SLACK")) {
      const notification = await prisma.notification.create({
        data: {
          leadId: lead.id,
          channel: "SLACK",
          status: "PENDING",
        },
        select: {
          id: true,
        },
      });

      await enqueueNotification({
        notificationId: notification.id,
        leadId: lead.id,
        channel: "SLACK",
      });
    }

    const remainingAfter = await countPendingLeadClassification(lead.campaignId);
    const classifiedAfter = await countClassifiedLeads(lead.campaignId);

    if (remainingAfter > 0) {
      await updateCampaignProgress(
        lead.campaignId,
        "CLASSIFYING",
        `${remainingAfter} lead${remainingAfter === 1 ? "" : "s"} still waiting for AI scoring.`,
        {
          classifiedLeads: classifiedAfter,
        },
      );
    } else {
      await markCampaignCompleted(
        lead.campaignId,
        "AI scoring complete for this campaign sync.",
        {
          classifiedLeads: classifiedAfter,
        },
      );
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
        slackNotificationsEnabled: Boolean(lead.user.slackWebhookUrl),
      },
      "Lead classified with OpenAI",
    );

    return {
      score: result.score,
      label: result.label,
      category: result.category,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Lead classification failed.";
    await markCampaignFailed(lead.campaignId, "CLASSIFYING", errorMessage);
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
