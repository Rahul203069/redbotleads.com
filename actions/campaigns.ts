"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { BETA_OWNER_ONLY_MESSAGE, canViewAnalytics, isOwnerEmail } from "@/lib/beta-access";
import {
  buildDailySemanticRunStatsAfterLeadDeletion,
  getCampaignLeadDeletionRevalidationPaths,
} from "@/lib/campaign-lead-deletion";
import { persistCampaignSemanticQueries } from "@/lib/campaign-semantic-queries";
import {
  buildAccessibleCampaignWhere,
  canEditCampaignDescription,
  getCampaignAccessFromRecord,
} from "@/lib/campaign-access";
import { getCampaignLeadViewsForUser } from "@/lib/campaign-leads";
import {
  DEFAULT_CAMPAIGN_SEMANTIC_SEARCH_SCOPE,
  resolveSubmittedCampaignSemanticSearchScope,
  type CampaignSemanticSearchScope,
} from "@/lib/campaign-semantic-search-scope";
import { getDailyLeadDateSelection } from "@/lib/daily-leads-analytics";
import {
  getManualCampaignSemanticState,
  type ManualCampaignSemanticState,
} from "@/lib/manual-campaign-semantic";
import { generateStructuredOutput } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { parseSemanticQueriesJson, type CleanSemanticQuery } from "@/lib/semantic-queries";
import { reconcileCampaignSyncState } from "@/worker/sync-reconcile";
import { enqueueManualSemanticCampaign } from "@/worker/queues";

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

const campaignDescriptionSchema = z.object({
  campaignId: z.string().trim().min(1, "Campaign ID is missing."),
  description: z.string().trim().max(4000, "Description must be 4,000 characters or less.").optional(),
});

const deleteCampaignLeadSchema = z.object({
  campaignId: z.string().trim().min(1, "Campaign ID is missing."),
  leadId: z.string().trim().min(1, "Lead ID is missing."),
});

export type CampaignActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  campaignId?: string;
  deletedLeadId?: string;
  manualSemanticState?: ManualCampaignSemanticState;
  fieldErrors?: Partial<Record<"name" | "description" | "keywords" | "subreddits" | "recentDays" | "minScoreToAlert" | "semanticQueries" | "semanticSearchScope", string>>;
};

export type ManualCampaignSemanticActionResult = {
  status: "success" | "error";
  message: string;
  state: ManualCampaignSemanticState;
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

  if (!isOwnerEmail(session.user.email)) {
    return {
      status: "error",
      message: BETA_OWNER_ONLY_MESSAGE,
    };
  }

  const isAdminAccount = canViewAnalytics(session.user.email);

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

  let manualSemanticQueries: CleanSemanticQuery[] = [];
  let semanticSearchScope: CampaignSemanticSearchScope = DEFAULT_CAMPAIGN_SEMANTIC_SEARCH_SCOPE;

  if (isAdminAccount) {
    const submittedScope = resolveSubmittedCampaignSemanticSearchScope({
      defaultScope: DEFAULT_CAMPAIGN_SEMANTIC_SEARCH_SCOPE,
      isAdminAccount,
      value: formData.get("semanticSearchScope"),
    });

    if (submittedScope.status === "error" || !submittedScope.scope) {
      return {
        status: "error",
        message: "Choose a valid semantic search scope.",
        fieldErrors: {
          semanticSearchScope: "Choose Campaign subreddits or Global polling pool.",
        },
      };
    }

    semanticSearchScope = submittedScope.scope;

    const parsedSemanticQueries = parseSemanticQueriesJson(String(formData.get("semanticQueriesJson") ?? ""));

    if (parsedSemanticQueries.status === "error") {
      return {
        status: "error",
        message: parsedSemanticQueries.message,
        fieldErrors: {
          semanticQueries: parsedSemanticQueries.message,
        },
      };
    }

    manualSemanticQueries = parsedSemanticQueries.queries;
  }

  let campaignId = "";
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
        semanticSearchScope,
      },
      select: {
        id: true,
      },
    });

    campaignId = campaign.id;

    if (isAdminAccount) {
      await persistCampaignSemanticQueries({
        campaignId: campaign.id,
        mode: "append",
        queries: manualSemanticQueries,
        source: "admin_campaign_creation",
        userId: session.user.id,
      });
    } else if (parsed.data.description) {
      const semanticQueries = await generateCampaignSemanticQueries(parsed.data.description, parsed.data.leadType, {
        campaignId: campaign.id,
        userId: session.user.id,
      });
      await persistCampaignSemanticQueries({
        campaignId: campaign.id,
        mode: "append",
        queries: semanticQueries,
        source: "automatic_campaign_creation",
        userId: session.user.id,
      });
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

  revalidatePath("/campaigns");

  const manualSemanticState = await getManualCampaignSemanticState({
    campaignId,
    userId: session.user.id,
  });

  return {
    status: "success",
    campaignId,
    manualSemanticState,
    message: parsed.data.isActive
      ? "Campaign created. It will be processed after the next scheduled daily RSS and daily semantic run."
      : "Campaign created.",
  };
}

