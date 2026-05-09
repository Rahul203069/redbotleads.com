import "dotenv/config";

import { Worker } from "bullmq";

import {
  markCampaignCompleted,
  markCampaignFailed,
  markCampaignProcessing,
  updateCampaignProgress,
} from "./campaign-sync";
import { workerIngestionConcurrency, workerRedisConnection } from "./config";
import { runDailyIngest } from "./daily-ingestion";
import {
  ensureLeadAndEnqueueEmbedding,
  getCampaignIngestionTarget,
  isOutsideRecencyWindow,
  matchesCampaignText,
  upsertRedditPost,
} from "./ingestion-shared";
import { workerLogger } from "./logger";
import { fetchSubredditPosts } from "./reddit";
import {
  dailyIngestJobName,
  initialIngestJobName,
  type DailyIngestJobData,
  type InitialIngestJobData,
  ingestionQueueName,
} from "./queues";

type IngestionJobData = InitialIngestJobData | DailyIngestJobData;

const worker = new Worker<IngestionJobData>(
  ingestionQueueName,
  async (job) => {
    if (job.name === initialIngestJobName) {
      return runInitialIngest(job.data as InitialIngestJobData, job.id ?? "unknown");
    }

    if (job.name === dailyIngestJobName) {
      return runDailyIngest(job.data as DailyIngestJobData, job.id ?? "unknown");
    }

    workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported ingestion job");
    return;
  },
  {
    connection: workerRedisConnection,
    concurrency: workerIngestionConcurrency,
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
  const campaign = await getCampaignIngestionTarget(data.campaignId);

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
  const fetchedComments = 0;
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
        createdLeads += await ensureLeadAndEnqueueEmbedding({
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
