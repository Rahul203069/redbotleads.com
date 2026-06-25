"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { normalizeLeadScoringModel } from "@/lib/openai-models";
import { clampSubredditSuggestionCount, upsertSaasConfig } from "@/lib/saas-config";

export type AdminSettingsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

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
