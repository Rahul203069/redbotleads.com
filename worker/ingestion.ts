import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import {
  markCampaignCompleted,
  markCampaignFailed,
  markCampaignProcessing,
  updateCampaignProgress,
} from "./campaign-sync";
import { workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { fetchSubredditPosts } from "./reddit";
import {
  type InitialIngestJobData,
  enqueueLeadEmbedding,
  ingestionQueueName,
} from "./queues";

const worker = new Worker<InitialIngestJobData>(
  ingestionQueueName,
  async (job) => {
    if (job.name !== "INITIAL_INGEST") {
      workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported ingestion job");
      return;
    }

    return runInitialIngest(job.data, job.id ?? "unknown");
  },
  {
    connection: workerRedisConnection,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Ingestion job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Ingestion job failed");
});

workerLogger.info("Ingestion worker started");

async function runInitialIngest(data: InitialIngestJobData, jobId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: data.campaignId,
    },
    select: {
      id: true,
      userId: true,
      keywords: true,
      negativeKeywords: true,
      subreddits: true,
      recentDays: true,
      isActive: true,
    },
  });

  if (!campaign) {
    workerLogger.warn({ jobId, campaignId: data.campaignId }, "Campaign not found for ingestion");
    return { skipped: true, reason: "campaign_not_found" };
  }

  if (!campaign.isActive) {
    await markCampaignCompleted(campaign.id, "Campaign is paused. Initial sync skipped.");
    workerLogger.info({ jobId, campaignId: campaign.id }, "Skipping inactive campaign ingestion");
    return { skipped: true, reason: "campaign_inactive" };
  }

  await markCampaignProcessing(campaign.id, "FETCHING_POSTS", "Starting Reddit ingestion for this campaign.");

  const startedAt = Date.now();
  let fetchedPosts = 0;
  let promisingPosts = 0;
  let fetchedComments = 0;
  let matchedItems = 0;
  let createdLeads = 0;
  const subredditErrors: Array<{ subreddit: string; message: string }> = [];

  for (const subreddit of campaign.subreddits) {
    try {
      await updateCampaignProgress(
        campaign.id,
        "FETCHING_POSTS",
        `Fetching recent RSS posts from r/${subreddit}.`,
        { fetchedPosts, promisingPosts, fetchedComments, matchedItems, createdLeads },
      );

      const posts = await fetchSubredditPosts(subreddit);
      fetchedPosts += posts.length;

      for (const post of posts) {
        if (isOutsideRecencyWindow(post.createdUtc, campaign.recentDays)) {
          continue;
        }

        const postMatches = matchesCampaignText(
          [post.title, post.description, post.body].filter(Boolean).join("\n"),
          campaign.keywords,
          campaign.negativeKeywords,
        );

        if (!postMatches) {
          continue;
        }

        promisingPosts += 1;
        const redditPost = await upsertRedditPost(post);
        matchedItems += 1;
        createdLeads += await ensureLeadAndEnqueueClassification({
          campaignId: campaign.id,
          userId: campaign.userId,
          redditItemId: redditPost.id,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Subreddit ingestion failed.";
      subredditErrors.push({ subreddit, message: errorMessage });
      workerLogger.error(
        {
          jobId,
          campaignId: campaign.id,
          subreddit,
          error,
        },
        "Subreddit ingestion failed",
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  const hasErrors = subredditErrors.length > 0;
  const allSubredditsFailed = subredditErrors.length === campaign.subreddits.length;
  const errorSummary =
    subredditErrors.length > 0
      ? ` RSS failures: ${subredditErrors.map((entry) => `r/${entry.subreddit} (${entry.message})`).join("; ")}`
      : "";

  if (createdLeads > 0) {
    await updateCampaignProgress(
      campaign.id,
      "CLASSIFYING",
      `RSS ingestion complete. ${createdLeads} lead${createdLeads === 1 ? "" : "s"} queued for AI scoring.${errorSummary}`,
      {
        fetchedPosts,
        promisingPosts,
        fetchedComments,
        matchedItems,
        createdLeads,
        durationMs,
      },
    );
  } else if (allSubredditsFailed) {
    await markCampaignFailed(
      campaign.id,
      "FETCHING_POSTS",
      `RSS ingestion completed with no queued leads.${errorSummary}`,
      {
        fetchedPosts,
        promisingPosts,
        fetchedComments,
        matchedItems,
        createdLeads,
        durationMs,
      },
    );
  } else {
    await markCampaignCompleted(
      campaign.id,
      `RSS ingestion completed. No matching leads were found.${hasErrors ? errorSummary : ""}`,
      {
        fetchedPosts,
        promisingPosts,
        fetchedComments,
        matchedItems,
        createdLeads,
        durationMs,
      },
    );
  }

  workerLogger.info(
    {
      jobId,
      campaignId: campaign.id,
      trigger: data.trigger,
      fetchedPosts,
      filteredPosts: promisingPosts,
      matchedItems,
      createdLeads,
      subredditErrors,
      durationMs,
    },
    "Initial RSS campaign ingestion completed",
  );

  return {
    fetchedPosts,
    promisingPosts,
    fetchedComments,
    matchedItems,
    createdLeads,
    subredditErrors,
    durationMs,
  };
}

async function upsertRedditPost(post: Awaited<ReturnType<typeof fetchSubredditPosts>>[number]) {
  return prisma.redditItem.upsert({
    where: {
      fullname: post.fullname,
    },
    update: {
      subreddit: post.subreddit,
      title: post.title || null,
      description: post.description || null,
      body: post.body || null,
      author: post.author,
      url: post.url,
      createdUtc: post.createdUtc,
      rawJson: post.rawJson as Prisma.InputJsonValue,
    },
    create: {
      fullname: post.fullname,
      type: "POST",
      subreddit: post.subreddit,
      title: post.title || null,
      description: post.description || null,
      body: post.body || null,
      author: post.author,
      url: post.url,
      createdUtc: post.createdUtc,
      rawJson: post.rawJson as Prisma.InputJsonValue,
    },
    select: {
      id: true,
    },
  });
}

async function ensureLeadAndEnqueueClassification({
  campaignId,
  userId,
  redditItemId,
}: {
  campaignId: string;
  userId: string;
  redditItemId: string;
}) {
  try {
    const lead = await prisma.lead.create({
      data: {
        campaignId,
        userId,
        redditItemId,
      },
      select: {
        id: true,
      },
    });

    await enqueueLeadEmbedding({
      leadId: lead.id,
      campaignId,
      redditItemId,
    });

    return 1;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return 0;
    }

    throw error;
  }
}

function matchesCampaignText(content: string, keywords: string[], negativeKeywords: string[]) {
  const normalized = normalize(content);

  if (!normalized) {
    return false;
  }

  if (negativeKeywords.some((keyword) => normalized.includes(normalize(keyword)))) {
    return false;
  }

  if (keywords.length === 0) {
    return true;
  }

  return keywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function isOutsideRecencyWindow(createdUtc: Date, recentDays: number) {
  const maxAgeMs = recentDays * 24 * 60 * 60 * 1000;
  return Date.now() - createdUtc.getTime() > maxAgeMs;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