async function generateCampaignSemanticQueries(
  productDescription: string,
  leadType: "PRODUCT" | "SERVICE",
  usage: {
    campaignId: string;
    userId: string;
  },
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
    usage: {
      userId: usage.userId,
      campaignId: usage.campaignId,
      operation: "campaign_semantic_query_generation",
    },
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

export async function updateCampaign(formData: FormData): Promise<CampaignActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to update a campaign.",
    };
  }

  const isAdminAccount = canViewAnalytics(session.user.email);
  let semanticSearchScope: CampaignSemanticSearchScope | undefined;

  if (formData.has("semanticSearchScope")) {
    const submittedScope = resolveSubmittedCampaignSemanticSearchScope({
      isAdminAccount,
      value: formData.get("semanticSearchScope"),
    });

    if (submittedScope.status === "error") {
      return {
        status: "error",
        message: "Choose a valid semantic search scope.",
        fieldErrors: {
          semanticSearchScope: "Choose Campaign subreddits or Global polling pool.",
        },
      };
    }

    semanticSearchScope = submittedScope.scope;
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
        ...(semanticSearchScope ? { semanticSearchScope } : {}),
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

  return {
    status: "error",
    message: "Manual sync is disabled. Campaigns are processed by scheduled daily RSS and daily semantic runs.",
  };
}

export async function getCampaignManualSemanticStatus(campaignId: string): Promise<ManualCampaignSemanticState> {
  const session = await auth();

  if (!session?.user?.id || !isOwnerEmail(session.user.email)) {
    return unavailableManualSemanticState("You do not have permission to run this lead search.");
  }

  return getManualCampaignSemanticState({
    campaignId: String(campaignId ?? "").trim(),
    userId: session.user.id,
  });
}

