import "dotenv/config";

import { pathToFileURL } from "node:url";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import {
  markCampaignCompleted,
  markCampaignFailed,
  markCampaignProcessing,
  updateCampaignProgress,
} from "./campaign-sync";
import { markCampaignRunCompleted, markCampaignRunFailed, markCampaignRunProcessing } from "./campaign-runs";
import { workerEmbeddingBatchSize, workerIngestionConcurrency, workerRedisConnection } from "./config";
import {
  enqueueLeadEmbeddingBatches,
  ensureLeadForEmbedding,
  getCampaignIngestionTarget,
  isOutsideRecencyWindow,
  matchesCampaignText,
  upsertRedditPost,
} from "./ingestion-shared";
import { workerLogger } from "./logger";
import { fetchSubredditPosts } from "./reddit";
import { dailyIngestJobName, ingestionQueueName, type DailyIngestJobData } from "./queues";

if (isDirectRun()) {
  const worker = new Worker<DailyIngestJobData>(
    ingestionQueueName,
    async (job) => {
      if (job.name !== dailyIngestJobName) {
        return;
      }

      return runDailyIngest(job.data, job.id ?? "unknown");
    },
    {
      connection: workerRedisConnection,
      concurrency: workerIngestionConcurrency,
    },
  );

  worker.on("completed", (job) => {
    if (job.name === dailyIngestJobName) {
      workerLogger.info({ jobId: job.id, name: job.name }, "Daily ingestion job completed");
    }
  });

  worker.on("failed", (job, error) => {
    if (job?.name === dailyIngestJobName) {
      workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Daily ingestion job failed");
    }
  });

  workerLogger.info("Daily ingestion worker started");
}

export async function runDailyIngest(data: DailyIngestJobData, jobId: string) {
  const campaign = await getCampaignIngestionTarget(data.campaignId);

  if (!campaign) {
    workerLogger.warn({ jobId, campaignId: data.campaignId }, "Campaign not found for daily ingestion");
    return { skipped: true, reason: "campaign_not_found" };
  }

  if (!campaign.isActive) {
    await markCampaignCompleted(campaign.id, "Campaign is paused. Daily sync skipped.");
    await markCampaignRunCompleted(data.campaignRunId, "Campaign is paused. Daily sync skipped.");
    workerLogger.info({ jobId, campaignId: campaign.id }, "Skipping inactive campaign daily ingestion");
    return { skipped: true, reason: "campaign_inactive" };
  }

  await markCampaignProcessing(campaign.id, "FETCHING_POSTS", "Starting daily Reddit sync for this campaign.");
  await markCampaignRunProcessing(data.campaignRunId, "Starting daily Reddit sync for this campaign.");

  const startedAt = Date.now();
  let fetchedPosts = 0;
  let promisingPosts = 0;
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

  for (const subreddit of campaign.subreddits) {
    try {
      await updateCampaignProgress(
        campaign.id,
        "FETCHING_POSTS",
        `Checking for new RSS posts in r/${subreddit}.`,
        { fetchedPosts, promisingPosts, matchedItems, createdLeads },
      );

      const cursor = await prisma.ingestCursor.findUnique({
        where: {
          subreddit,
        },
        select: {
          lastPostFullname: true,
          lastFetchedPostsAt: true,
        },
      });

      const posts = (await fetchSubredditPosts(subreddit)).sort(
        (left, right) => right.createdUtc.getTime() - left.createdUtc.getTime(),
      );
      fetchedPosts += posts.length;

      const newestSeenPost = posts[0] ?? null;

      for (const post of posts) {
        if (isKnownPostBoundary(post, cursor?.lastPostFullname ?? null, cursor?.lastFetchedPostsAt ?? null)) {
          break;
        }

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
        const leadEmbeddingItem = await ensureLeadForEmbedding({
          campaignId: campaign.id,
          userId: campaign.userId,
          redditItemId: redditPost.id,
        });

        if (leadEmbeddingItem) {
          createdLeads += 1;
          pendingEmbeddingItems.push(leadEmbeddingItem);

          if (pendingEmbeddingItems.length >= workerEmbeddingBatchSize) {
            await flushPendingEmbeddingItems();
          }
        }
      }

      if (newestSeenPost) {
        await prisma.ingestCursor.upsert({
          where: {
            subreddit,
          },
          update: {
            lastPostFullname: newestSeenPost.fullname,
            lastFetchedPostsAt: newestSeenPost.createdUtc,
          },
          create: {
            subreddit,
            lastPostFullname: newestSeenPost.fullname,
            lastFetchedPostsAt: newestSeenPost.createdUtc,
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Daily subreddit ingestion failed.";
      subredditErrors.push({ subreddit, message: errorMessage });
      workerLogger.error(
        {
          jobId,
          campaignId: campaign.id,
          subreddit,
          error: serializeError(error),
        },
        "Daily subreddit ingestion failed",
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
    const stats = {
      fetchedPosts,
      promisingPosts,
      matchedItems,
      createdLeads,
      queuedEmbeddingBatches,
      durationMs,
    };

    await updateCampaignProgress(
      campaign.id,
      "CLASSIFYING",
      `Daily RSS sync found ${createdLeads} new lead${createdLeads === 1 ? "" : "s"} for embedding and semantic filtering.${errorSummary}`,
      stats,
    );
    await markCampaignRunProcessing(data.campaignRunId, "Daily RSS sync found leads for embedding and semantic filtering.", stats);
  } else if (allSubredditsFailed) {
    const stats = {
      fetchedPosts,
      promisingPosts,
      matchedItems,
      createdLeads,
      queuedEmbeddingBatches,
      durationMs,
    };

    await markCampaignFailed(
      campaign.id,
      "FETCHING_POSTS",
      `Daily RSS sync completed with no queued leads.${errorSummary}`,
      stats,
    );
    await markCampaignRunFailed(data.campaignRunId, `Daily RSS sync completed with no queued leads.${errorSummary}`, stats);
  } else {
    const stats = {
      fetchedPosts,
      promisingPosts,
      matchedItems,
      createdLeads,
      queuedEmbeddingBatches,
      durationMs,
    };

    await markCampaignCompleted(
      campaign.id,
      `Daily RSS sync completed. No new matching leads were found.${hasErrors ? errorSummary : ""}`,
      stats,
    );
    await markCampaignRunCompleted(data.campaignRunId, `Daily RSS sync completed. No new matching leads were found.${hasErrors ? errorSummary : ""}`, stats);
  }

  workerLogger.info(
    {
      jobId,
      campaignId: campaign.id,
      fetchedPosts,
      filteredPosts: promisingPosts,
      matchedItems,
      createdLeads,
      queuedEmbeddingBatches,
      subredditErrors,
      durationMs,
    },
    "Daily RSS campaign ingestion completed",
  );

  return {
    fetchedPosts,
    promisingPosts,
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

function isKnownPostBoundary(
  post: { fullname: string; createdUtc: Date },
  lastPostFullname: string | null,
  lastFetchedPostsAt: Date | null,
) {
  if (lastPostFullname && post.fullname === lastPostFullname) {
    return true;
  }

  if (lastFetchedPostsAt && post.createdUtc.getTime() <= lastFetchedPostsAt.getTime()) {
    return true;
  }

  return false;
}

function isDirectRun() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}
