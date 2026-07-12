import { redirect } from "next/navigation";

import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  buildAccessibleCampaignWhere,
  getCampaignAccessFromRecord,
  getCampaignDisplayName,
  normalizeAccessEmail,
} from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    slack?: string;
  }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      emailAlertsEnabled: true,
      preferredAlertChannel: true,
      slackChannelName: true,
      slackConfigurationUrl: true,
      slackTeamName: true,
      slackWebhookUrl: true,
      telegramConnectedAt: true,
      telegramUsername: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const isAdminAccount = canViewAnalytics(session.user.email);
  const notificationCampaign = !isAdminAccount
    ? await prisma.campaign.findFirst({
        where: buildAccessibleCampaignWhere({
          email: session.user.email,
          userId: session.user.id,
        }),
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          name: true,
          userId: true,
          minScoreToAlert: true,
          clientAccesses: {
            where: {
              normalizedEmail: normalizeAccessEmail(session.user.email),
            },
            select: {
              displayName: true,
              normalizedEmail: true,
            },
          },
        },
      })
    : null;
  const campaignAccess = notificationCampaign
    ? getCampaignAccessFromRecord({
        campaign: notificationCampaign,
        email: session.user.email,
        userId: session.user.id,
      })
    : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
            Notification
          </p>
          <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
            Notification settings
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
            Manage Slack and Telegram lead alert delivery.
          </p>
        </div>
      </section>

      <SettingsBackLink />

      {params?.slack ? (
        <div
          className={
            params.slack === "connected"
              ? "rounded-[18px] bg-[#102414] px-4 py-3 text-sm text-[#d1fae5] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
              : "rounded-[18px] bg-[#241313] px-4 py-3 text-sm text-[#fee2e2] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
          }
        >
          {getSlackStatusMessage(params.slack)}
        </div>
      ) : null}

      {isAdminAccount ? (
        <div className="flex items-center justify-start">
          <a
            className="inline-flex items-center rounded-full bg-[#1f1f1f] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
            href="/settings/notifcation/test"
          >
            Open Slack test
          </a>
        </div>
      ) : null}

      <div className="max-w-3xl">
        <NotificationSettingsForm
          defaultEmailAlertsEnabled={user.emailAlertsEnabled}
          defaultPreferredAlertChannel={user.preferredAlertChannel}
          notificationThresholdCampaign={
            notificationCampaign && campaignAccess
              ? {
                  id: notificationCampaign.id,
                  name: getCampaignDisplayName(notificationCampaign, campaignAccess),
                  minScoreToAlert: notificationCampaign.minScoreToAlert,
                }
              : null
          }
          slackChannelName={user.slackChannelName}
          slackConfigurationUrl={user.slackConfigurationUrl}
          slackTeamName={user.slackTeamName}
          telegramConnectedAt={user.telegramConnectedAt?.toISOString() ?? null}
          telegramUsername={user.telegramUsername}
        />
      </div>
    </div>
  );
}

function getSlackStatusMessage(status: string) {
  if (status === "connected") return "Slack connected. Lead alerts will use the selected Slack channel first.";
  if (status === "denied") return "Slack connection was cancelled.";
  if (status === "missing_config") return "Slack OAuth is not configured on this app.";
  if (status === "invalid_state") return "Slack connection could not be verified. Please try again.";
  if (status === "missing_webhook") return "Slack did not return an incoming webhook. Check the Slack app scopes.";
  return `Slack connection failed: ${status}`;
}
