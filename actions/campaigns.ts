"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCampaignSchema = z.object({
  name: z.string().trim().min(2, "Campaign name must be at least 2 characters."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  description: z.string().trim().optional(),
  keywords: z.array(z.string()).min(1, "Add at least one keyword."),
  negativeKeywords: z.array(z.string()),
  subreddits: z.array(z.string()).min(1, "Add at least one subreddit."),
  minScoreToAlert: z.coerce.number().int().min(1, "Min score must be at least 1.").max(100, "Min score must be 100 or less."),
  isActive: z.boolean(),
});

export type CampaignActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "description" | "keywords" | "subreddits" | "minScoreToAlert", string>>;
};

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
        minScoreToAlert: flattened.minScoreToAlert?.[0],
      },
    };
  }

  try {
    await prisma.campaign.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        leadType: parsed.data.leadType,
        description: parsed.data.description || null,
        keywords: parsed.data.keywords,
        negativeKeywords: parsed.data.negativeKeywords,
        subreddits: parsed.data.subreddits,
        minScoreToAlert: parsed.data.minScoreToAlert,
        isActive: parsed.data.isActive,
      },
    });
  } catch (error) {
    console.error("Campaign create failed", error);

    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Save failed while creating the campaign.",
    };
  }

  revalidatePath("/campaigns");

  return {
    status: "success",
    message: "Campaign created.",
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
    minScoreToAlert: formData.get("minScoreToAlert"),
    isActive: formData.get("isActive") === "on",
  };
}
