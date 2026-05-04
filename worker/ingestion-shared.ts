import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { fetchSubredditPosts } from "./reddit";
import { enqueueLeadEmbedding } from "./queues";

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

export async function ensureLeadAndEnqueueEmbedding({
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