export async function runNewCampaignSemanticOverride(campaignId: string): Promise<ManualCampaignSemanticActionResult> {
  const session = await auth();

  if (!session?.user?.id || !isOwnerEmail(session.user.email)) {
    const state = unavailableManualSemanticState("You do not have permission to run this lead search.");
    return {
      status: "error",
      message: state.message,
      state,
    };
  }

  const normalizedCampaignId = String(campaignId ?? "").trim();
  const currentState = await getManualCampaignSemanticState({
    campaignId: normalizedCampaignId,
    userId: session.user.id,
  });

  if (currentState.status === "QUEUED" || currentState.status === "PROCESSING") {
    return {
      status: "success",
      message: currentState.message,
      state: currentState,
    };
  }

  if (!currentState.canRun) {
    return {
      status: "error",
      message: currentState.message,
      state: currentState,
    };
  }

  try {
    await enqueueManualSemanticCampaign({
      campaignId: normalizedCampaignId,
      queuedAt: new Date().toISOString(),
    });

    const state = await getManualCampaignSemanticState({
      campaignId: normalizedCampaignId,
      userId: session.user.id,
    });

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${normalizedCampaignId}`);
    revalidatePath(`/campaigns/${normalizedCampaignId}/daily-leads`);
    revalidatePath("/admin/analytics/daily-leads");

    return {
      status: "success",
      message: "The first semantic lead search is queued.",
      state,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The first semantic lead search could not be queued.";
    const state = await getManualCampaignSemanticState({
      campaignId: normalizedCampaignId,
      userId: session.user.id,
    });

    return {
      status: "error",
      message,
      state,
    };
  }
}

function unavailableManualSemanticState(message: string): ManualCampaignSemanticState {
  return {
    canRun: false,
    message,
    runId: null,
    status: "UNAVAILABLE",
    stats: null,
  };
}

export async function updateCampaignDescription(formData: FormData): Promise<CampaignActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to update a campaign.",
    };
  }

  const parsed = campaignDescriptionSchema.safeParse({
    campaignId: formData.get("campaignId"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Review the campaign description and try again.";

    return {
      status: "error",
      message: firstError,
      fieldErrors: {
        description: firstError,
      },
    };
  }

  const campaign = await prisma.campaign.findFirst({
    where: buildAccessibleCampaignWhere({
      campaignId: parsed.data.campaignId,
      email: session.user.email,
      userId: session.user.id,
    }),
    select: {
      id: true,
      name: true,
      userId: true,
      clientAccesses: {
        where: {
          normalizedEmail: String(session.user.email ?? "").trim().toLowerCase(),
        },
        select: {
          displayName: true,
          normalizedEmail: true,
        },
      },
    },
  });

  const access = campaign
    ? getCampaignAccessFromRecord({
        campaign,
        email: session.user.email,
        userId: session.user.id,
      })
    : null;

  if (!campaign || !canEditCampaignDescription(access)) {
    return {
      status: "error",
      message: "Campaign not found.",
    };
  }

  try {
    await prisma.campaign.update({
      where: {
        id: campaign.id,
      },
      data: {
        description: parsed.data.description || null,
      },
    });
  } catch (error) {
    console.error("Campaign description update failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Save failed while updating the campaign description.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}`);
  revalidatePath(`/campaigns/${campaign.id}/analytics`);
  revalidatePath(`/campaigns/${campaign.id}/daily-leads`);

  return {
    status: "success",
    message: "Campaign description updated.",
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
      ...buildAccessibleCampaignWhere({
        email: session.user.email,
        userId: session.user.id,
      }),
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

export async function getCampaignLeads(
  campaignId: string,
  dateFilter?: {
    date?: string | string[];
    from?: string;
    range?: string;
    to?: string;
  },
) {
  const session = await auth();

  if (!session?.user?.id || !campaignId) {
    return [];
  }

  const selection = dateFilter ? getDailyLeadDateSelection(dateFilter) : getDailyLeadDateSelection({ range: "all" });

  return getCampaignLeadViewsForUser({
    campaignId,
    ...(selection.source === "dates"
      ? {
          dateRanges: selection.ranges,
        }
      : {
          from: selection.range.from,
          to: selection.range.to,
        }),
    userId: session.user.id,
    email: session.user.email,
  });
}

export async function deleteCampaignLead(formData: FormData): Promise<CampaignActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to delete a lead.",
    };
  }

  if (!canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to delete campaign leads.",
    };
  }

  const parsed = deleteCampaignLeadSchema.safeParse({
    campaignId: formData.get("campaignId"),
    leadId: formData.get("leadId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Campaign and lead IDs are required.",
    };
  }

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: {
          id: parsed.data.leadId,
          campaignId: parsed.data.campaignId,
        },
        select: {
          id: true,
          redditItemId: true,
        },
      });

      if (!lead) {
        return null;
      }

      const scan = await tx.campaignDailySemanticScan.findUnique({
        where: {
          campaignId_redditItemId: {
            campaignId: parsed.data.campaignId,
            redditItemId: lead.redditItemId,
          },
        },
        select: {
          campaignRunId: true,
        },
      });

      await tx.lead.delete({
        where: {
          id: lead.id,
        },
      });
      await tx.campaignDailySemanticScan.deleteMany({
        where: {
          campaignId: parsed.data.campaignId,
          redditItemId: lead.redditItemId,
        },
      });

      if (scan?.campaignRunId) {
        const run = await tx.campaignRun.findUnique({
          where: {
            id: scan.campaignRunId,
          },
          select: {
            campaignId: true,
            statsJson: true,
          },
        });

        if (run) {
          const [matchedScans, noMatchScans, leads] = await Promise.all([
            tx.campaignDailySemanticScan.count({
              where: {
                campaignRunId: scan.campaignRunId,
                status: "MATCHED",
              },
            }),
            tx.campaignDailySemanticScan.count({
              where: {
                campaignRunId: scan.campaignRunId,
                status: "NO_MATCH",
              },
            }),
            tx.lead.findMany({
              where: {
                campaignId: run.campaignId,
                redditItem: {
                  dailySemanticScans: {
                    some: {
                      campaignRunId: scan.campaignRunId,
                      status: "MATCHED",
                    },
                  },
                },
              },
              select: {
                score: true,
                ai: {
                  select: {
                    id: true,
                  },
                },
              },
            }),
          ]);
          const statsJson = buildDailySemanticRunStatsAfterLeadDeletion({
            existingStats: run.statsJson,
            leads,
            matchedScans,
            noMatchScans,
          });

          await tx.campaignRun.update({
            where: {
              id: scan.campaignRunId,
            },
            data: {
              statsJson: statsJson as Prisma.InputJsonValue,
            },
          });
        }
      }

      return lead;
    });

    if (!deleted) {
      return {
        status: "error",
        message: "Lead not found in this campaign.",
      };
    }
  } catch (error) {
    console.error("Campaign lead delete failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Delete failed: ${error.message}` : "Delete failed while removing the lead.",
    };
  }

  for (const path of getCampaignLeadDeletionRevalidationPaths(parsed.data.campaignId)) {
    revalidatePath(path);
  }

  return {
    status: "success",
    message: "Lead deleted from the campaign and its shared links.",
    deletedLeadId: parsed.data.leadId,
  };
}

