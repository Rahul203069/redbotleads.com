import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { auth } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <AppHeader
        eyebrow="Workspace controls"
        title="Settings"
        description="Choose a section to manage your account details, billing state, or delivery preferences."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <SettingsCard
          href="/settings/profile"
          title="Profile"
          description="View your username and email."
          meta={session.user.name ?? session.user.email ?? "Account details"}
        />
        <SettingsCard
          href="/settings/billing"
          title="Billing"
          description="Review plan and billing status."
          meta={session.user.plan === "free" ? "Free plan" : session.user.plan}
        />
        <SettingsCard
          href="/settings/notifcation"
          title="Notification"
          description="Manage email alerts and Slack delivery."
          meta="Email + Slack"
          status={session.user.slackWebhookUrl ? "Connected" : "Not connected"}
        />
      </div>
    </div>
  );
}

function SettingsCard({
  description,
  href,
  meta,
  status,
  title,
}: {
  description: string;
  href: string;
  meta: string;
  status?: string;
  title: string;
}) {
  return (
    <Link
      className="group rounded-[24px] border border-[#27272a] bg-[#111113] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)] transition hover:border-[#3f3f46] hover:bg-[#151518]"
      href={href}
    >
      <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">{title}</div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold tracking-[-0.04em] text-[#fafafa]">{title}</div>
        {status ? (
          <span
            className={
              status === "Not connected"
                ? "rounded-full border border-[#7f1d1d] bg-[#241313] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#fca5a5]"
                : "rounded-full border border-[#3f3f46] bg-[#18181b] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#d4d4d8]"
            }
          >
            {status}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-7 text-[#a1a1aa]">{description}</p>
      <div className="mt-6 flex items-center justify-between border-t border-[#27272a] pt-4">
        <span className="text-sm text-[#d4d4d8]">{meta}</span>
        <span className="text-sm font-medium text-[#fafafa] transition group-hover:translate-x-0.5">Open</span>
      </div>
    </Link>
  );
}
