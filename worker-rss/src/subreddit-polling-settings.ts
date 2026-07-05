import { prisma } from "./prisma";

export type SubredditDailyRssPollingState = {
  subreddit: string;
  enabled: boolean;
  disabledAt: string | null;
  disabledBy: string | null;
};

export async function getDisabledDailyRssSubredditSet(subreddits?: string[]) {
  const normalizedSubreddits = subreddits
    ? Array.from(new Set(subreddits.map(normalizeSubredditName).filter(Boolean)))
    : null;

  if (normalizedSubreddits && normalizedSubreddits.length === 0) {
    return new Set<string>();
  }

  const disabledSubreddits = await prisma.subreddit.findMany({
    where: {
      dailyRssPollingEnabled: false,
      ...(normalizedSubreddits
        ? {
            name: {
              in: normalizedSubreddits,
            },
          }
        : {}),
    },
    select: {
      name: true,
    },
  });

  return new Set(disabledSubreddits.map((subreddit) => normalizeSubredditName(subreddit.name)).filter(Boolean));
}

export async function getSubredditDailyRssPollingStateMap(subreddits: string[]) {
  const normalizedSubreddits = Array.from(new Set(subreddits.map(normalizeSubredditName).filter(Boolean)));
  const states: Record<string, SubredditDailyRssPollingState> = {};

  for (const subreddit of normalizedSubreddits) {
    states[subreddit] = {
      subreddit,
      enabled: true,
      disabledAt: null,
      disabledBy: null,
    };
  }

  if (normalizedSubreddits.length === 0) {
    return states;
  }

  const storedStates = await prisma.subreddit.findMany({
    where: {
      name: {
        in: normalizedSubreddits,
      },
    },
    select: {
      name: true,
      dailyRssPollingEnabled: true,
      dailyRssPollingDisabledAt: true,
      dailyRssPollingDisabledBy: true,
    },
  });

  for (const state of storedStates) {
    const subreddit = normalizeSubredditName(state.name);

    if (!subreddit) {
      continue;
    }

    states[subreddit] = {
      subreddit,
      enabled: state.dailyRssPollingEnabled,
      disabledAt: state.dailyRssPollingDisabledAt?.toISOString() ?? null,
      disabledBy: state.dailyRssPollingDisabledBy,
    };
  }

  return states;
}

export async function isSubredditDailyRssPollingEnabled(subreddit: string) {
  const normalizedSubreddit = normalizeSubredditName(subreddit);

  if (!normalizedSubreddit) {
    return false;
  }

  const state = await prisma.subreddit.findUnique({
    where: {
      name: normalizedSubreddit,
    },
    select: {
      dailyRssPollingEnabled: true,
    },
  });

  return state?.dailyRssPollingEnabled ?? true;
}

export async function setSubredditDailyRssPollingEnabled(input: {
  changedBy: string | null;
  enabled: boolean;
  subreddit: string;
}) {
  const subreddit = normalizeSubredditName(input.subreddit);

  if (!subreddit) {
    throw new Error("Subreddit is required.");
  }

  const disabledAt = input.enabled ? null : new Date();
  const disabledBy = input.enabled ? null : input.changedBy;

  const state = await prisma.subreddit.upsert({
    where: {
      name: subreddit,
    },
    create: {
      name: subreddit,
      dailyRssPollingEnabled: input.enabled,
      dailyRssPollingDisabledAt: disabledAt,
      dailyRssPollingDisabledBy: disabledBy,
    },
    update: {
      dailyRssPollingEnabled: input.enabled,
      dailyRssPollingDisabledAt: disabledAt,
      dailyRssPollingDisabledBy: disabledBy,
    },
    select: {
      name: true,
      dailyRssPollingEnabled: true,
      dailyRssPollingDisabledAt: true,
      dailyRssPollingDisabledBy: true,
    },
  });

  return {
    subreddit: state.name,
    enabled: state.dailyRssPollingEnabled,
    disabledAt: state.dailyRssPollingDisabledAt?.toISOString() ?? null,
    disabledBy: state.dailyRssPollingDisabledBy,
  };
}

export function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
