import { prisma } from "@/lib/prisma";

import { workerLogger } from "./logger";

type SubredditRssPollSource = "SUBREDDIT_DAILY_INGEST" | "RSS_POLL";

type SubredditRssPollDiagnosticsContext = {
  jobId: string;
  source: SubredditRssPollSource;
  subreddit: string;
};

type SubredditRssPollStatus =
  | "FETCHING"
  | "SUCCESS"
  | "RATE_LIMIT_RETRYING"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "BACKOFF_SKIPPED";

export function createSubredditRssPollDiagnostics(context: SubredditRssPollDiagnosticsContext) {
  let eventId: string | null = null;

  const writeSafely = async (operation: () => Promise<void>) => {
    try {
      await operation();
    } catch (error) {
      workerLogger.warn(
        {
          jobId: context.jobId,
          subreddit: context.subreddit,
          source: context.source,
          error,
        },
        "Subreddit RSS poll diagnostics write failed",
      );
    }
  };

  return {
    observer: {
      onRequestStart: async (event: {
        attempt: number;
        requestedAt: Date;
        waitMs: number;
        nextRequestDelayMs: number;
        nextRequestAt: Date;
      }) => {
        await writeSafely(async () => {
          const row = await prisma.subredditRssPollEvent.create({
            data: {
              subreddit: context.subreddit,
              source: context.source,
              attempt: event.attempt,
              jobId: context.jobId,
              status: "FETCHING",
              requestedAt: event.requestedAt,
              fetchStartedAt: event.requestedAt,
              waitMs: event.waitMs,
              nextRequestDelayMs: event.nextRequestDelayMs,
              nextRequestAt: event.nextRequestAt,
            },
            select: {
              id: true,
            },
          });

          eventId = row.id;
        });
      },
      onResponse: async (event: {
        status: Exclude<SubredditRssPollStatus, "FETCHING" | "NETWORK_ERROR" | "BACKOFF_SKIPPED">;
        httpStatus: number;
        statusText: string;
        completedAt: Date;
        durationMs: number;
        retryAfterMs: number | null;
        rateLimitHeaders: {
          ratelimitUsed: string | null;
          ratelimitRemaining: string | null;
          ratelimitReset: string | null;
          retryAfter: string | null;
        };
        retryWaitMs?: number;
        retryUntil?: Date;
        errorMessage?: string;
      }) => {
        await updateCurrentEvent({
          status: event.status,
          completedAt: event.completedAt,
          durationMs: event.durationMs,
          httpStatus: event.httpStatus,
          statusText: event.statusText,
          errorMessage: event.errorMessage,
          ratelimitUsed: event.rateLimitHeaders.ratelimitUsed,
          ratelimitRemaining: event.rateLimitHeaders.ratelimitRemaining,
          ratelimitReset: event.rateLimitHeaders.ratelimitReset,
          retryAfter: event.rateLimitHeaders.retryAfter,
          retryAfterMs: event.retryAfterMs,
          retryWaitMs: event.retryWaitMs,
          retryUntil: event.retryUntil,
        });
      },
      onNetworkError: async (event: {
        completedAt: Date;
        durationMs: number;
        errorMessage: string;
      }) => {
        await updateCurrentEvent({
          status: "NETWORK_ERROR",
          completedAt: event.completedAt,
          durationMs: event.durationMs,
          errorMessage: event.errorMessage,
        });
      },
    },
    recordOutcome: async (outcome: {
      fetchedPosts?: number;
      existingPosts?: number;
      createdPosts?: number;
      queuedEmbeddings?: number;
      backoffUntil?: Date | null;
    }) => {
      await updateCurrentEvent(outcome);
    },
    recordBackoffSkip: async (input: {
      backoffUntil: Date;
    }) => {
      const now = new Date();

      await writeSafely(async () => {
        await prisma.subredditRssPollEvent.create({
          data: {
            subreddit: context.subreddit,
            source: context.source,
            jobId: context.jobId,
            status: "BACKOFF_SKIPPED",
            requestedAt: now,
            completedAt: now,
            durationMs: 0,
            backoffUntil: input.backoffUntil,
            errorMessage: `r/${context.subreddit} is in RSS backoff until ${input.backoffUntil.toISOString()}.`,
          },
        });
      });
    },
  };

  async function updateCurrentEvent(data: {
    status?: SubredditRssPollStatus;
    completedAt?: Date;
    durationMs?: number;
    httpStatus?: number;
    statusText?: string;
    errorMessage?: string;
    ratelimitUsed?: string | null;
    ratelimitRemaining?: string | null;
    ratelimitReset?: string | null;
    retryAfter?: string | null;
    retryAfterMs?: number | null;
    retryWaitMs?: number;
    retryUntil?: Date;
    fetchedPosts?: number;
    existingPosts?: number;
    createdPosts?: number;
    queuedEmbeddings?: number;
    backoffUntil?: Date | null;
  }) {
    await writeSafely(async () => {
      if (!eventId) {
        return;
      }

      await prisma.subredditRssPollEvent.update({
        where: {
          id: eventId,
        },
        data,
      });
    });
  }
}
