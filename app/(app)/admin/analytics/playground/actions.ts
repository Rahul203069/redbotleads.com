"use server";

import { Prisma, type LeadLabel } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { enqueueSemanticPlaygroundRun } from "@/worker/queues";

const DEFAULT_THRESHOLD = 0.5;
const MAX_QUERY_COUNT = 100;
const MAX_QUERY_LENGTH = 700;
const MAX_RUN_DESCRIPTION_LENGTH = 1000;
const MAX_RUN_TITLE_LENGTH = 120;
const DAILY_SEMANTIC_CRON_UTC_HOUR = 2;
const DAILY_SEMANTIC_CRON_UTC_MINUTE = 30;

const playgroundRunMetadataSchema = z.object({
  description: z.string().trim().min(3, "Add a playground run description.").max(MAX_RUN_DESCRIPTION_LENGTH, `Description must be ${MAX_RUN_DESCRIPTION_LENGTH} characters or less.`),
  title: z.string().trim().min(2, "Add a playground run title.").max(MAX_RUN_TITLE_LENGTH, `Title must be ${MAX_RUN_TITLE_LENGTH} characters or less.`),
});

const playgroundQuerySchema = z.object({
  category: z.string().trim().max(80).optional().nullable(),
  text: z.string().trim().min(3).max(MAX_QUERY_LENGTH),
});

type PlaygroundRunMetadata = z.infer<typeof playgroundRunMetadataSchema>;

type ParsedPlaygroundQuery = {
  category: string | null;
  text: string;
};

export type StartSemanticPlaygroundRunResult = {
  status: "success" | "error";
  message: string;
  runId?: string;
};

export type AddPlaygroundResultToLeadResult = {
  status: "success" | "error";
  message: string;
  leadId?: string;
  created?: boolean;
};

