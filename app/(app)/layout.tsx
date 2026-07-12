import { redirect } from "next/navigation";

import { AppMainShell } from "@/components/app/app-main-shell";
import { AppSidebar } from "@/components/app/app-sidebar";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { buildAccessibleCampaignWhere } from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const userLabel = session.user.name ?? session.user.email ?? "Authenticated user";
  const isAdminAccount = canViewAnalytics(session.user.email);
  const [user, nonAdminCampaign] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        slackWebhookUrl: true,
        telegramChatId: true,
      },
    }),
    isAdminAccount
      ? Promise.resolve(null)
      : prisma.campaign.findFirst({
          where: buildAccessibleCampaignWhere({
            email: session.user.email,
            userId: session.user.id,
          }),
          orderBy: {
            updatedAt: "desc",
          },
          select: {
            id: true,
          },
        }),
  ]);
  const shouldShowSlackPrompt =
    isAdminAccount && !user?.slackWebhookUrl?.trim() && !user?.telegramChatId?.trim();

  return (
    <div className="min-h-screen bg-transparent px-4 py-4 text-[#F3F5F4] lg:px-0 lg:py-0">
      <div className="grid min-h-screen w-full grid-cols-1 gap-4 lg:grid-cols-[304px_minmax(0,1fr)] lg:gap-0">
        <div className="lg:sticky lg:top-0 lg:h-screen lg:pl-4 lg:pr-0 lg:py-4 xl:pl-6">
          <AppSidebar
            campaignHref={nonAdminCampaign ? `/campaigns/${nonAdminCampaign.id}` : "/campaigns"}
            isOwner={isAdminAccount}
            shouldShowSlackConnect={shouldShowSlackPrompt}
            userLabel={userLabel}
          />
        </div>
        <main className="min-w-0">
          <AppMainShell>{children}</AppMainShell>
        </main>
      </div>
    </div>
  );
}
