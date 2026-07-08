import type { Prisma } from "../generated/prisma/client";

export type CampaignAccessRole = "OWNER" | "CLIENT";

export type CampaignAccess = {
  campaignId: string;
  displayName: string | null;
  role: CampaignAccessRole;
};

export function normalizeAccessEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

export function buildAccessibleCampaignWhere({
  campaignId,
  email,
  userId,
}: {
  campaignId?: string;
  email: string | null | undefined;
  userId: string;
}): Prisma.CampaignWhereInput {
  const normalizedEmail = normalizeAccessEmail(email);
  const accessOr: Prisma.CampaignWhereInput[] = [
    {
      userId,
    },
  ];

  if (normalizedEmail) {
    accessOr.push({
      clientAccesses: {
        some: {
          normalizedEmail,
        },
      },
    });
  }

  return {
    ...(campaignId ? { id: campaignId } : {}),
    OR: accessOr,
  };
}

export function getCampaignAccessFromRecord({
  campaign,
  email,
  userId,
}: {
  campaign: {
    clientAccesses?: Array<{
      displayName: string;
      normalizedEmail: string;
    }>;
    id: string;
    name: string;
    userId: string;
  };
  email: string | null | undefined;
  userId: string;
}): CampaignAccess | null {
  if (campaign.userId === userId) {
    return {
      campaignId: campaign.id,
      displayName: campaign.name,
      role: "OWNER",
    };
  }

  const normalizedEmail = normalizeAccessEmail(email);
  const clientAccess = campaign.clientAccesses?.find((access) => access.normalizedEmail === normalizedEmail);

  if (!clientAccess) {
    return null;
  }

  return {
    campaignId: campaign.id,
    displayName: clientAccess.displayName,
    role: "CLIENT",
  };
}

export function getCampaignDisplayName<T extends { name: string }>(
  campaign: T,
  access: Pick<CampaignAccess, "displayName" | "role"> | null,
) {
  return access?.role === "CLIENT" && access.displayName?.trim()
    ? access.displayName
    : campaign.name;
}

export function canEditCampaignDescription(access: Pick<CampaignAccess, "role"> | null) {
  return access?.role === "OWNER" || access?.role === "CLIENT";
}

export function canManageCampaign(access: Pick<CampaignAccess, "role"> | null) {
  return access?.role === "OWNER";
}
