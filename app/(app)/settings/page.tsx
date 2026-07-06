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
      preferredAlertChannel: true,
      slackWebhookUrl: true,
      telegramConnectedAt: true,
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
          description="View your profile and reset your password."
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
          description="Manage email alerts, Slack, and Telegram delivery."
          meta={formatAlertChannel(user.preferredAlertChannel)}
          metaIcon={<AlertChannelLogo channel={user.preferredAlertChannel} />}
          status={getNotificationStatus({
            preferredAlertChannel: user.preferredAlertChannel,
            slackWebhookUrl: user.slackWebhookUrl,
            telegramConnectedAt: user.telegramConnectedAt,
          })}
        />
      </div>
    </div>
  );
}

function formatAlertChannel(channel: "EMAIL" | "SLACK" | "TELEGRAM") {
  if (channel === "TELEGRAM") return "Telegram";
  if (channel === "SLACK") return "Slack";
  return "Email";
}

function getNotificationStatus({
  preferredAlertChannel,
  slackWebhookUrl,
  telegramConnectedAt,
}: {
  preferredAlertChannel: "EMAIL" | "SLACK" | "TELEGRAM";
  slackWebhookUrl: string | null;
  telegramConnectedAt: Date | null;
}) {
  if (preferredAlertChannel === "TELEGRAM") {
    return telegramConnectedAt ? "Connected" : "Not connected";
  }

  if (preferredAlertChannel === "SLACK") {
    return slackWebhookUrl ? "Connected" : "Not connected";
  }

  return "Enabled";
}

function SettingsCard({
  description,
  href,
  meta,
  metaIcon,
  status,
  title,
}: {
  description: string;
  href: string;
  meta: string;
  metaIcon?: React.ReactNode;
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
        <span className="inline-flex items-center gap-2 text-[14px] text-[#cbcbcb]">
          {metaIcon}
          {meta}
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff]">
          Open
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

function AlertChannelLogo({ channel }: { channel: "EMAIL" | "SLACK" | "TELEGRAM" }) {
  if (channel === "TELEGRAM") {
    return <TelegramLogo />;
  }

  if (channel === "SLACK") {
    return <SlackLogo />;
  }

  return <EmailIcon />;
}

function SlackLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 122.8 122.8">
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9Z" fill="#E01E5A" />
      <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6Z" fill="#E01E5A" />
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2Z" fill="#36C5F0" />
      <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3Z" fill="#36C5F0" />
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2Z" fill="#2EB67D" />
      <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3Z" fill="#2EB67D" />
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9Z" fill="#ECB22E" />
      <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6Z" fill="#ECB22E" />
    </svg>
  );
}

function TelegramLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 240 240">
      <circle cx="120" cy="120" fill="#2AABEE" r="120" />
      <path
        d="M177.4 74.5 157.7 168c-1.5 6.6-5.4 8.2-10.9 5.1l-30.1-22.2-14.5 14c-1.6 1.6-3 3-6.1 3l2.2-30.6 55.7-50.3c2.4-2.2-.5-3.4-3.8-1.2l-68.8 43.3-29.6-9.3c-6.4-2-6.6-6.4 1.3-9.5l115.8-44.6c5.4-2 10.1 1.3 8.5 8.8Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#b3b3b3]" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 7.5 12 13l7.5-5.5M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
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
