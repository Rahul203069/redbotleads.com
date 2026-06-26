import "dotenv/config";

import { Worker } from "bullmq";

import {
  markCampaignCompleted,
  markCampaignFailed,
  markCampaignProcessing,
  updateCampaignProgress,
} from "./campaign-sync";
import { markCampaignRunCompleted, markCampaignRunFailed, markCampaignRunProcessing } from "./campaign-runs";
import { finalizeCampaignLeadProcessing, withRssIngestionCompleted } from "./campaign-finalization";
import { workerEmbeddingBatchSize, workerIngestionConcurrency, workerRedisConnection } from "./config";
import { runDailyIngest } from "./daily-ingestion";
import {
  enqueueLeadEmbeddingBatches,
  ensureLeadForEmbedding,
  getCampaignIngestionTarget,
  isOutsideRecencyWindow,
  matchesCampaignText,
  upsertRedditPost,
} from "./ingestion-shared";
import { createInitialRssDiagnostics } from "./initial-rss-diagnostics";
import { workerLogger } from "./logger";
import { fetchSubredditPosts } from "./reddit";
import { runSubredditDailyIngest } from "./subreddit-daily-ingestion";
import {
  dailyIngestJobName,
  initialIngestJobName,
  type DailyIngestJobData,
  type InitialIngestJobData,
  type SubredditDailyIngestJobData,
  ingestionQueueName,
  subredditDailyIngestJobName,
} from "./queues";

type IngestionJobData = InitialIngestJobData | DailyIngestJobData | SubredditDailyIngestJobData;

