import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { workerEmbeddingBatchSize } from "./config";
import { fetchSubredditPosts } from "./reddit";
import {
  enqueueLeadEmbedding,
  enqueueLeadEmbeddingBatch,
  type LeadEmbeddingBatchItem,
} from "./queues";

export async function getCampaignIngestionTarget(campaignId: string) {
  return prisma.campaign.findFirst({
    where: {
      id: campaignId,
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
}

export async function upsertRedditPost(post: Awaited<ReturnType<typeof fetchSubredditPosts>>[number]) {
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
      fullname: true,
    },
  });
}

export async function ensureLeadForEmbedding({
  campaignId,
  userId,
  redditItemId,
}: {
  campaignId: string;
  userId: string;
  redditItemId: string;
}): Promise<LeadEmbeddingBatchItem | null> {
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

    return {
      leadId: lead.id,
      redditItemId,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }

    throw error;
  }
}

export async function ensureLeadAndEnqueueEmbedding({
  campaignId,
  campaignRunId,
  userId,
  redditItemId,
}: {
  campaignId: string;
  campaignRunId?: string;
  userId: string;
  redditItemId: string;
}) {
  const item = await ensureLeadForEmbedding({
    campaignId,
    userId,
    redditItemId,
  });

  if (!item) {
    return 0;
  }

  await enqueueLeadEmbedding({
    leadId: item.leadId,
    campaignId,
    campaignRunId,
    redditItemId: item.redditItemId,
  });

  return 1;
}

export async function enqueueLeadEmbeddingBatches(campaignId: string, items: LeadEmbeddingBatchItem[], campaignRunId?: string) {
  let enqueuedBatches = 0;

  for (let index = 0; index < items.length; index += workerEmbeddingBatchSize) {
    const chunk = items.slice(index, index + workerEmbeddingBatchSize);

    if (chunk.length === 0) {
      continue;
    }

    await enqueueLeadEmbeddingBatch({
      campaignId,
      campaignRunId,
      items: chunk,
    });
    enqueuedBatches += 1;
  }

  return enqueuedBatches;
}

export function matchesCampaignText(content: string, keywords: string[], negativeKeywords: string[]) {
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

export function isOutsideRecencyWindow(createdUtc: Date, recentDays: number) {
  const maxAgeMs = recentDays * 24 * 60 * 60 * 1000;
  return Date.now() - createdUtc.getTime() > maxAgeMs;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
