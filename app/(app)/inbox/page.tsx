import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Filter, Inbox } from "lucide-react";

import { LiveLeadFeed } from "@/components/live/live-lead-feed";
import { auth } from "@/lib/auth";
import { getLiveInbox, getLiveLeadById, type LiveLeadFilter } from "@/lib/live-leads";
import { getSaasConfig } from "@/lib/saas-config";
import { BROWSER_TIME_ZONE_COOKIE, normalizeTimeZone } from "@/lib/time-zone";

const filters: Array<{ label: string; value: LiveLeadFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Unreviewed", value: "UNREVIEWED" },
  { label: "Reviewed", value: "REVIEWED" },
  { label: "Saved", value: "SAVED" },
  { label: "Contacted", value: "CONTACTED" },
  { label: "Dismissed", value: "DISMISSED" },
];

type InboxSearchParams = { campaign?: string; cursor?: string; lead?: string; status?: string };

export default async function LiveInboxPage({ searchParams }: { searchParams?: Promise<InboxSearchParams> | InboxSearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const config = await getSaasConfig();
  if (config.appMode !== "LIVE") redirect("/app");

  const params = await Promise.resolve(searchParams ?? {});
  const filter = filters.some((item) => item.value === params.status) ? params.status as LiveLeadFilter : "UNREVIEWED";
  const campaignId = String(params.campaign ?? "").trim() || undefined;
  const cursor = String(params.cursor ?? "").trim() || undefined;
  const cookieStore = await cookies();
  const timeZone = normalizeTimeZone(cookieStore.get(BROWSER_TIME_ZONE_COOKIE)?.value);
  const inbox = await getLiveInbox({ userId: session.user.id, email: session.user.email, filter, campaignId, cursor });
  const selectedLead = params.lead
    ? await getLiveLeadById({ userId: session.user.id, email: session.user.email, leadId: params.lead })
    : null;
  const leads = selectedLead && !inbox.leads.some((lead) => lead.id === selectedLead.id)
    ? [selectedLead, ...inbox.leads]
    : inbox.leads;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.45)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[#55e982]"><Inbox className="h-4 w-4" /><p className="text-[11px] font-bold uppercase tracking-[0.22em]">Live lead inbox</p></div>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-white lg:text-[2.6rem]">{inbox.counts.UNREVIEWED} opportunit{inbox.counts.UNREVIEWED === 1 ? "y" : "ies"} waiting</h1>
            <p className="mt-3 text-[14px] leading-6 text-[#b8b8b8]">Review qualified leads from every active campaign. Unreviewed items stay here until you take action.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <Metric label="All" value={inbox.counts.ALL} />
            <Metric label="New" value={inbox.counts.UNREVIEWED} accent />
            <Metric label="Saved" value={inbox.counts.SAVED} />
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 sm:p-5">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="navigation" aria-label="Lead status filters">
            {filters.map((item) => {
              const active = item.value === filter;
              const count = item.value === "ALL" ? inbox.counts.ALL : item.value === "UNREVIEWED" ? inbox.counts.UNREVIEWED : inbox.counts[item.value];
              return <Link aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 ${active ? "bg-[#1ed760] text-[#0d160f]" : "bg-[#101010] text-[#a7a7a7] hover:bg-[#252525] hover:text-white"}`} href={buildInboxHref({ campaign: campaignId, status: item.value })} key={item.value}>{item.label} {count}</Link>;
            })}
          </div>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-center" method="get">
            <input name="status" type="hidden" value={filter} />
            <label className="sr-only" htmlFor="inbox-campaign">Filter by campaign</label>
            <select className="h-11 min-w-0 cursor-pointer rounded-full border border-white/[0.1] bg-[#101010] px-4 text-[12px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 sm:min-w-[230px]" defaultValue={campaignId ?? ""} id="inbox-campaign" name="campaign">
              <option value="">All Campaigns</option>
              {inbox.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
            <button className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" type="submit"><Filter className="h-4 w-4" /> Apply</button>
          </form>
        </div>
        <div className="pt-5">
          <LiveLeadFeed autoRefresh leads={leads} selectedLeadId={params.lead} timeZone={timeZone} />
        </div>
        {inbox.nextCursor ? (
          <div className="mt-5 flex justify-center border-t border-white/[0.07] pt-5"><Link className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-[#1f1f1f] px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" href={buildInboxHref({ campaign: campaignId, cursor: inbox.nextCursor, status: filter })}>Load older leads</Link></div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ accent = false, label, value }: { accent?: boolean; label: string; value: number }) {
  return <div className="rounded-[18px] border border-white/[0.07] bg-[#111111] p-3 text-center"><p className={`text-[22px] font-bold ${accent ? "text-[#55e982]" : "text-white"}`}>{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#777]">{label}</p></div>;
}

function buildInboxHref(input: { campaign?: string; cursor?: string; lead?: string; status?: LiveLeadFilter }) {
  const query = new URLSearchParams();
  if (input.status && input.status !== "UNREVIEWED") query.set("status", input.status);
  if (input.campaign) query.set("campaign", input.campaign);
  if (input.cursor) query.set("cursor", input.cursor);
  if (input.lead) query.set("lead", input.lead);
  const suffix = query.toString();
  return suffix ? `/inbox?${suffix}` : "/inbox";
}
