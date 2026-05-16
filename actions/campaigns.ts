"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";

import { auth } from "@/lib/auth";
import { getCampaignLeadViewsForUser } from "@/lib/campaign-leads";
import { generateEmbeddings, generateStructuredOutput } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { enqueueInitialIngest, getInitialIngestQueueFailureMessage } from "@/worker/queues";
import { reconcileCampaignSyncState } from "@/worker/sync-reconcile";

const keywordPhrase = z
  .string()
  .trim()
  .min(1)
  .refine((value) => value.split(/\s+/).filter(Boolean).length <= 4, "Keyword phrases must be 1 to 4 words.");

const createCampaignSchema = z.object({
  name: z.string().trim().min(2, "Campaign name must be at least 2 characters."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  description: z.string().trim().optional(),
  keywords: z.array(keywordPhrase),
  negativeKeywords: z.array(z.string()),
  subreddits: z.array(z.string()).min(1, "Add at least one subreddit."),
  recentDays: z.coerce.number().int().min(1, "Recent window must be at least 1 day.").max(10, "Recent window must be 10 days or less."),
  minScoreToAlert: z.coerce.number().int().min(1, "Min score must be at least 1.").max(100, "Min score must be 100 or less."),
  isActive: z.boolean(),
});

export type CampaignActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "description" | "keywords" | "subreddits" | "recentDays" | "minScoreToAlert", string>>;
};

const semanticQuerySchema = z.object({
  text: z.string().trim().min(1).max(300),
  category: z.string().trim().min(1).max(120),
});

export async function createCampaign(
  _prevState: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  return submitCampaign(formData);
}

export async function submitCampaign(formData: FormData): Promise<CampaignActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to create a campaign.",
    };
  }

  const parsedInput = parseCampaignFormData(formData);

  const parsed = createCampaignSchema.safeParse(parsedInput);

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const firstFieldError =
      flattened.name?.[0] ??
      flattened.description?.[0] ??
      flattened.keywords?.[0] ??
      flattened.subreddits?.[0] ??
      flattened.recentDays?.[0] ??
      flattened.minScoreToAlert?.[0] ??
      parsed.error.flatten().formErrors[0] ??
      "Review the campaign fields and try again.";

    return {
      status: "error",
      message: firstFieldError,
      fieldErrors: {
        name: flattened.name?.[0],
        description: flattened.description?.[0],
        keywords: flattened.keywords?.[0],
        subreddits: flattened.subreddits?.[0],
        recentDays: flattened.recentDays?.[0],
        minScoreToAlert: flattened.minScoreToAlert?.[0],
      },
    };
  }

  let campaignId = "";
  let shouldQueueInitialIngest = false;

  try {
    const campaign = await prisma.campaign.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        leadType: parsed.data.leadType,
        description: parsed.data.description || null,
        keywords: parsed.data.keywords,
        negativeKeywords: parsed.data.negativeKeywords,
        subreddits: parsed.data.subreddits,
        recentDays: parsed.data.recentDays,
        minScoreToAlert: parsed.data.minScoreToAlert,
        isActive: parsed.data.isActive,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    campaignId = campaign.id;
    shouldQueueInitialIngest = campaign.isActive;

    if (parsed.data.description) {
      const semanticQueries = await generateCampaignSemanticQueries(parsed.data.description, parsed.data.leadType);
      await persistCampaignSemanticQueries(campaign.id, semanticQueries);
    }
  } catch (error) {
    console.error("Campaign create failed", error);

    if (campaignId) {
      try {
        await prisma.campaign.delete({
          where: {
            id: campaignId,
          },
        });
      } catch (rollbackError) {
        console.error("Campaign rollback failed after semantic setup failure", rollbackError);
      }
    }

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Save failed while creating the campaign.",
    };
  }

  if (shouldQueueInitialIngest) {
    try {
      await enqueueInitialIngest({
        campaignId,
        trigger: "campaign_created",
      });
    } catch (error) {
      console.error("Campaign queue failed", error);

      revalidatePath("/campaigns");
      revalidatePath(`/campaigns/${campaignId}`);

      return {
        status: "success",
        message:
          error instanceof Error
            ? `Campaign created, but initial sync could not be queued: ${getInitialIngestQueueFailureMessage(error)}`
            : "Campaign created, but initial sync could not be queued.",
      };
    }
  }

  revalidatePath("/campaigns");

  return {
    status: "success",
    message: shouldQueueInitialIngest ? "Campaign created and queued for initial sync." : "Campaign created.",
  };
}

