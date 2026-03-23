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
    href: "/leads",
    label: "Leads",
    description: "Qualified signals",
    icon: LeadsIcon,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Alerts and profile",
    icon: SettingsIcon,
  },
  {
    href: "/rss-lab",
    label: "RSS Lab",
    description: "Parser testing",
    icon: RssLabIcon,
  },
];

type AppSidebarProps = {
  userLabel: string;
};

export function AppSidebar({ userLabel }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col rounded-[28px] border border-[#27272a] bg-[linear-gradient(180deg,rgba(17,17,19,0.98),rgba(10,10,11,1))] p-4 shadow-[0_22px_56px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:min-h-full lg:rounded-[26px] lg:p-5">
      <div className="border-b border-[#27272a] px-3 pb-6 pt-4">
        <div className="space-y-2">
          <BrandLogo className="block text-[1.7rem] font-semibold tracking-[-0.07em]" />
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#71717a]">Workspace</p>
        </div>
        <div className="mt-6 space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#71717a]">Signed in</p>
          <p className="truncate text-sm font-medium text-[#e4e4e7]">{userLabel}</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-2">
        <p className="px-3 text-[11px] uppercase tracking-[0.24em] text-[#71717a]">Navigation</p>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl border px-4 py-3 transition",
                active
                  ? "border-[#52525b] bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(18,18,21,0.96))] shadow-[0_16px_36px_rgba(255,255,255,0.05)]"
                  : "border-transparent bg-transparent hover:border-[#27272a] hover:bg-[#151518]",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 grid h-9 w-9 place-items-center rounded-xl border",
                    active
                      ? "border-[#52525b] bg-[#1c1c20] text-[#fafafa]"
                      : "border-[#27272a] bg-[#101012] text-[#a1a1aa]",
                  )}
                >
                  <Icon />
                </div>
                <div className="min-w-0">
                  <div className={cn("text-sm font-medium", active ? "text-[#F8FAFC]" : "text-[#CBD5E1]")}>{item.label}</div>
                  <div className="mt-1 text-xs text-[#71717a]">{item.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </aside>
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

function LeadsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4.5 19a4.5 4.5 0 0 1 9 0M13.5 19a3.5 3.5 0 0 1 7 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
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

function RssLabIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 18a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0-6a7 7 0 0 1 7 7M5 8a11 11 0 0 1 11 11M5 4a15 15 0 0 1 15 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