export async function startSemanticPlaygroundRun(formData: FormData): Promise<StartSemanticPlaygroundRunResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to run the semantic playground.",
    };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const fetchedFrom = new Date(String(formData.get("fetchedFrom") ?? ""));
  const fetchedTo = new Date(String(formData.get("fetchedTo") ?? ""));
  const threshold = normalizeThreshold(formData.get("threshold"));
  const runMetadata = parseRunMetadata(formData);
  const parsedQueries = parseQueries(formData.get("queriesJson"));

  if (!campaignId) {
    return {
      status: "error",
      message: "Select a campaign before starting a playground run.",
    };
  }

  if (runMetadata.status === "error") {
    return {
      status: "error",
      message: runMetadata.message,
    };
  }

  if (Number.isNaN(fetchedFrom.getTime()) || Number.isNaN(fetchedTo.getTime()) || fetchedFrom >= fetchedTo) {
    return {
      status: "error",
      message: "Choose a valid fetched-time range.",
    };
  }

  if (parsedQueries.length === 0) {
    return {
      status: "error",
      message: "Add at least one semantic query.",
    };
  }

  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      id: true,
      name: true,
      subreddits: true,
    },
  });

  if (!campaign) {
    return {
      status: "error",
      message: "Campaign was not found.",
    };
  }

  if (campaign.subreddits.length === 0) {
    return {
      status: "error",
      message: "This campaign does not track any subreddits.",
    };
  }

  const runRequest = await prisma.$transaction(async (tx) => {
    const configSignature = buildPlaygroundRunSignature({
      campaignId: campaign.id,
      fetchedFrom,
      fetchedTo,
      metadata: runMetadata.metadata,
      queries: parsedQueries,
      threshold,
      userId: session.user.id,
    });

    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${configSignature})::bigint)`,
    );

    const activeRuns = await tx.campaignSemanticPlaygroundRun.findMany({
      where: {
        campaignId: campaign.id,
        fetchedFrom,
        fetchedTo,
        status: {
          in: ["QUEUED", "PROCESSING"],
        },
        threshold,
        title: runMetadata.metadata.title,
        userId: session.user.id,
        description: runMetadata.metadata.description,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        description: true,
        title: true,
        queries: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            category: true,
            queryText: true,
          },
        },
      },
    });
    const duplicateRun = activeRuns.find((run) => querySetsMatch(run.queries, parsedQueries));

    if (duplicateRun) {
      return {
        id: duplicateRun.id,
        reusedExistingRun: true,
      };
    }

    const run = await tx.campaignSemanticPlaygroundRun.create({
      data: {
        campaignId: campaign.id,
        description: runMetadata.metadata.description,
        fetchedFrom,
        fetchedTo,
        querySnapshot: {
          campaignName: campaign.name,
          description: runMetadata.metadata.description,
          queries: parsedQueries,
          title: runMetadata.metadata.title,
        } as Prisma.InputJsonValue,
        queries: {
          create: parsedQueries.map((query) => ({
            category: query.category,
            queryText: query.text,
          })),
        },
        statsJson: {
          totalQueries: parsedQueries.length,
        } as Prisma.InputJsonValue,
        status: "QUEUED",
        threshold,
        title: runMetadata.metadata.title,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    return {
      id: run.id,
      reusedExistingRun: false,
    };
  });

  if (runRequest.reusedExistingRun) {
    revalidatePath("/admin/analytics");
    revalidatePath("/admin/analytics/playground");

    return {
      status: "success",
      message: "A matching playground run is already queued or processing.",
      runId: runRequest.id,
    };
  }

  try {
    await enqueueSemanticPlaygroundRun({
      runId: runRequest.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The playground job could not be added to the queue.";

    await prisma.campaignSemanticPlaygroundRun.update({
      where: {
        id: runRequest.id,
      },
      data: {
        error: message,
        failedAt: new Date(),
        status: "FAILED",
      },
    });

    revalidatePath("/admin/analytics");
    revalidatePath("/admin/analytics/playground");

    return {
      status: "error",
      message: `Playground run was saved but queueing failed: ${message}`,
      runId: runRequest.id,
    };
  }

  revalidatePath("/admin/analytics");
  revalidatePath("/admin/analytics/playground");

  return {
    status: "success",
    message: `Playground run queued for ${campaign.name}.`,
    runId: runRequest.id,
  };
}

export async function addPlaygroundResultToCampaignLead(formData: FormData): Promise<AddPlaygroundResultToLeadResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to add playground results to leads.",
    };
  }

  const resultId = String(formData.get("resultId") ?? "").trim();
  const syncAtValue = String(formData.get("syncAt") ?? "").trim();

  if (!resultId) {
    return {
      status: "error",
      message: "Choose a playground result before adding it to leads.",
    };
  }

  const playgroundResult = await prisma.campaignSemanticPlaygroundResult.findUnique({
    where: {
      id: resultId,
    },
    select: {
      bestQueryId: true,
      bestQueryText: true,
      bestScore: true,
      buyerStage: true,
      category: true,
      classificationStatus: true,
      disqualifier: true,
      intentType: true,
      label: true,
      model: true,
      painPoints: true,
      promptVersion: true,
      redditItemId: true,
      redditItem: {
        select: {
          fetchedAt: true,
        },
      },
      score: true,
      summary: true,
      run: {
        select: {
          campaign: {
            select: {
              id: true,
              name: true,
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!playgroundResult) {
    return {
      status: "error",
      message: "Playground result was not found.",
    };
  }

  if (playgroundResult.classificationStatus !== "CLASSIFIED" || playgroundResult.score === null) {
    return {
      status: "error",
      message: "Only classified playground results with an LLM score can be added to leads.",
    };
  }

  const campaign = playgroundResult.run.campaign;
  const score = playgroundResult.score;
  const label = playgroundResult.label ?? labelFromScore(score);
  const inferredSyncAt = getNextDailySemanticSyncBoundary(playgroundResult.redditItem.fetchedAt);
  const overrideSyncAt = syncAtValue ? new Date(syncAtValue) : null;

  if (overrideSyncAt && Number.isNaN(overrideSyncAt.getTime())) {
    return {
      status: "error",
      message: "Choose a valid sync timestamp.",
    };
  }

  const syncAt = overrideSyncAt ?? inferredSyncAt;

  const promotedLead = await prisma.$transaction(async (tx) => {
    const existingLead = await tx.lead.findUnique({
      where: {
        userId_redditItemId_campaignId: {
          campaignId: campaign.id,
          redditItemId: playgroundResult.redditItemId,
          userId: campaign.userId,
        },
      },
      select: {
        id: true,
      },
    });

    const lead = existingLead
      ? await tx.lead.update({
          where: {
            id: existingLead.id,
          },
          data: {
            createdAt: syncAt,
            label,
            score,
            updatedAt: syncAt,
          },
          select: {
            id: true,
          },
        })
      : await tx.lead.create({
          data: {
            campaignId: campaign.id,
            createdAt: syncAt,
            label,
            redditItemId: playgroundResult.redditItemId,
            score,
            updatedAt: syncAt,
            userId: campaign.userId,
          },
          select: {
            id: true,
          },
        });

    await tx.leadAI.upsert({
      where: {
        leadId: lead.id,
      },
      update: {
        buyerStage: playgroundResult.buyerStage,
        category: playgroundResult.category,
        disqualifier: playgroundResult.disqualifier,
        intentType: playgroundResult.intentType,
        model: playgroundResult.model,
        painPoints: playgroundResult.painPoints,
        promptVersion: playgroundResult.promptVersion,
        summary: playgroundResult.summary,
      },
      create: {
        buyerStage: playgroundResult.buyerStage,
        category: playgroundResult.category,
        disqualifier: playgroundResult.disqualifier,
        intentType: playgroundResult.intentType,
        leadId: lead.id,
        model: playgroundResult.model,
        painPoints: playgroundResult.painPoints,
        promptVersion: playgroundResult.promptVersion,
        summary: playgroundResult.summary,
      },
    });

    await tx.campaignDailySemanticScan.upsert({
      where: {
        campaignId_redditItemId: {
          campaignId: campaign.id,
          redditItemId: playgroundResult.redditItemId,
        },
      },
      update: {
        bestQueryId: playgroundResult.bestQueryId,
        bestQueryText: playgroundResult.bestQueryText,
        bestScore: playgroundResult.bestScore,
        createdAt: syncAt,
        status: "MATCHED",
        updatedAt: syncAt,
      },
      create: {
        bestQueryId: playgroundResult.bestQueryId,
        bestQueryText: playgroundResult.bestQueryText,
        bestScore: playgroundResult.bestScore,
        campaignId: campaign.id,
        createdAt: syncAt,
        redditItemId: playgroundResult.redditItemId,
        status: "MATCHED",
        updatedAt: syncAt,
      },
    });

    return {
      id: lead.id,
      created: !existingLead,
    };
  });

  revalidatePath("/admin/analytics");
  revalidatePath("/admin/analytics/daily-leads");
  revalidatePath("/admin/analytics/playground");
  revalidatePath(`/campaigns/${campaign.id}`);
  revalidatePath(`/campaigns/${campaign.id}/daily-leads`);

  return {
    status: "success",
    message: promotedLead.created
      ? `Added this playground result to ${campaign.name} leads.`
      : `Updated the existing ${campaign.name} lead with this playground result.`,
    leadId: promotedLead.id,
    created: promotedLead.created,
  };
}

function normalizeThreshold(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(parsed)) {
    return DEFAULT_THRESHOLD;
  }

  return Math.min(1, Math.max(0, parsed));
}

function parseRunMetadata(formData: FormData): { status: "success"; metadata: PlaygroundRunMetadata } | { status: "error"; message: string } {
  const parsed = playgroundRunMetadataSchema.safeParse({
    description: String(formData.get("description") ?? ""),
    title: String(formData.get("title") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Add a playground run title and description.",
    };
  }

  return {
    status: "success",
    metadata: parsed.data,
  };
}

function parseQueries(value: FormDataEntryValue | null): ParsedPlaygroundQuery[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  const result = z.array(playgroundQuerySchema).max(MAX_QUERY_COUNT).safeParse(parsed);

  if (!result.success) {
    return [];
  }

  const seen = new Set<string>();

  return result.data
    .map((query) => ({
      category: normalizeQueryCategory(query.category),
      text: query.text.trim(),
    }))
    .filter((query) => {
      const key = query.text.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function buildPlaygroundRunSignature({
  campaignId,
  fetchedFrom,
  fetchedTo,
  metadata,
  queries,
  threshold,
  userId,
}: {
  campaignId: string;
  fetchedFrom: Date;
  fetchedTo: Date;
  metadata: PlaygroundRunMetadata;
  queries: ParsedPlaygroundQuery[];
  threshold: number;
  userId: string;
}) {
  return JSON.stringify({
    campaignId,
    fetchedFrom: fetchedFrom.toISOString(),
    fetchedTo: fetchedTo.toISOString(),
    description: metadata.description,
    queries,
    threshold,
    title: metadata.title,
    userId,
  });
}

function querySetsMatch(
  storedQueries: Array<{ category: string | null; queryText: string }>,
  inputQueries: ParsedPlaygroundQuery[],
) {
  if (storedQueries.length !== inputQueries.length) {
    return false;
  }

  return storedQueries.every((query, index) => {
    const inputQuery = inputQueries[index];

    return (
      normalizeQueryCategory(query.category) === inputQuery.category
      && query.queryText.trim() === inputQuery.text
    );
  });
}

function normalizeQueryCategory(value: string | null | undefined) {
  const category = value?.trim() ?? "";
  return category.length > 0 ? category : null;
}

function labelFromScore(score: number): LeadLabel {
  if (score >= 75) {
    return "HIGH";
  }

  if (score >= 50) {
    return "MED";
  }

  return "LOW";
}

function getNextDailySemanticSyncBoundary(source: Date) {
  const boundary = new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth(),
    source.getUTCDate(),
    DAILY_SEMANTIC_CRON_UTC_HOUR,
    DAILY_SEMANTIC_CRON_UTC_MINUTE,
    0,
    0,
  ));

  if (boundary.getTime() <= source.getTime()) {
    boundary.setUTCDate(boundary.getUTCDate() + 1);
  }

  return boundary;
}
