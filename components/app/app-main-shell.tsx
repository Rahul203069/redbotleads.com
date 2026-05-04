"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AppMainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCampaignsRoute = pathname === "/campaigns" || pathname.startsWith("/campaigns/");

  return (
    <div
      className={cn(
        "lg:my-4 lg:mr-4 lg:ml-3 xl:mr-6 xl:ml-5",
        isCampaignsRoute
          ? "min-h-[calc(100vh-2rem)]"
          : "min-h-[calc(100vh-2rem)] rounded-[32px] border border-[#27272a] bg-[linear-gradient(180deg,rgba(15,15,17,0.94),rgba(9,9,10,0.98))] shadow-[0_32px_90px_rgba(0,0,0,0.48)]",
      )}
    >
      <div className={cn(isCampaignsRoute ? "px-0 py-0" : "px-5 py-5 lg:px-8 lg:py-8")}>
        <div className="min-w-0 max-w-[1240px]">{children}</div>
      </div>
    </div>
  );
}
