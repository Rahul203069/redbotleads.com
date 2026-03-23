import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NotificationSettingsPage() {
  const session = await auth();

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
      slackWebhookUrl: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <AppHeader
        eyebrow="Notification"
        title="Notification settings"
        description="Manage email alerts and Slack delivery preferences."
      />

      <SettingsBackLink />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <NotificationSettingsForm
          deliveryEmail={user.email ?? "your account email"}
          defaultEmailAlertsEnabled={user.emailAlertsEnabled}
          defaultSlackWebhookUrl={user.slackWebhookUrl ?? ""}
        />

        <div className="rounded-[24px] border border-[#27272a] bg-[#111113] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">What this does</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#a1a1aa]">
            <p>Email alerts control whether this user can receive notification deliveries when lead alerts are enabled.</p>
            <p>The Slack field stores an incoming webhook URL for future Slack-based notification delivery.</p>
            <p>You can leave Slack empty and still use email-only alerts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
