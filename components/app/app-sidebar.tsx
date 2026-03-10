"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
];

type AppSidebarProps = {
  userLabel: string;
};

export function AppSidebar({ userLabel }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col rounded-[28px] border border-[#27312E] bg-[#111716]/96 p-4 shadow-[0_24px_72px_rgba(0,0,0,0.28)] lg:p-5">
      <div className="border-b border-[#27312E] px-3 pb-5 pt-2">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#2f3b37] bg-[linear-gradient(145deg,#18231b,#0f1413)] shadow-[0_0_24px_rgba(123,241,121,0.08)]">
            <BrandMark />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#6F7C77]">Workspace</p>
            <p className="truncate text-sm font-semibold text-[#F3F5F4]">Reddit Lead Intel</p>
          </div>
        </div>
        <div className="mt-5 space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">Signed in</p>
          <p className="truncate text-sm font-medium text-[#F3F5F4]">{userLabel}</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-2">
        <p className="px-3 text-[11px] uppercase tracking-[0.24em] text-[#6F7C77]">Navigation</p>
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
                  ? "border-[#7BF179]/35 bg-[#18231b] shadow-[0_0_24px_rgba(123,241,121,0.08)]"
                  : "border-transparent bg-transparent hover:border-[#27312E] hover:bg-[#161D1B]",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 grid h-9 w-9 place-items-center rounded-xl border",
                    active
                      ? "border-[#2b5a36] bg-[#142219] text-[#7BF179]"
                      : "border-[#27312E] bg-[#111716] text-[#9DA9A4]",
                  )}
                >
                  <Icon />
                </div>
                <div className="min-w-0">
                  <div className={cn("text-sm font-medium", active ? "text-[#F3F5F4]" : "text-[#C3CBC8]")}>{item.label}</div>
                  <div className="mt-1 text-xs text-[#6F7C77]">{item.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-2xl border border-[#27312E] bg-[#161D1B] p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">Developer tools</p>
        <p className="mt-2 text-sm leading-6 text-[#9DA9A4]">Use the logout control here while testing auth flows and redirects.</p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 text-[#7BF179]" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 12c2.5-4 5.167-6 8-6s5.5 2 8 6c-2.5 4-5.167 6-8 6s-5.5-2-8-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
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

function LeadsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4v16M4 12h16M7.5 7.5l9 9m0-9-9 9"
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
        d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 1 0 12 8.5ZM19 12l1.5 1-1.5 3-1.8-.2a6.7 6.7 0 0 1-1.2 1.2l.2 1.8-3 1.5-1-1.5a6.7 6.7 0 0 1-1.9 0l-1 1.5-3-1.5.2-1.8a6.7 6.7 0 0 1-1.2-1.2L3.5 16 2 13l1.5-1a6.7 6.7 0 0 1 0-1.9L2 9l1.5-3 1.8.2a6.7 6.7 0 0 1 1.2-1.2L6.3 3.2 9.3 1.7l1 1.5a6.7 6.7 0 0 1 1.9 0l1-1.5 3 1.5-.2 1.8a6.7 6.7 0 0 1 1.2 1.2L20.5 6 22 9l-1.5 1a6.7 6.7 0 0 1 0 2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}
