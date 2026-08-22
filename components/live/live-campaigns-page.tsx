import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowUpRight, Clock3, RadioTower } from "lucide-react";

import { BetaCampaignAccessButton } from "@/components/campaigns/beta-campaign-access-button";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { getLiveCampaignCards } from "@/lib/live-leads";
import { addDaysToDateKey, BROWSER_TIME_ZONE_COOKIE, formatDateTimeInTimeZone, getDateKeyInTimeZone, getDayRangeInTimeZone, normalizeTimeZone } from "@/lib/time-zone";

export async function LiveCampaignsPage({ canCreate, email, isAdmin, userId }: { canCreate: boolean; email?: string | null; isAdmin: boolean; userId: string }) {
  const cookieStore = await cookies();
  const timeZone = normalizeTimeZone(cookieStore.get(BROWSER_TIME_ZONE_COOKIE)?.value);
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  const todayFrom = getDayRangeInTimeZone(todayKey, timeZone).from;
  const weekFrom = getDayRangeInTimeZone(addDaysToDateKey(todayKey, -6), timeZone).from;
  const campaigns = await getLiveCampaignCards({ userId, email }, { todayFrom, weekFrom });
  const activeCount = campaigns.filter((campaign) => campaign.isActive).length;
  const leadCountToday = campaigns.reduce((total, campaign) => total + campaign.leadCountToday, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.45)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[#55e982]"><RadioTower className="h-4 w-4" /><p className="text-[11px] font-bold uppercase tracking-[0.22em]">Monitoring portfolio</p></div>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-white lg:text-[2.6rem]">Campaigns</h1>
            <p className="mt-3 text-[14px] leading-6 text-[#b8b8b8]">Manage monitoring state, review performance, inspect complete lead history, and update targeting.</p>
          </div>
          {canCreate ? <CampaignWizard isAdminAccount={isAdmin} triggerLabel="Create campaign" /> : <BetaCampaignAccessButton label="Create campaign" />}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Campaigns" value={campaigns.length} />
        <Metric label="Active" value={activeCount} accent />
        <Metric label="Leads today" value={leadCountToday} />
      </section>

      {campaigns.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-white/[0.12] bg-[#181818] p-8 text-center"><h2 className="text-[20px] font-bold text-white">No campaigns yet</h2><p className="mx-auto mt-2 max-w-lg text-[14px] leading-6 text-[#a7a7a7]">Create one focused campaign to start building your Live Mode lead inbox.</p></section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {campaigns.map((campaign) => (
            <article className="group rounded-[22px] border border-white/[0.07] bg-[#181818] p-5 transition-colors duration-200 hover:border-white/[0.14] hover:bg-[#1c1c1c]" key={campaign.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${campaign.isActive ? "bg-[#1ed760]/15 text-[#73f5a0]" : "bg-[#3b2d10] text-[#ffd66e]"}`}>{campaign.isActive ? "Active" : "Paused"}</span><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777]">{campaign.role === "OWNER" ? "Owner" : "Assigned"}</span></div>
                  <h2 className="mt-3 truncate text-[19px] font-bold text-white">{campaign.name}</h2>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#a7a7a7]">{campaign.description || "No campaign description added."}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8f8f8f]"><Clock3 className="h-4 w-4" /><span>{campaign.lastCheckedAt ? `Last checked ${formatDateTimeInTimeZone(campaign.lastCheckedAt, timeZone)}` : "Awaiting first completed run"}</span></div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/[0.07] py-4"><SmallStat label="Today" value={campaign.leadCountToday} /><SmallStat label="This week" value={campaign.leadCountWeek} /><SmallStat label="Sources" value={campaign.sourceCount} /></div>
              <div className="mt-4 flex justify-end"><Link className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d160f] transition-colors hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" href={`/campaigns/${campaign.id}`}>Open campaign <ArrowUpRight className="h-4 w-4" /></Link></div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function Metric({ accent = false, label, value }: { accent?: boolean; label: string; value: number }) { return <div className="rounded-[20px] border border-white/[0.06] bg-[#181818] px-5 py-4"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#777]">{label}</p><p className={`mt-3 text-[28px] font-bold leading-none ${accent ? "text-[#55e982]" : "text-white"}`}>{value}</p></div>; }
function SmallStat({ label, value }: { label: string; value: number }) { return <div className="min-w-0 text-center"><p className="text-[18px] font-bold text-white">{value}</p><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#737373]">{label}</p></div>; }
