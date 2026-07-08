"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { enqueueSemanticPlaygroundRun } from "@/worker/queues";

const DEFAULT_THRESHOLD = 0.5;
const MAX_QUERY_COUNT = 100;
const MAX_QUERY_LENGTH = 700;

const playgroundQuerySchema = z.object({
  category: z.string().trim().max(80).optional().nullable(),
  text: z.string().trim().min(3).max(MAX_QUERY_LENGTH),
});

export type StartSemanticPlaygroundRunResult = {
  status: "success" | "error";
  message: string;
  runId?: string;
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
  const parsedQueries = parseQueries(formData.get("queriesJson"));

  if (!campaignId) {
    return {
      status: "error",
      message: "Select a campaign before starting a playground run.",
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

  const run = await prisma.campaignSemanticPlaygroundRun.create({
    data: {
      campaignId: campaign.id,
      fetchedFrom,
      fetchedTo,
      querySnapshot: {
        campaignName: campaign.name,
        queries: parsedQueries,
      } as Prisma.InputJsonValue,
      queries: {
        create: parsedQueries.map((query) => ({
          category: query.category || null,
          queryText: query.text,
        })),
      },
      statsJson: {
        totalQueries: parsedQueries.length,
      } as Prisma.InputJsonValue,
      status: "QUEUED",
      threshold,
      userId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  try {
    await enqueueSemanticPlaygroundRun({
      runId: run.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The playground job could not be added to the queue.";

    await prisma.campaignSemanticPlaygroundRun.update({
      where: {
        id: run.id,
      },
      data: {
        error: message,
        failedAt: new Date(),
        status: "FAILED",
      },
    });

    return {
      status: "error",
      message: `Playground run was saved but queueing failed: ${message}`,
      runId: run.id,
    };
  }

  revalidatePath("/admin/analytics");
  revalidatePath("/admin/analytics/playground");

  return {
    status: "success",
    message: `Playground run queued for ${campaign.name}.`,
    runId: run.id,
  };
}

function normalizeThreshold(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(parsed)) {
    return DEFAULT_THRESHOLD;
  }

  return Math.min(1, Math.max(0, parsed));
}

function parseQueries(value: FormDataEntryValue | null) {
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

  return result.data.filter((query) => {
    const key = query.text.trim().toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