async function generateCampaignSemanticQueries(
  productDescription: string,
  leadType: "PRODUCT" | "SERVICE",
) {
  const queryCount = leadType === "PRODUCT" ? 30 : 16;
  const prompt = leadType === "PRODUCT"
    ? buildProductSemanticQueryPrompt(productDescription)
    : buildServiceSemanticQueryPrompt(productDescription);

  const response = await generateStructuredOutput({
    model: "gpt-4o-mini",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["queries"],
      properties: {
        queries: {
          type: "array",
          minItems: queryCount,
          maxItems: queryCount,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "category"],
            properties: {
              text: { type: "string" },
              category: { type: "string" },
            },
          },
        },
      },
    },
    schemaName: "campaign_semantic_queries",
    systemPrompt: prompt.systemPrompt,
    temperature: 0.7,
    userPrompt: prompt.userPrompt,
  });

  const parsed = z.object({ queries: z.array(semanticQuerySchema).length(queryCount) }).parse(JSON.parse(response.content));
  return parsed.queries;
}

function buildServiceSemanticQueryPrompt(productDescription: string) {
  return {
    systemPrompt: [
      "Generate high-intent semantic search queries for service-led lead discovery.",
      "",
      "Your goal is to find Reddit posts and comments from people who may hire outside help, outsource work, request implementation support, or need a service provider.",
      "",
      "Return only JSON matching the schema.",
    ].join("\n"),
    userPrompt: [
      "Generate 16 semantic search queries representing high-intent service-buying signals in online communities such as Reddit.",
      "",
      "The goal is to detect users who are likely to:",
      "- buy a service",
      "- hire help",
      "- outsource work",
      "- ask for expert support",
      "- need someone to set up or implement something",
      "- describe a painful workflow that could lead to hiring outside help",
      "",
      "The queries must represent REAL COMMERCIAL INTENT for a service business.",
      "",
      "Include situations where a user:",
      "- is asking for help with a problem",
      "- is looking for an agency, freelancer, consultant, or expert",
      "- is considering outsourcing a task or workflow",
      "- is frustrated with a manual or broken process",
      "- is asking how to solve something they do not want to handle themselves",
      "- is asking for recommendations for service providers",
      "- is struggling with setup, integrations, reporting, follow-ups, or operations",
      "- feels overwhelmed by repetitive work",
      "",
      "Do NOT generate queries where the user is:",
      "- sharing what they built",
      "- explaining their workflow",
      "- teaching others",
      "- promoting a service",
      "- writing a case study",
      "- discussing tools in general without needing help",
      "- talking about a solved problem",
      "- looking for a full-time employee",
      "- looking for a job",
      "",
      "Queries should sound like natural Reddit posts or comments.",
      "",
      "Prefer language like:",
      "- need help with",
      "- looking for someone to",
      "- should I hire someone for",
      "- anyone recommend an agency for",
      "- who can help with",
      "- worth outsourcing",
      "- need someone to set this up",
      "- our process is a mess",
      "- this is taking too much manual work",
      "- how do I automate this",
      "- tired of doing this manually",
      "",
      "Return JSON with:",
      "{",
      '  "queries": [',
      '    {',
      '      "text": "",',
      '      "category": "",',
      "    }",
      "  ]",
      "}",
      "",
      "Use only these category labels:",
      "- help_request",
      "- outsourcing_intent",
      "- provider_search",
      "- implementation_need",
      "- workflow_pain",
      "- manual_process",
      "- broken_system",
      "- recommendation_request",
      "",
      "Service description:",
      '"""',
      productDescription,
      '"""',
    ].join("\n"),
  };
}

