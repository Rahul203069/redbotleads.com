"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { buildAccessibleCampaignWhere } from "@/lib/campaign-access";
import { CAMPAIGN_LEAD_STATUSES, type CampaignLeadStatus } from "@/lib/campaign-lead-status";
import { getLiveNotificationHealth, type LiveNotificationHealth } from "@/lib/live-leads";
import { prisma } from "@/lib/prisma";

export type LiveActionResult = {
  message: string;
  status: "success" | "error";
  leadStatus?: CampaignLeadStatus;
};

const leadReferenceSchema = z.object({
  campaignId: z.string().trim().min(1),
  leadId: z.string().trim().min(1),
});

const leadStatusSchema = leadReferenceSchema.extend({ status: z.enum(CAMPAIGN_LEAD_STATUSES) });

async function findAccessibleLead(input: { campaignId: string; leadId: string; email?: string | null; userId: string }) {
  return prisma.lead.findFirst({
    where: {
      id: input.leadId,
      campaignId: input.campaignId,
      campaign: { is: buildAccessibleCampaignWhere({ campaignId: input.campaignId, email: input.email, userId: input.userId }) },
    },
    select: { id: true, campaignId: true, status: true },
  });
}

function revalidateLeadSurfaces(campaignId: string) {
  revalidatePath("/inbox");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/history`);
}

export async function getCampaignNotificationHealth(
  campaignId: string,
): Promise<LiveNotificationHealth | null> {
  const session = await auth();
  const id = String(campaignId ?? "").trim();

  if (!session?.user?.id || !id) {
    return null;
  }

  return getLiveNotificationHealth({
    campaignId: id,
    email: session.user.email,
    userId: session.user.id,
  });
}

export async function updateLiveLeadStatus(input: {
  campaignId: string;
  leadId: string;
  status: CampaignLeadStatus;
}): Promise<LiveActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "You must be signed in to update a lead." };

  const parsed = leadStatusSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Choose a valid lead status." };
  const lead = await findAccessibleLead({ ...parsed.data, email: session.user.email, userId: session.user.id });
  if (!lead) return { status: "error", message: "Lead not found in an accessible campaign." };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const canonicalLead = await tx.lead.update({
        where: { id: lead.id },
        data: { status: parsed.data.status },
        select: { status: true },
      });
      await tx.notification.updateMany({
        where: { leadId: lead.id, recipientUserId: session.user.id, handledAt: null },
        data: { handledAt: new Date() },
      });
      return canonicalLead;
    });
    revalidateLeadSurfaces(lead.campaignId);
    return { status: "success", message: "Lead status updated.", leadStatus: updated.status };
  } catch (error) {
    console.error("Live lead status update failed", error);
    return { status: "error", message: "Could not update this lead. Try again." };
  }
}

export async function markLiveLeadReviewed(input: { campaignId: string; leadId: string }): Promise<LiveActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "You must be signed in to review a lead." };
  const parsed = leadReferenceSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Campaign and lead IDs are required." };
  const lead = await findAccessibleLead({ ...parsed.data, email: session.user.email, userId: session.user.id });
  if (!lead) return { status: "error", message: "Lead not found in an accessible campaign." };

  try {
    const status = await prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({ where: { id: lead.id, status: "NEW" }, data: { status: "REVIEWED" } });
      await tx.notification.updateMany({
        where: { leadId: lead.id, recipientUserId: session.user.id, handledAt: null },
        data: { handledAt: new Date() },
      });
      return tx.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { status: true } });
    });
    revalidateLeadSurfaces(lead.campaignId);
    return { status: "success", message: "Lead marked reviewed.", leadStatus: status.status };
  } catch (error) {
    console.error("Live lead review failed", error);
    return { status: "error", message: "Could not mark this lead reviewed." };
  }
}

export async function saveLiveLeadNote(input: { campaignId: string; leadId: string; notes: string }): Promise<LiveActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "You must be signed in to save a note." };
  const parsed = leadReferenceSchema.extend({ notes: z.string().max(4000) }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "Notes must be 4,000 characters or less." };
  const lead = await findAccessibleLead({ ...parsed.data, email: session.user.email, userId: session.user.id });
  if (!lead) return { status: "error", message: "Lead not found in an accessible campaign." };
  try {
    await prisma.lead.update({ where: { id: lead.id }, data: { notes: parsed.data.notes.trim() || null } });
    revalidateLeadSurfaces(lead.campaignId);
    return { status: "success", message: "Shared campaign note saved." };
  } catch (error) {
    console.error("Live lead note save failed", error);
    return { status: "error", message: "Could not save this note." };
  }
}

export async function markNotificationHandled(notificationId: string): Promise<LiveActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "You must be signed in." };
  const id = String(notificationId ?? "").trim();
  if (!id) return { status: "error", message: "Notification ID is missing." };
  const result = await prisma.notification.updateMany({
    where: { id, recipientUserId: session.user.id, handledAt: null },
    data: { handledAt: new Date() },
  });
  if (!result.count) return { status: "error", message: "Notification not found or already handled." };
  revalidatePath("/inbox");
  return { status: "success", message: "Notification marked handled." };
}

export async function markAllNotificationsHandled(): Promise<LiveActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "You must be signed in." };
  const result = await prisma.notification.updateMany({
    where: { recipientUserId: session.user.id, handledAt: null },
    data: { handledAt: new Date() },
  });
  revalidatePath("/inbox");
  return { status: "success", message: `${result.count} notification${result.count === 1 ? "" : "s"} marked handled.` };
}

const campaignSettingsSchema = z.object({
  campaignId: z.string().trim().min(1),
  description: z.string().trim().max(4000),
  regions: z.array(z.string().trim().min(1).max(100)).max(100),
  keywords: z.array(z.string().trim().min(1).max(200)).max(500),
  negativeKeywords: z.array(z.string().trim().min(1).max(200)).max(500),
  subreddits: z.array(z.string().trim().min(1).max(100)).min(1).max(10000),
  minScoreToAlert: z.coerce.number().int().min(1).max(100),
});

function parseLines(value: FormDataEntryValue | null) {
  return Array.from(new Set(String(value ?? "").split(/[\r\n,]+/).map((item) => item.trim().replace(/^r\//i, "")).filter(Boolean)));
}

export async function updateLiveCampaignSettings(_previous: LiveActionResult, formData: FormData): Promise<LiveActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "You must be signed in." };
  const parsed = campaignSettingsSchema.safeParse({
    campaignId: formData.get("campaignId"),
    description: formData.get("description"),
    regions: parseLines(formData.get("regions")),
    keywords: parseLines(formData.get("keywords")),
    negativeKeywords: parseLines(formData.get("negativeKeywords")),
    subreddits: parseLines(formData.get("subreddits")),
    minScoreToAlert: formData.get("minScoreToAlert"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the campaign settings." };
  const campaign = await prisma.campaign.findFirst({ where: { id: parsed.data.campaignId, userId: session.user.id }, select: { id: true } });
  if (!campaign) return { status: "error", message: "Only the campaign owner can edit this configuration." };
  try {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        description: parsed.data.description || null,
        regions: parsed.data.regions,
        keywords: parsed.data.keywords,
        negativeKeywords: parsed.data.negativeKeywords,
        subreddits: parsed.data.subreddits,
        minScoreToAlert: parsed.data.minScoreToAlert,
      },
    });
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaign.id}`);
    revalidatePath(`/campaigns/${campaign.id}/settings`);
    return { status: "success", message: "Campaign settings saved." };
  } catch (error) {
    console.error("Live campaign settings save failed", error);
    return { status: "error", message: "Could not save campaign settings." };
  }
}

export async function setLiveCampaignActiveState(campaignId: string, isActive: boolean): Promise<LiveActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "You must be signed in." };
  const id = String(campaignId ?? "").trim();
  const result = await prisma.campaign.updateMany({ where: { id, userId: session.user.id }, data: { isActive } });
  if (!result.count) return { status: "error", message: "Only the campaign owner can change monitoring state." };
  revalidatePath("/inbox");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  revalidatePath(`/campaigns/${id}/settings`);
  return { status: "success", message: isActive ? "Campaign resumed." : "Campaign paused." };
}
