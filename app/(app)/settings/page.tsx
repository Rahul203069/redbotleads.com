import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      name: true,
      email: true,
      plan: true,
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
            Workspace controls
          </p>
          <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
            Settings
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
            Choose a section to manage your account details, billing state, or delivery
            preferences.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <SettingsCard
          href="/settings/profile"
          title="Profile"
          description="View your username and email."
          meta={user.name ?? user.email ?? "Account details"}
        />
        <SettingsCard
          href="/settings/billing"
          title="Billing"
          description="Review plan and billing status."
          meta={user.plan === "free" ? "Free plan" : user.plan}
        />
        <SettingsCard
          href="/settings/notifcation"
          title="Notification"
          description="Manage email alerts and Slack delivery."
          meta="Email + Slack"
          status={user.slackWebhookUrl ? "Connected" : "Not connected"}
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
      className="group rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] transition hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
      href={href}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
        {title}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[24px] font-bold tracking-[-0.04em] text-[#fdfdfd]">{title}</div>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <p className="mt-3 text-[14px] leading-6 text-[#cbcbcb]">{description}</p>
      <div className="mt-6 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[14px] text-[#cbcbcb]">{meta}</span>
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff]">
          Open
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Not connected"
      ? "bg-[#121212] text-[#f3727f]"
      : "bg-[#121212] text-[#1ed760]";

  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {status}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 17 17 7M9 7h8v8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