function buildProductSemanticQueryPrompt(productDescription: string) {
  return {
    systemPrompt: [
      "Generate high-intent semantic search queries for product-led lead discovery.",
      "",
      "Return only JSON matching the schema.",
    ].join("\n"),
    userPrompt: [
      "Generate 30 semantic search queries representing",
      "high-intent product discovery signals in online",
      "communities such as Reddit.",
      "",
      "The goal is to detect users who are actively",
      "looking for a solution or struggling with an",
      "existing workflow.",
      "",
      "The queries must represent REAL BUYING INTENT.",
      "",
      "Include only situations where a user:",
      "- is asking for a tool",
      "- is looking for recommendations",
      "- is frustrated with their current solution",
      "- is considering switching tools",
      "- is struggling with a manual process",
      "",
      "Do NOT generate queries where the user is:",
      "- sharing a tool they built",
      "- explaining their workflow",
      "- discussing tools in general",
      "- promoting products",
      "- writing case studies",
      "",
      "Queries should resemble natural Reddit posts",
      "or comments.",
      "",
      "Examples of correct style:",
      "",
      '"looking for a better way to track leads"',
      '"any good CRM for small teams"',
      '"what tool do you use for managing prospects"',
      '"our lead tracking process is a mess"',
      '"alternatives to hubspot for startups"',
      "",
      "Return 30 queries.",
      "",
      "Return JSON with:",
      "{",
      '  "queries": [',
      "    {",
      '      "text": "",',
      '      "category": ""',
      "    }",
      "  ]",
      "}",
      "",
      "Product description:",
      '"""',
      productDescription,
      '"""',
    ].join("\n"),
  };
}

async function persistCampaignSemanticQueries(
  campaignId: string,
  queries: Array<{
    text: string;
    category: string;
  }>,
) {
  const normalizedQueries = dedupeSemanticQueries(queries);

  if (normalizedQueries.length === 0) {
    return;
  }

  const embeddingResult = await generateEmbeddings({
    input: normalizedQueries.map((query) => query.text),
    model: "text-embedding-3-small",
    dimensions: 1536,
  });

  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM "CampaignSemanticQuery" WHERE "campaignId" = ${campaignId}`,
  );

  const rows = normalizedQueries.map((query, index) => {
    const vectorLiteral = `[${embeddingResult.embeddings[index].join(",")}]`;

    return Prisma.sql`(
      ${crypto.randomUUID()},
      ${campaignId},
      ${query.text},
      ${query.category},
      ${embeddingResult.dimensions},
      CAST(${vectorLiteral} AS vector),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )`;
  });

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "CampaignSemanticQuery" (
        "id",
        "campaignId",
        "queryText",
        "category",
        "dimensions",
        "embedding",
        "createdAt",
        "updatedAt"
      )
      VALUES ${Prisma.join(rows)}
    `,
  );
}

function dedupeSemanticQueries(
  queries: Array<{
    text: string;
    category: string;
  }>,
) {
  const seen = new Set<string>();

  return queries.filter((query) => {
    const normalizedText = query.text.trim().toLowerCase();

    if (!normalizedText || seen.has(normalizedText)) {
      return false;
    }

    seen.add(normalizedText);
    return true;
  });
}

export async function updateCampaign(formData: FormData): Promise<CampaignActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to update a campaign.",
    };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!campaignId) {
    return {
      status: "error",
      message: "Campaign ID is missing.",
    };
  }

  const parsedInput = parseCampaignFormData(formData);
  const parsed = createCampaignSchema.safeParse(parsedInput);

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const firstFieldError =
      flattened.name?.[0] ??
      flattened.description?.[0] ??
      flattened.keywords?.[0] ??
      flattened.subreddits?.[0] ??
      flattened.recentDays?.[0] ??
      flattened.minScoreToAlert?.[0] ??
      parsed.error.flatten().formErrors[0] ??
      "Review the campaign fields and try again.";

    return {
      status: "error",
      message: firstFieldError,
      fieldErrors: {
        name: flattened.name?.[0],
        description: flattened.description?.[0],
        keywords: flattened.keywords?.[0],
        subreddits: flattened.subreddits?.[0],
        recentDays: flattened.recentDays?.[0],
        minScoreToAlert: flattened.minScoreToAlert?.[0],
      },
    };
  }

  try {
    const existing = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!existing) {
      return {
        status: "error",
        message: "Campaign not found.",
      };
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: parsed.data.name,
        leadType: parsed.data.leadType,
        description: parsed.data.description || null,
        keywords: parsed.data.keywords,
        negativeKeywords: parsed.data.negativeKeywords,
        subreddits: parsed.data.subreddits,
        recentDays: parsed.data.recentDays,
        minScoreToAlert: parsed.data.minScoreToAlert,
        isActive: parsed.data.isActive,
      },
    });
  } catch (error) {
    console.error("Campaign update failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Save failed while updating the campaign.",
    };
  }

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);

  return {
    status: "success",
    message: "Campaign updated.",
  };
}

