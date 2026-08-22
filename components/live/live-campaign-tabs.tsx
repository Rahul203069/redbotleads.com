import Link from "next/link";

export function LiveCampaignTabs({ active, campaignId }: { active: "OVERVIEW" | "HISTORY" | "SETTINGS"; campaignId: string }) {
  const tabs = [
    { id: "OVERVIEW" as const, href: `/campaigns/${campaignId}`, label: "Overview" },
    { id: "HISTORY" as const, href: `/campaigns/${campaignId}/history`, label: "Lead History" },
    { id: "SETTINGS" as const, href: `/campaigns/${campaignId}/settings`, label: "Settings" },
  ];
  return <nav aria-label="Campaign sections" className="no-scrollbar flex gap-2 overflow-x-auto rounded-[18px] border border-white/[0.07] bg-[#111111] p-1.5">{tabs.map((tab) => <Link aria-current={active === tab.id ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-[13px] px-4 text-[10px] font-bold uppercase tracking-[0.13em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 ${active === tab.id ? "bg-[#1ed760] text-[#0d160f]" : "text-[#9f9f9f] hover:bg-[#1f1f1f] hover:text-white"}`} href={tab.href} key={tab.id}>{tab.label}</Link>)}</nav>;
}
