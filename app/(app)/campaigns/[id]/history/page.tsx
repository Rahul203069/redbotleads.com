import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Filter } from "lucide-react";

import { LiveCampaignTabs } from "@/components/live/live-campaign-tabs";
import { ReadOnlyLiveLeadFeed } from "@/components/live/read-only-live-lead-feed";
import { auth } from "@/lib/auth";
import { resolveViewerAppMode } from "@/lib/app-mode";
import { canViewAnalytics } from "@/lib/beta-access";
import { CAMPAIGN_LEAD_STATUSES, type CampaignLeadStatus } from "@/lib/campaign-lead-status";
import { getLiveCampaignHistory } from "@/lib/live-leads";
import { getSaasConfig } from "@/lib/saas-config";
import { addDaysToDateKey, BROWSER_TIME_ZONE_COOKIE, getDateKeyInTimeZone, getDayRangeInTimeZone, normalizeTimeZone } from "@/lib/time-zone";

type HistoryParams = { cursor?: string; from?: string; intent?: string; range?: string; source?: string; status?: string; subreddit?: string; to?: string };

export default async function CampaignHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<HistoryParams> | HistoryParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const config = await getSaasConfig();
  const viewerAppMode = resolveViewerAppMode(
    config.appMode,
    canViewAnalytics(session.user.email),
  );
  if (viewerAppMode !== "LIVE") {
    const { id } = await params;
    redirect(`/campaigns/${id}`);
  }
  const [{ id }, query, cookieStore] = await Promise.all([params, Promise.resolve(searchParams ?? {}), cookies()]);
  const timeZone = normalizeTimeZone(cookieStore.get(BROWSER_TIME_ZONE_COOKIE)?.value);
  const range = ["today", "yesterday", "7d", "30d", "custom", "all"].includes(query.range ?? "") ? query.range! : "7d";
  const dateRange = resolveDateRange({ from: query.from, range, timeZone, to: query.to });
  const status = CAMPAIGN_LEAD_STATUSES.includes(query.status as CampaignLeadStatus) ? query.status as CampaignLeadStatus : undefined;
  const intent = ["HIGH", "MED", "LOW"].includes(query.intent ?? "") ? query.intent as "HIGH" | "MED" | "LOW" : undefined;
  const source = ["POST", "COMMENT"].includes(query.source ?? "") ? query.source as "POST" | "COMMENT" : undefined;
  const history = await getLiveCampaignHistory({
    campaignId: id,
    userId: session.user.id,
    email: session.user.email,
    cursor: query.cursor,
    from: dateRange.from,
    to: dateRange.to,
    status,
    intent,
    source,
    subreddit: query.subreddit || undefined,
  });
  if (!history) redirect("/campaigns");

  return <div className="space-y-5">
    <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-6 lg:p-8">
      <div className="flex items-center gap-2 text-[#55e982]"><CalendarDays className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-[0.2em]">Complete record</p></div>
      <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-white lg:text-[2.5rem]">{history.campaign.name}</h1>
      <p className="mt-2 text-[14px] leading-6 text-[#a7a7a7]">Filter by when Redbot found the lead. The original Reddit post time remains visible on every card.</p>
      <div className="mt-6"><LiveCampaignTabs active="HISTORY" campaignId={id} /></div>
    </section>

    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 sm:p-5">
      <form className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]" method="get">
        <FilterSelect defaultValue={range} label="Date found" name="range" options={[['today','Today'],['yesterday','Yesterday'],['7d','Last 7 days'],['30d','Last 30 days'],['custom','Custom'],['all','All time']]} />
        <FilterSelect defaultValue={intent ?? ""} label="Intent" name="intent" options={[["","All intent"],["HIGH","High"],["MED","Medium"],["LOW","Low"]]} />
        <FilterSelect defaultValue={status ?? ""} label="Status" name="status" options={[["","All statuses"],...CAMPAIGN_LEAD_STATUSES.map((item) => [item, item.charAt(0) + item.slice(1).toLowerCase()] as [string,string])]} />
        <FilterSelect defaultValue={source ?? ""} label="Source" name="source" options={[["","Posts and comments"],["POST","Posts"],["COMMENT","Comments"]]} />
        <button className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 self-end rounded-full bg-[#1ed760] px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d160f] hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" type="submit"><Filter className="h-4 w-4" /> Apply</button>
        <FilterSelect defaultValue={query.subreddit ?? ""} label="Subreddit" name="subreddit" options={[["","All subreddits"],...history.subreddits.map((item) => [item, `r/${item}`] as [string,string])]} />
        {range === "custom" ? <><DateInput defaultValue={query.from} label="From" name="from" /><DateInput defaultValue={query.to} label="To" name="to" /></> : null}
      </form>
      <div className="mt-5 border-t border-white/[0.07] pt-5"><ReadOnlyLiveLeadFeed emptyDescription="No qualified Reddit leads matched these history filters." emptyTitle="No matching leads" leads={history.leads} timeZone={timeZone} /></div>
      {history.nextCursor ? <div className="mt-5 flex justify-center border-t border-white/[0.07] pt-5"><Link className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-[#1f1f1f] px-5 text-[10px] font-bold uppercase tracking-[0.13em] text-white hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" href={buildNextHref(id, query, range, history.nextCursor)}>Load older leads</Link></div> : null}
    </section>
  </div>;
}

function FilterSelect({ defaultValue, label, name, options }: { defaultValue: string; label: string; name: string; options: Array<[string,string]> }) { return <label className="grid min-w-0 gap-2"><span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#777]">{label}</span><select className="h-11 min-w-0 cursor-pointer rounded-[14px] border border-white/[0.1] bg-[#101010] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" defaultValue={defaultValue} name={name}>{options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>; }
function DateInput({ defaultValue, label, name }: { defaultValue?: string; label: string; name: string }) { return <label className="grid gap-2"><span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#777]">{label}</span><input className="h-11 rounded-[14px] border border-white/[0.1] bg-[#101010] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" defaultValue={defaultValue} name={name} type="date" /></label>; }

function resolveDateRange({ from, range, timeZone, to }: { from?: string; range: string; timeZone: string; to?: string }) {
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  if (range === "all") return {};
  if (range === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) return { from: getDayRangeInTimeZone(from!, timeZone).from, to: getDayRangeInTimeZone(addDaysToDateKey(to!, 1), timeZone).from };
  const startKey = range === "yesterday" ? addDaysToDateKey(todayKey, -1) : range === "30d" ? addDaysToDateKey(todayKey, -29) : range === "7d" ? addDaysToDateKey(todayKey, -6) : todayKey;
  const endKey = range === "yesterday" ? todayKey : addDaysToDateKey(todayKey, 1);
  return { from: getDayRangeInTimeZone(startKey, timeZone).from, to: getDayRangeInTimeZone(endKey, timeZone).from };
}

function buildNextHref(id: string, query: HistoryParams, range: string, cursor: string) { const params = new URLSearchParams(); params.set("range", range); for (const key of ["from","to","intent","status","source","subreddit"] as const) if (query[key]) params.set(key, query[key]!); params.set("cursor", cursor); return `/campaigns/${id}/history?${params}`; }