export async function manualSyncCampaign(formData: FormData): Promise<CampaignActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to sync a campaign.",
    };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!campaignId) {
    return {
      status: "error",
      message: "Campaign ID is missing.",
    };
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      userId: session.user.id,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!campaign) {
    return {
      status: "error",
      message: "Campaign not found.",
    };
  }

  if (!campaign.isActive) {
    return {
      status: "error",
      message: "Activate the campaign before running a manual sync.",
    };
  }

  try {
    await enqueueInitialIngest({
      campaignId: campaign.id,
      trigger: "manual_resync",
    });
  } catch (error) {
    console.error("Manual campaign sync failed", error);

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaign.id}`);

    return {
      status: "error",
      message:
        error instanceof Error
          ? `Manual sync failed: ${getInitialIngestQueueFailureMessage(error)}`
          : "Manual sync failed.",
    };
  }

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}`);

  return {
    status: "success",
    message: "Campaign queued for manual sync.",
  };
}

export async function deleteCampaign(formData: FormData): Promise<CampaignActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to delete a campaign.",
    };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!campaignId) {
    return {
      status: "error",
      message: "Campaign ID is missing.",
    };
  }

  try {
    const existing = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return {
        status: "error",
        message: "Campaign not found.",
      };
    }

    await prisma.campaign.delete({
      where: {
        id: campaignId,
      },
    });
  } catch (error) {
    console.error("Campaign delete failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Delete failed: ${error.message}` : "Delete failed while removing the campaign.",
    };
  }

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);

  return {
    status: "success",
    message: "Campaign deleted.",
  };
}

export async function getCampaignSyncStatuses(campaignIds: string[]) {
  const session = await auth();

  if (!session?.user?.id || campaignIds.length === 0) {
    return [];
  }

  const accessibleCampaigns = await prisma.campaign.findMany({
    where: {
      userId: session.user.id,
      id: {
        in: campaignIds,
      },
    },
    select: {
      id: true,
    },
  });

  const campaigns = await Promise.all(
    accessibleCampaigns.map(async (campaign) => ({
      id: campaign.id,
      sync: await reconcileCampaignSyncState(campaign.id),
    })),
  );

  return campaigns.map((campaign) => ({
    campaignId: campaign.id,
    sync: campaign.sync
      ? {
          status: campaign.sync.status,
          stage: campaign.sync.stage,
          message: campaign.sync.message,
          lastError: campaign.sync.lastError,
          queuedAt: campaign.sync.queuedAt?.toISOString() ?? null,
          startedAt: campaign.sync.startedAt?.toISOString() ?? null,
          completedAt: campaign.sync.completedAt?.toISOString() ?? null,
          failedAt: campaign.sync.failedAt?.toISOString() ?? null,
          lastHeartbeat: campaign.sync.lastHeartbeat?.toISOString() ?? null,
          statsJson: campaign.sync.statsJson,
          updatedAt: campaign.sync.updatedAt.toISOString(),
        }
      : null,
  }));
}

export async function getCampaignLeads(campaignId: string) {
  const session = await auth();

  if (!session?.user?.id || !campaignId) {
    return [];
  }

  return getCampaignLeadViewsForUser({
    campaignId,
    userId: session.user.id,
  });
}

function parseList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseSubreddits(value: FormDataEntryValue | null) {
  return parseList(value).map((item) => item.replace(/^r\//, ""));
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseCampaignFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    leadType: formData.get("leadType"),
    description: normalizeOptionalString(formData.get("description")),
    keywords: parseList(formData.get("keywords")),
    negativeKeywords: parseList(formData.get("negativeKeywords")),
    subreddits: parseSubreddits(formData.get("subreddits")),
    recentDays: formData.get("recentDays"),
    minScoreToAlert: formData.get("minScoreToAlert"),
    isActive: formData.get("isActive") === "on",
  };
}
