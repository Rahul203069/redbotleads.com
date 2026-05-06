import { redirect } from "next/navigation";

import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";
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
      email: true,
      emailAlertsEnabled: true,
      slackChannelName: true,
      slackConfigurationUrl: true,
      slackTeamName: true,
      slackWebhookUrl: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

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
            Manage Slack alerts and email fallback delivery.
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

      <div className="flex items-center justify-start">
        <a
          className="inline-flex items-center rounded-full bg-[#1f1f1f] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
          href="/settings/notifcation/test"
        >
          Open Slack test
        </a>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <NotificationSettingsForm
          deliveryEmail={user.email ?? "your account email"}
          defaultEmailAlertsEnabled={user.emailAlertsEnabled}
          slackChannelName={user.slackChannelName}
          slackConfigurationUrl={user.slackConfigurationUrl}
          slackTeamName={user.slackTeamName}
        />

        <div className="rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            What this does
          </div>
          <div className="mt-4 space-y-3 text-[14px] leading-6 text-[#cbcbcb]">
            <p>Email alerts control whether this user receives fallback lead alerts when Slack is not connected.</p>
            <p>Slack OAuth lets you choose a workspace channel without pasting webhook URLs manually.</p>
            <p>You can leave Slack empty and receive alerts at the email address on this account.</p>
          </div>
        </div>
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
