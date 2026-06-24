import { prisma } from "@/lib/prisma";

import { workerLogger } from "./logger";

type InitialRssDiagnosticsContext = {
  campaignId: string;
  campaignRunId: string;
  jobId: string;
  sequence: number;
  subreddit: string;
};

type RssEventStatus =
  | "FETCHING"
  | "SUCCESS"
  | "RATE_LIMIT_RETRYING"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "HTTP_ERROR"
  | "NETWORK_ERROR";

export function createInitialRssDiagnostics(context: InitialRssDiagnosticsContext | null) {
  let eventId: string | null = null;

  const writeSafely = async (operation: () => Promise<void>) => {
    if (!context) {
      return;
    }

    try {
      await operation();
    } catch (error) {
      workerLogger.warn(
        {
          campaignId: context.campaignId,
          campaignRunId: context.campaignRunId,
          subreddit: context.subreddit,
          error,
        },
        "Initial RSS diagnostics write failed",
      );
    }
  };

  return {
    observer: context
      ? {
          onRequestStart: async (event: {
            attempt: number;
            requestedAt: Date;
            waitMs: number;
            nextRequestDelayMs: number;
            nextRequestAt: Date;
          }) => {
            await writeSafely(async () => {
              const row = await prisma.campaignInitialRssPollEvent.create({
                data: {
                  campaignId: context.campaignId,
                  campaignRunId: context.campaignRunId,
                  subreddit: context.subreddit,
                  sequence: context.sequence,
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
            status: Exclude<RssEventStatus, "FETCHING" | "NETWORK_ERROR">;
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
        }
      : undefined,
    recordOutcome: async (outcome: {
      fetchedPosts: number;
      matchedItems: number;
      createdLeads: number;
    }) => {
      await updateCurrentEvent(outcome);
    },
  };

  async function updateCurrentEvent(data: {
    status?: RssEventStatus;
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
    matchedItems?: number;
    createdLeads?: number;
  }) {
    await writeSafely(async () => {
      if (!eventId) {
        return;
      }

      await prisma.campaignInitialRssPollEvent.update({
        where: {
          id: eventId,
        },
        data,
      });
    });
  }
}
