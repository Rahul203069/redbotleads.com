"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { CAMPAIGN_LEAD_LAYOUTS, type CampaignLeadLayout } from "@/lib/campaign-lead-layout";
import { normalizeLeadScoringModel } from "@/lib/openai-models";
import {
  clampSubredditSuggestionCount,
  upsertCampaignLeadLayout,
  upsertSaasConfig,
} from "@/lib/saas-config";

export type AdminSettingsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type CampaignLeadLayoutActionResult = AdminSettingsActionState & {
  layout?: CampaignLeadLayout;
};

const campaignLeadLayoutSchema = z.enum(CAMPAIGN_LEAD_LAYOUTS);

export async function updateSaasSettings(
  _prevState: AdminSettingsActionState,
  formData: FormData,
): Promise<AdminSettingsActionState> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have access to update SaaS settings.",
    };
  }

  const subredditSuggestionCount = clampSubredditSuggestionCount(
    Number.parseInt(String(formData.get("subredditSuggestionCount") ?? ""), 10),
  );
  const leadScoringModel = normalizeLeadScoringModel(String(formData.get("leadScoringModel") ?? ""));

  try {
    await upsertSaasConfig({
      subredditSuggestionCount,
      leadScoringModel,
    });
  } catch (error) {
    console.error("SaaS settings update failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Could not save SaaS settings.",
    };
  }

  revalidatePath("/admin/analytics");

  return {
    status: "success",
    message: "SaaS settings saved.",
  };
}

export async function updateCampaignLeadLayout(
  input: string,
): Promise<CampaignLeadLayoutActionResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have access to change the campaign lead page.",
    };
  }

  const parsed = campaignLeadLayoutSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Choose either the Current page or the New inbox.",
    };
  }

  try {
    await upsertCampaignLeadLayout(parsed.data);
  } catch (error) {
    console.error("Campaign lead layout update failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Could not change the lead page.",
    };
  }

  revalidatePath("/admin/analytics");
  revalidatePath("/campaigns");
  revalidatePath("/campaigns/[id]", "page");

  return {
    status: "success",
    message: parsed.data === "INBOX" ? "The new lead inbox is now live." : "The current lead page is now live.",
    layout: parsed.data,
  };
}
