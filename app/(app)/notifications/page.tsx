import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { buildAccessibleCampaignWhere } from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";
import { getSaasConfig } from "@/lib/saas-config";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const config = await getSaasConfig();
  if (config.appMode !== "LIVE") redirect("/settings/notifcation");
  if (canViewAnalytics(session.user.email)) redirect("/settings/notifcation");

  const campaigns = await prisma.campaign.findMany({
    where: buildAccessibleCampaignWhere({
      email: session.user.email,
      userId: session.user.id,
    }),
    orderBy: { updatedAt: "desc" },
    select: { id: true },
    take: 2,
  });

  if (campaigns.length === 1) {
    redirect(`/campaigns/${campaigns[0].id}#delivery-health`);
  }

  if (campaigns.length > 1) {
    redirect("/campaigns");
  }

  redirect("/settings/notifcation");
}
