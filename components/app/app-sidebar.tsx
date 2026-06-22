"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/app/brand-logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/app",
    label: "Overview",
    description: "Workspace state",
    icon: OverviewIcon,
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    description: "Targeting rules",
    icon: CampaignsIcon,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Alerts and profile",
    icon: SettingsIcon,
  },
];

const ownerNavItems = [
  {
    href: "/admin/analytics",
    label: "Analytics",
    description: "SaaS metrics",
    icon: AnalyticsIcon,
  },
];

type AppSidebarProps = {
  isOwner?: boolean;
  shouldShowSlackConnect?: boolean;
  userLabel: string;
};

export function AppSidebar({ isOwner = false, shouldShowSlackConnect = false, userLabel }: AppSidebarProps) {
  const pathname = usePathname();
  const visibleNavItems = isOwner ? [...navItems, ...ownerNavItems] : navItems;

  return (
    <>
    <aside className="rounded-[24px] bg-[linear-gradient(180deg,#121212_0%,#181818_100%)] p-3 text-[#ffffff] shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:hidden">
      <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#181818] p-3 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
        <div className="min-w-0">
          <BrandLogo className="block text-[1.45rem] font-semibold tracking-[-0.07em]" />
          <p className="mt-1 truncate text-[11px] text-[#b3b3b3]">{userLabel}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1f1f1f] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
          <PulseIcon />
        </div>
      </div>

      <nav className="mt-3 grid grid-cols-3 gap-2">
        {visibleNavItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-2 rounded-[18px] px-2 py-3 text-center transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
                active
                  ? "bg-[#1f1f1f] text-[#ffffff] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
                  : "bg-[#181818] text-[#b3b3b3] hover:bg-[#1f1f1f] hover:text-[#ffffff]",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full transition-colors duration-200",
                  active
                    ? "bg-[#121212] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
                    : "bg-[#1f1f1f] text-[#b3b3b3]",
                )}
              >
                <Icon />
              </span>
              <span className={cn("truncate text-[11px]", active ? "font-bold" : "font-normal")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {shouldShowSlackConnect ? <SlackConnectCard compact /> : null}
      <LogoutButton className="mt-3 h-10 w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] focus-visible:ring-white/25 focus-visible:ring-offset-[#121212]" />
    </aside>

    <aside className="hidden h-full w-full flex-col rounded-[24px] bg-[linear-gradient(180deg,#121212_0%,#181818_100%)] p-4 text-[#ffffff] shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:flex lg:min-h-full lg:p-5">
      <div className="rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <BrandLogo className="block text-[1.65rem] font-semibold tracking-[-0.07em]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
              Workspace
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[#1f1f1f] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <PulseIcon />
          </div>
        </div>

        <div className="mt-5 rounded-[18px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">Signed in</p>
          <p className="mt-1 truncate text-[14px] font-bold text-[#ffffff]">{userLabel}</p>
        </div>
      </div>

      <nav className="mt-5 flex-1">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">
          Navigation
        </p>
        <div className="mt-3 space-y-2">
          {visibleNavItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-full px-3 py-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]",
                  active
                    ? "bg-[#1f1f1f] text-[#ffffff] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
                    : "text-[#b3b3b3] hover:bg-[#1f1f1f] hover:text-[#ffffff]",
                )}
              >
                <div
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full transition",
                    active
                      ? "bg-[#121212] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
                      : "bg-[#1f1f1f] text-[#b3b3b3] group-hover:text-[#ffffff]",
                  )}
                >
                  <Icon />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-[14px] leading-none", active ? "font-bold" : "font-normal")}>
                    {item.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-4 text-[#b3b3b3]">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-4 -m-5 -mb-4 rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">Utility</p>
        {shouldShowSlackConnect ? <SlackConnectCard /> : null}
        <div className="mt-4 rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#ffffff]">Session active</p>
            <p className="text-[11px] text-[#b3b3b3]">Leave the workspace safely.</p>
          </div>
          <LogoutButton className="mt-4 h-11 w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] focus-visible:ring-white/25 focus-visible:ring-offset-[#121212]" />
        </div>
      </div>
    </aside>
    </>
  );
}

function SlackConnectCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-[20px] bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]", compact ? "mt-3" : "mt-4")}>
      <div className="relative p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(30,215,96,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1f1f1f] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
              <SlackLogo />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#ffffff]">Slack alerts</p>
              <p className="text-[11px] text-[#b3b3b3]">Not connected</p>
            </div>
          </div>
          <p className={cn("mt-3 text-[12px] leading-5 text-[#cbcbcb]", compact ? "max-w-[34ch]" : "")}>
            Send high-intent lead alerts to your Slack channel.
          </p>
          <a
            className="mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-[#1ed760] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] transition-colors duration-200 hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
            href="/api/slack/install"
          >
            Connect Slack
          </a>
        </div>
      </div>
    </div>
  );
}

function SlackLogo() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 122.8 122.8">
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9Z"
        fill="#E01E5A"
      />
      <path
        d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6Z"
        fill="#E01E5A"
      />
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2Z"
        fill="#36C5F0"
      />
      <path
        d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3Z"
        fill="#36C5F0"
      />
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2Z"
        fill="#2EB67D"
      />
      <path
        d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3Z"
        fill="#2EB67D"
      />
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9Z"
        fill="#ECB22E"
      />
      <path
        d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 12h4l2.2-4 3.6 8 2.2-4H20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function OverviewIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M4 13h6V5H4v8Zm10 6h6V5h-6v14ZM4 19h6v-4H4v4Z" fill="currentColor" />
    </svg>
  );
}

function CampaignsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 7h14M5 12h14M5 17h10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 3.5v2M12 18.5v2M18.5 12h2M3.5 12h2M17.66 6.34l-1.42 1.42M7.76 16.24l-1.42 1.42M17.66 17.66l-1.42-1.42M7.76 7.76 6.34 6.34"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 19V9m7 10V5m7 14v-7M4 19h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
