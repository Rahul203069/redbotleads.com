import Link from "next/link";

import { auth } from "@/lib/auth";

export default async function AppHomePage() {
  const session = await auth();
  const displayName = session?.user.name ?? session?.user.email ?? "operator";

  return (
    <div>
      <section className="relative w-full overflow-hidden rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] sm:p-8 lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(30,215,96,0.14),transparent_22%),linear-gradient(180deg,#1f1f1f_0%,#121212_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(124,124,124,0.65),transparent)]" />
        <div className="absolute right-6 top-6 z-10 sm:right-8 sm:top-8 lg:right-10 lg:top-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1f1f1f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <span className="h-2 w-2 rounded-full bg-[#1ed760]" />
            Workspace
          </div>
        </div>

        <div className="relative max-w-2xl space-y-5">
          <div className="space-y-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
              Overview
            </p>
            <h1 className="text-[2rem] font-bold leading-none tracking-[-0.04em] text-[#fdfdfd] sm:text-[2.75rem]">
              Signed in as {displayName}
            </h1>
            <p className="max-w-[44ch] text-[15px] leading-6 text-[#cbcbcb] sm:text-base">
              This page is intentionally minimal for now. We can define the dashboard structure once
              the core app sections are clearer.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/campaigns"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1ed760] px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#121212] transition hover:scale-[1.02] hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
            >
              Open campaigns
            </Link>
            <Link
              href="/settings"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:scale-[1.02] hover:bg-[#272727] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
            >
              Open settings
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
