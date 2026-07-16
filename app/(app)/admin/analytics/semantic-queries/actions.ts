"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { persistCampaignSemanticQueries, type SavedCampaignSemanticQuery } from "@/lib/campaign-semantic-queries";
import { prisma } from "@/lib/prisma";
import { parseSemanticQueriesJson } from "@/lib/semantic-queries";

export type SaveCampaignSemanticQueriesResult =
  | {
      status: "success";
      message: string;
      queries: SavedCampaignSemanticQuery[];
    }
  | {
      status: "error";
      message: string;
    };

export async function saveCampaignSemanticQueries(formData: FormData): Promise<SaveCampaignSemanticQueriesResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to edit semantic queries.",
    };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!campaignId) {
    return {
      status: "error",
      message: "Select a campaign before saving semantic queries.",
    };
  }

  const parsedQueries = parseSemanticQueriesJson(String(formData.get("queriesJson") ?? ""));

  if (parsedQueries.status === "error") {
    return {
      status: "error",
      message: parsedQueries.message,
    };
  }

  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!campaign) {
    return {
      status: "error",
      message: "Campaign was not found.",
    };
  }

  let savedQueries: SavedCampaignSemanticQuery[];

  try {
    savedQueries = await persistCampaignSemanticQueries({
      campaignId: campaign.id,
      mode: "replace",
      queries: parsedQueries.queries,
      source: "admin_semantic_query_editor",
      userId: session.user.id,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Save failed while replacing semantic queries.",
    };
  }

  revalidatePath("/admin/analytics");
  revalidatePath("/admin/analytics/playground");
  revalidatePath("/admin/analytics/semantic-queries");

  return {
    status: "success",
    message: `Saved ${savedQueries.length} live semantic ${savedQueries.length === 1 ? "query" : "queries"} for ${campaign.name}.`,
    queries: savedQueries,
  };
}
