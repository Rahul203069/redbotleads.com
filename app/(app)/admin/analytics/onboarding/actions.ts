"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { normalizeAccessEmail } from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";

const onboardingSchema = z.object({
  campaignId: z.string().trim().min(1, "Choose a campaign."),
  displayName: z.string().trim().min(2, "Client campaign name must be at least 2 characters.").max(120),
  email: z.string().trim().email("Enter a valid client email."),
});

export type CampaignClientAccessActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialError: CampaignClientAccessActionState = {
  status: "error",
  message: "You do not have permission to manage client onboarding.",
};

export async function upsertCampaignClientAccess(
  _prevState: CampaignClientAccessActionState,
  formData: FormData,
): Promise<CampaignClientAccessActionState> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return initialError;
  }

  const parsed = onboardingSchema.safeParse({
    campaignId: formData.get("campaignId"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Review the onboarding form and try again.",
    };
  }

  const normalizedEmail = normalizeAccessEmail(parsed.data.email);
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: parsed.data.campaignId,
    },
    select: {
      id: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!campaign) {
    return {
      status: "error",
      message: "Campaign not found.",
    };
  }

  if (normalizeAccessEmail(campaign.user.email) === normalizedEmail) {
    return {
      status: "error",
      message: "This email already owns the campaign.",
    };
  }

  const linkedUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  await prisma.campaignClientAccess.upsert({
    where: {
      campaignId_normalizedEmail: {
        campaignId: campaign.id,
        normalizedEmail,
      },
    },
    update: {
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      userId: linkedUser?.id ?? null,
    },
    create: {
      campaignId: campaign.id,
      createdByUserId: session.user.id,
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      normalizedEmail,
      userId: linkedUser?.id ?? null,
    },
  });

  revalidateOnboardingPaths(campaign.id);

  return {
    status: "success",
    message: linkedUser
      ? "Client access created and linked to the existing user."
      : "Client access created. It will apply when this email signs up or logs in.",
  };
}

export async function revokeCampaignClientAccess(formData: FormData): Promise<void> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return;
  }

  const accessId = String(formData.get("accessId") ?? "").trim();

  if (!accessId) {
    return;
  }

  const access = await prisma.campaignClientAccess.findUnique({
    where: {
      id: accessId,
    },
    select: {
      campaignId: true,
    },
  });

  if (!access) {
    return;
  }

  await prisma.campaignClientAccess.delete({
    where: {
      id: accessId,
    },
  });

  revalidateOnboardingPaths(access.campaignId);

  return;
}

function revalidateOnboardingPaths(campaignId: string) {
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/analytics/onboarding");
  revalidatePath("/app");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/analytics`);
  revalidatePath(`/campaigns/${campaignId}/daily-leads`);
}
