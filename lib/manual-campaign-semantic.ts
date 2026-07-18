export const CAMPAIGN_SEMANTIC_RUN_TRIGGERS = ["DAILY_SEMANTIC", "MANUAL_SEMANTIC"] as const;
export const INITIAL_SEMANTIC_LOOKBACK_HOURS = 36;

export type ManualCampaignSemanticState = {
  canRun: boolean;
  message: string;
  runId: string | null;
  status: "READY" | "QUEUED" | "PROCESSING" | "FAILED" | "COMPLETED" | "UNAVAILABLE";
  stats: {
    classifiedLeads?: number;
    matchedPosts?: number;
    pendingClassifications?: number;
    scannedPosts?: number;
    strongLeads?: number;
  } | null;
};

type SemanticRunSummary = {
  id: string;
  message: string | null;
  status: string;
  statsJson: unknown;
};

export function getSemanticLookbackHours({
  hasCompletedSemanticRun,
  initialLookbackHours = INITIAL_SEMANTIC_LOOKBACK_HOURS,
  recurringLookbackHours,
}: {
  hasCompletedSemanticRun: boolean;
  initialLookbackHours?: number;
  recurringLookbackHours: number;
}) {
  return hasCompletedSemanticRun ? recurringLookbackHours : initialLookbackHours;
}

export function resolveManualCampaignSemanticState({
  hasSemanticQueries,
  isActive,
  completedRun,
  liveRun,
  failedRun,
}: {
  hasSemanticQueries: boolean;
  isActive: boolean;
  completedRun?: SemanticRunSummary | null;
  liveRun?: SemanticRunSummary | null;
  failedRun?: SemanticRunSummary | null;
}): ManualCampaignSemanticState {
  if (completedRun) {
    return buildRunState(completedRun, "COMPLETED", false, "The first semantic lead search is complete.");
  }

  if (liveRun) {
    const status = liveRun.status === "PROCESSING" ? "PROCESSING" : "QUEUED";
    return buildRunState(
      liveRun,
      status,
      false,
      status === "PROCESSING" ? "Filtering and classifying leads now." : "The lead search is queued.",
    );
  }

  if (!isActive) {
    return {
      canRun: false,
      message: "Activate this campaign before running its first lead search.",
      runId: null,
      status: "UNAVAILABLE",
      stats: null,
    };
  }

  if (!hasSemanticQueries) {
    return {
      canRun: false,
      message: "Add at least one semantic query before running the first lead search.",
      runId: null,
      status: "UNAVAILABLE",
      stats: null,
    };
  }

  if (failedRun) {
    return buildRunState(failedRun, "FAILED", true, failedRun.message || "The previous lead search failed. You can retry it.");
  }

  return {
    canRun: true,
    message: "Search the last 36 hours of already-polled Reddit posts now.",
    runId: null,
    status: "READY",
    stats: null,
  };
}

export async function getManualCampaignSemanticState({
  campaignId,
  userId,
}: {
  campaignId: string;
  userId: string;
}): Promise<ManualCampaignSemanticState> {
  const { prisma } = await import("@/lib/prisma");
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      userId,
    },
    select: {
      isActive: true,
      _count: {
        select: {
          semanticQueries: true,
        },
      },
      runs: {
        where: {
          trigger: {
            in: [...CAMPAIGN_SEMANTIC_RUN_TRIGGERS],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          message: true,
          status: true,
          statsJson: true,
        },
      },
    },
  });

  if (!campaign) {
    return {
      canRun: false,
      message: "Campaign not found.",
      runId: null,
      status: "UNAVAILABLE",
      stats: null,
    };
  }

  return resolveManualCampaignSemanticState({
    completedRun: campaign.runs.find((run) => run.status === "COMPLETED"),
    failedRun: campaign.runs.find((run) => run.status === "FAILED"),
    hasSemanticQueries: campaign._count.semanticQueries > 0,
    isActive: campaign.isActive,
    liveRun: campaign.runs.find((run) => run.status === "QUEUED" || run.status === "PROCESSING"),
  });
}

function buildRunState(
  run: SemanticRunSummary,
  status: ManualCampaignSemanticState["status"],
  canRun: boolean,
  fallbackMessage: string,
): ManualCampaignSemanticState {
  return {
    canRun,
    message: run.message || fallbackMessage,
    runId: run.id,
    status,
    stats: readRunStats(run.statsJson),
  };
}

function readRunStats(value: unknown): ManualCampaignSemanticState["stats"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const stats = value as Record<string, unknown>;
  const result: NonNullable<ManualCampaignSemanticState["stats"]> = {};

  for (const key of ["classifiedLeads", "matchedPosts", "pendingClassifications", "scannedPosts", "strongLeads"] as const) {
    if (typeof stats[key] === "number") {
      result[key] = stats[key];
    }
  }

  return result;
}