const worker = new Worker<IngestionJobData>(
  ingestionQueueName,
  async (job) => {
    if (job.name === initialIngestJobName) {
      return runInitialIngest(job.data as InitialIngestJobData, job.id ?? "unknown");
    }

    if (job.name === dailyIngestJobName) {
      return runDailyIngest(job.data as DailyIngestJobData, job.id ?? "unknown");
    }

    if (job.name === subredditDailyIngestJobName) {
      return runSubredditDailyIngest(job.data as SubredditDailyIngestJobData, job.id ?? "unknown");
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
    await markCampaignRunCompleted(data.campaignRunId, "Campaign is paused. Initial sync skipped.");
    workerLogger.info({ jobId, campaignId: campaign.id }, "Skipping inactive campaign ingestion");
    return { skipped: true, reason: "campaign_inactive" };
  }

  await markCampaignProcessing(campaign.id, "FETCHING_POSTS", "Starting Reddit ingestion for this campaign.");
  await markCampaignRunProcessing(data.campaignRunId, "Starting Reddit ingestion for this campaign.");

  const startedAt = Date.now();
  let fetchedPosts = 0;
  let promisingPosts = 0;
  const fetchedComments = 0;
  let matchedItems = 0;
  let createdLeads = 0;
  let queuedEmbeddingBatches = 0;
  const pendingEmbeddingItems: Array<{ leadId: string; redditItemId: string }> = [];
  const subredditErrors: Array<{ subreddit: string; message: string }> = [];

  const flushPendingEmbeddingItems = async () => {
    if (pendingEmbeddingItems.length === 0) {
      return;
    }

    const items = pendingEmbeddingItems.slice();
    queuedEmbeddingBatches += await enqueueLeadEmbeddingBatches(campaign.id, items, data.campaignRunId);
    pendingEmbeddingItems.splice(0, items.length);
  };

  for (const [subredditIndex, subreddit] of campaign.subreddits.entries()) {
    const diagnostics = createInitialRssDiagnostics(
      data.trigger === "campaign_created" && data.campaignRunId
        ? {
            campaignId: campaign.id,
            campaignRunId: data.campaignRunId,
            jobId,
            sequence: subredditIndex,
            subreddit,
          }
        : null,
    );

    try {
      await updateCampaignProgress(
        campaign.id,
        "FETCHING_POSTS",
        `Fetching recent RSS posts from r/${subreddit}.`,
        { fetchedPosts, promisingPosts, fetchedComments, matchedItems, createdLeads },
      );

      const posts = await fetchSubredditPosts(subreddit, {
        observer: {
          ...diagnostics.observer,
          onRequestWait: async (event) => {
            await updateCampaignProgress(
              campaign.id,
              "FETCHING_POSTS",
              `Waiting ${Math.ceil(event.waitMs / 1000)}s before fetching recent RSS posts from r/${subreddit}.`,
              { fetchedPosts, promisingPosts, fetchedComments, matchedItems, createdLeads },
            );
          },
        },
      });
      fetchedPosts += posts.length;
      let subredditMatchedItems = 0;
      let subredditCreatedLeads = 0;

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
        subredditMatchedItems += 1;
        const leadEmbeddingItem = await ensureLeadForEmbedding({
          campaignId: campaign.id,
          userId: campaign.userId,
          redditItemId: redditPost.id,
        });

        if (leadEmbeddingItem) {
          createdLeads += 1;
          subredditCreatedLeads += 1;
          pendingEmbeddingItems.push(leadEmbeddingItem);

          if (pendingEmbeddingItems.length >= workerEmbeddingBatchSize) {
            await flushPendingEmbeddingItems();
          }
        }
      }

      await diagnostics.recordOutcome({
        fetchedPosts: posts.length,
        matchedItems: subredditMatchedItems,
        createdLeads: subredditCreatedLeads,
      });

      await flushPendingEmbeddingItems();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Subreddit ingestion failed.";
      subredditErrors.push({ subreddit, message: errorMessage });
      workerLogger.error(
        {
          jobId,
          campaignId: campaign.id,
          subreddit,
          error: serializeError(error),
        },
        "Subreddit ingestion failed",
      );
    }
  }

  await flushPendingEmbeddingItems();

  const durationMs = Date.now() - startedAt;
  const hasErrors = subredditErrors.length > 0;
  const allSubredditsFailed = subredditErrors.length === campaign.subreddits.length;
  const errorSummary =
    subredditErrors.length > 0
      ? ` RSS failures: ${subredditErrors.map((entry) => `r/${entry.subreddit} (${entry.message})`).join("; ")}`
      : "";

  if (createdLeads > 0) {
    const stats = withRssIngestionCompleted({
      fetchedPosts,
      promisingPosts,
      fetchedComments,
      matchedItems,
      createdLeads,
      queuedEmbeddingBatches,
      durationMs,
    });

    await finalizeCampaignLeadProcessing({
      campaignId: campaign.id,
      campaignRunId: data.campaignRunId,
      stats,
      completeMessage: `RSS ingestion and lead processing complete for this campaign sync.${errorSummary}`,
      pendingMessage: (remainingLeads) =>
        `RSS ingestion complete. ${createdLeads} lead${createdLeads === 1 ? "" : "s"} queued for embedding and semantic filtering; ${remainingLeads} lead${remainingLeads === 1 ? "" : "s"} still waiting for AI processing.${errorSummary}`,
    });
  } else if (allSubredditsFailed) {
    const stats = withRssIngestionCompleted({
      fetchedPosts,
      promisingPosts,
      fetchedComments,
      matchedItems,
      createdLeads,
      queuedEmbeddingBatches,
      durationMs,
    });

    await markCampaignFailed(
      campaign.id,
      "FETCHING_POSTS",
      `RSS ingestion completed with no queued leads.${errorSummary}`,
      stats,
    );
    await markCampaignRunFailed(data.campaignRunId, `RSS ingestion completed with no queued leads.${errorSummary}`, stats);
  } else {
    const stats = withRssIngestionCompleted({
      fetchedPosts,
      promisingPosts,
      fetchedComments,
      matchedItems,
      createdLeads,
      queuedEmbeddingBatches,
      durationMs,
    });

    await markCampaignCompleted(
      campaign.id,
      `RSS ingestion completed. No matching leads were found.${hasErrors ? errorSummary : ""}`,
      stats,
    );
    await markCampaignRunCompleted(data.campaignRunId, `RSS ingestion completed. No matching leads were found.${hasErrors ? errorSummary : ""}`, stats);
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
      queuedEmbeddingBatches,
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
    queuedEmbeddingBatches,
    subredditErrors,
    durationMs,
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...("status" in error && typeof error.status === "number" ? { status: error.status } : {}),
      ...("statusText" in error && typeof error.statusText === "string" ? { statusText: error.statusText } : {}),
      ...("retryAfterMs" in error && typeof error.retryAfterMs === "number" ? { retryAfterMs: error.retryAfterMs } : {}),
    };
  }

  return {
    message: String(error ?? "Unknown error"),
  };
}
