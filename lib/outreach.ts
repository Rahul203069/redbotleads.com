import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { getDailyLeadDateSelection } from "@/lib/daily-leads-analytics";
import { prisma } from "@/lib/prisma";

export const outreachDateFilterSchema = z.object({
  range: z.string().max(32).optional(),
  date: z.array(z.string().max(32)).max(31).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export const outreachSettingsSchema = z.object({
  firstTouchInstructions: z.string().trim().min(10).max(4000),
  firstTouchExamples: z.string().trim().max(6000),
  followUpInstructions: z.string().trim().min(10).max(4000),
  followUpExamples: z.string().trim().max(6000),
});

export async function getOutreachAdmin() {
  const session = await auth();
  if (!session?.user?.id || !canViewAnalytics(session.user.email)) return null;
  return { email: session.user.email, userId: session.user.id };
}

export async function getAdminOutreachRun(runId: string, userId: string) {
  return prisma.outreachRun.findFirst({
    where: { id: runId, userId },
    include: {
      posts: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          redditItem: {
            select: {
              author: true,
              body: true,
              fullname: true,
              subreddit: true,
              title: true,
              url: true,
            },
          },
        },
      },
      attempts: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          contact: { select: { displayUsername: true, normalizedUsername: true } },
        },
      },
    },
  });
}

export function serializeOutreachRun(run: NonNullable<Awaited<ReturnType<typeof getAdminOutreachRun>>>) {
  return {
    id: run.id,
    campaignId: run.campaignId,
    redditAccountId: run.redditAccountId,
    status: run.status,
    publicLeadsUrl: run.publicLeadsUrl,
    counts: {
      queuedPosts: run.queuedPosts,
      analyzedPosts: run.analyzedPosts,
      draftedMessages: run.draftedMessages,
      sentMessages: run.sentMessages,
      skippedMessages: run.skippedMessages,
      failedMessages: run.failedMessages,
    },
    lastError: run.lastError,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    posts: run.posts.map((post) => ({
      id: post.id,
      redditItemId: post.redditItemId,
      leadId: post.leadId,
      status: post.status,
      commentCount: post.commentCount,
      selectedCount: post.selectedCount,
      error: post.error,
      redditItem: post.redditItem,
    })),
    attempts: run.attempts.map((attempt) => ({
      id: attempt.id,
      runPostId: attempt.runPostId,
      username: attempt.contact.displayUsername,
      normalizedUsername: attempt.contact.normalizedUsername,
      stage: attempt.stage,
      status: attempt.status,
      message: attempt.message,
      sourceCommentId: attempt.sourceCommentId,
      sourceCommentUrl: attempt.sourceCommentUrl,
      qualificationReason: attempt.qualificationReason,
      error: attempt.error,
      sentAt: attempt.sentAt?.toISOString() ?? null,
    })),
  };
}

export function buildOutreachLeadCreatedWhere(filter: z.infer<typeof outreachDateFilterSchema>) {
  const selection = getDailyLeadDateSelection(filter);
  if (selection.source === "dates") {
    return {
      OR: selection.ranges.map((range) => ({ createdAt: { gte: range.from, lt: range.to } })),
    } satisfies Prisma.LeadWhereInput;
  }
  return {
    createdAt: { gte: selection.range.from, lt: selection.range.to },
  } satisfies Prisma.LeadWhereInput;
}

export function validatePublicLeadsUrl(value: string, campaignId: string, requestUrl: string) {
  try {
    const url = new URL(value);
    const requestOrigin = new URL(requestUrl).origin;
    if (url.origin !== requestOrigin || url.pathname !== `/share/leads/${campaignId}`) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function countRecentSentMessages(redditAccountId: string, since: Date) {
  return prisma.outreachAttempt.count({
    where: {
      status: "SENT",
      sentAt: { gte: since },
      contact: { is: { redditAccountId } },
    },
  });
}

export async function recountOutreachRun(tx: Prisma.TransactionClient, runId: string) {
  const [postCounts, attemptCounts] = await Promise.all([
    tx.outreachRunPost.groupBy({ by: ["status"], where: { runId }, _count: { _all: true } }),
    tx.outreachAttempt.groupBy({ by: ["status"], where: { runId }, _count: { _all: true } }),
  ]);
  const postCount = new Map(postCounts.map((row) => [row.status, row._count._all]));
  const attemptCount = new Map(attemptCounts.map((row) => [row.status, row._count._all]));

  return tx.outreachRun.update({
    where: { id: runId },
    data: {
      analyzedPosts: [...postCount.entries()]
        .filter(([status]) => ["READY", "COMPLETED", "SKIPPED", "FAILED"].includes(status))
        .reduce((sum, [, count]) => sum + count, 0),
      draftedMessages: [...attemptCount.entries()]
        .filter(([status]) => ["DRAFT", "AWAITING_APPROVAL", "SENT"].includes(status))
        .reduce((sum, [, count]) => sum + count, 0),
      sentMessages: attemptCount.get("SENT") ?? 0,
      skippedMessages: attemptCount.get("SKIPPED") ?? 0,
      failedMessages: attemptCount.get("FAILED") ?? 0,
    },
  });
}
