import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { resolveViewerAppMode } from "@/lib/app-mode";
import { canViewAnalytics } from "@/lib/beta-access";
import { buildAccessibleCampaignWhere } from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";
import { getSaasConfig } from "@/lib/saas-config";
import {
  BROWSER_TIME_ZONE_COOKIE,
  getDateKeyInTimeZone,
  getDayRangeInTimeZone,
  normalizeTimeZone,
} from "@/lib/time-zone";

type InboxSearchParams = {
  campaign?: string;
  lead?: string;
};

export default async function LegacyInboxRedirect({
  searchParams,
}: {
  searchParams?: Promise<InboxSearchParams> | InboxSearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const config = await getSaasConfig();
  const viewerAppMode = resolveViewerAppMode(
    config.appMode,
    canViewAnalytics(session.user.email),
  );

  if (viewerAppMode !== "LIVE") {
    redirect("/app");
  }

  const params = await Promise.resolve(searchParams ?? {});
  const campaignId = String(params.campaign ?? "").trim();
  const leadId = String(params.lead ?? "").trim();
  const accessWhere = buildAccessibleCampaignWhere({
    email: session.user.email,
    userId: session.user.id,
  });

  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        ...(campaignId ? { campaignId } : {}),
        campaign: { is: accessWhere },
      },
      select: {
        campaignId: true,
        createdAt: true,
      },
    });

    if (lead) {
      const cookieStore = await cookies();
      const timeZone = normalizeTimeZone(cookieStore.get(BROWSER_TIME_ZONE_COOKIE)?.value);
      const dateKey = getDateKeyInTimeZone(lead.createdAt, timeZone);
      const range = getDayRangeInTimeZone(dateKey, timeZone);
      const query = new URLSearchParams({
        from: range.from.toISOString(),
        lead: leadId,
        to: range.to.toISOString(),
      });

      redirect(`/campaigns/${lead.campaignId}?${query.toString()}#lead-${leadId}`);
    }
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        ...accessWhere,
        id: campaignId,
      },
      select: { id: true },
    });

    if (campaign) {
      redirect(`/campaigns/${campaign.id}`);
    }
  }

  const campaigns = await prisma.campaign.findMany({
    where: accessWhere,
    orderBy: { updatedAt: "desc" },
    select: { id: true },
    take: 2,
  });

  if (campaigns.length === 1) {
    redirect(`/campaigns/${campaigns[0].id}`);
  }

  redirect("/campaigns");
}