export type CampaignInitialRssDiagnostics = {
  run: {
    id: string;
    status: string;
    message: string | null;
    error: string | null;
    queuedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    updatedAt: string;
  };
  events: Array<{
    id: string;
    subreddit: string;
    sequence: number;
    attempt: number;
    status: string;
    requestedAt: string;
    fetchStartedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    waitMs: number | null;
    nextRequestDelayMs: number | null;
    nextRequestAt: string | null;
    httpStatus: number | null;
    statusText: string | null;
    errorMessage: string | null;
    ratelimitUsed: string | null;
    ratelimitRemaining: string | null;
    ratelimitReset: string | null;
    retryAfter: string | null;
    retryAfterMs: number | null;
    retryWaitMs: number | null;
    retryUntil: string | null;
    fetchedPosts: number | null;
    matchedItems: number | null;
    createdLeads: number | null;
  }>;
} | null;

export async function getCampaignInitialRssDiagnostics(campaignId: string): Promise<CampaignInitialRssDiagnostics> {
  const session = await auth();

  if (!session?.user?.id || !campaignId) {
    return null;
  }

  const campaign = await prisma.campaign.findFirst({
    where: buildAccessibleCampaignWhere({
      campaignId,
      email: session.user.email,
      userId: session.user.id,
    }),
    select: {
      id: true,
    },
  });

  if (!campaign) {
    return null;
  }

  const run = await prisma.campaignRun.findFirst({
    where: {
      campaignId,
      trigger: "CAMPAIGN_CREATED",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      initialRssPollEvents: {
        orderBy: [
          {
            sequence: "asc",
          },
          {
            attempt: "asc",
          },
        ],
      },
    },
  });

  if (!run) {
    return null;
  }

  return {
    run: {
      id: run.id,
      status: run.status,
      message: run.message,
      error: run.error,
      queuedAt: run.queuedAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      failedAt: run.failedAt?.toISOString() ?? null,
      updatedAt: run.updatedAt.toISOString(),
    },
    events: run.initialRssPollEvents.map((event) => ({
      id: event.id,
      subreddit: event.subreddit,
      sequence: event.sequence,
      attempt: event.attempt,
      status: event.status,
      requestedAt: event.requestedAt.toISOString(),
      fetchStartedAt: event.fetchStartedAt?.toISOString() ?? null,
      completedAt: event.completedAt?.toISOString() ?? null,
      durationMs: event.durationMs,
      waitMs: event.waitMs,
      nextRequestDelayMs: event.nextRequestDelayMs,
      nextRequestAt: event.nextRequestAt?.toISOString() ?? null,
      httpStatus: event.httpStatus,
      statusText: event.statusText,
      errorMessage: event.errorMessage,
      ratelimitUsed: event.ratelimitUsed,
      ratelimitRemaining: event.ratelimitRemaining,
      ratelimitReset: event.ratelimitReset,
      retryAfter: event.retryAfter,
      retryAfterMs: event.retryAfterMs,
      retryWaitMs: event.retryWaitMs,
      retryUntil: event.retryUntil?.toISOString() ?? null,
      fetchedPosts: event.fetchedPosts,
      matchedItems: event.matchedItems,
      createdLeads: event.createdLeads,
    })),
  };
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
