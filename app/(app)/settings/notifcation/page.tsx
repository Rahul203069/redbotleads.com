import { redirect } from "next/navigation";

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
            Manage email alerts and Slack delivery preferences.
          </p>
        </div>
      </section>

      <SettingsBackLink />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <NotificationSettingsForm
          deliveryEmail={user.email ?? "your account email"}
          defaultEmailAlertsEnabled={user.emailAlertsEnabled}
          defaultSlackWebhookUrl={user.slackWebhookUrl ?? ""}
        />

        <div className="rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            What this does
          </div>
          <div className="mt-4 space-y-3 text-[14px] leading-6 text-[#cbcbcb]">
            <p>Email alerts control whether this user can receive notification deliveries when lead alerts are enabled.</p>
            <p>The Slack field stores an incoming webhook URL used for lead alerts that cross the campaign threshold.</p>
            <p>You can leave Slack empty and still use email-only alerts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
