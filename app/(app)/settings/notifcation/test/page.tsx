import { redirect } from "next/navigation";

import { SlackTestForm } from "@/components/settings/slack-test-form";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SlackNotificationTestPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      slackChannelName: true,
      slackTeamName: true,
      slackWebhookUrl: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const hasWebhook = Boolean(user.slackWebhookUrl?.trim());

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-8">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
            Notification
          </p>
          <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
            Slack test page
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
            Send a direct test message to the saved webhook and confirm Slack delivery on your phone.
          </p>
        </div>
      </section>

      <SettingsBackLink href="/settings/notifcation" label="Back to notifications" />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <SlackTestForm
          hasWebhook={hasWebhook}
          webhookLabel={
            hasWebhook
              ? [user.slackTeamName, user.slackChannelName ? `#${user.slackChannelName}` : null].filter(Boolean).join(" / ") ||
                "Connected"
              : "Not connected"
          }
        />

        <div className="rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            What this tests
          </div>
          <div className="mt-4 space-y-3 text-[14px] leading-6 text-[#cbcbcb]">
            <p>This sends a message straight from a server action to the Slack channel connected through OAuth.</p>
            <p>It is useful for checking whether Slack delivery reaches your desktop and mobile app before waiting for a real lead alert.</p>
            <p>If Slack is not connected yet, go back and connect Slack first.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
