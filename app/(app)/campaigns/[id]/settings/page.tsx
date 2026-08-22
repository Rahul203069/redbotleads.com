import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bell, Settings2 } from "lucide-react";

import { CampaignMonitoringToggle } from "@/components/live/campaign-monitoring-toggle";
import { LiveCampaignSettingsForm } from "@/components/live/live-campaign-settings-form";
import { LiveCampaignTabs } from "@/components/live/live-campaign-tabs";
import { PersonalAlertThresholdForm } from "@/components/live/personal-alert-threshold-form";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { buildAccessibleCampaignWhere, getCampaignAccessFromRecord, getCampaignDisplayName, normalizeAccessEmail } from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";
import { getSaasConfig } from "@/lib/saas-config";

export default async function CampaignSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const config = await getSaasConfig();
  if (config.appMode !== "LIVE") redirect(`/campaigns/${id}`);
  const normalizedEmail = normalizeAccessEmail(session.user.email);
  const [campaign, user] = await Promise.all([
    prisma.campaign.findFirst({
      where: buildAccessibleCampaignWhere({ campaignId: id, email: session.user.email, userId: session.user.id }),
      select: {
        id: true, name: true, userId: true, description: true, regions: true, keywords: true, negativeKeywords: true, subreddits: true, minScoreToAlert: true, isActive: true,
        clientAccesses: { where: { normalizedEmail }, select: { displayName: true, normalizedEmail: true, minScoreToAlert: true } },
        semanticQueries: { orderBy: { createdAt: "asc" }, take: 20, select: { id: true, category: true, queryText: true } },
        _count: { select: { semanticQueries: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { preferredAlertChannel: true, slackWebhookUrl: true, telegramConnectedAt: true } }),
  ]);
  if (!campaign) notFound();
  const access = getCampaignAccessFromRecord({ campaign, email: session.user.email, userId: session.user.id });
  if (!access) notFound();
  const owner = access.role === "OWNER";
  const clientThreshold = campaign.clientAccesses[0]?.minScoreToAlert ?? campaign.minScoreToAlert;
  const displayName = getCampaignDisplayName(campaign, access);
  const notificationReady = user?.preferredAlertChannel === "TELEGRAM" ? Boolean(user.telegramConnectedAt) : user?.preferredAlertChannel === "SLACK" ? Boolean(user.slackWebhookUrl) : true;

  return <div className="space-y-5">
    <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-6 lg:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-[#55e982]"><Settings2 className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-[0.2em]">Campaign configuration</p></div><h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-white lg:text-[2.5rem]">{displayName}</h1><p className="mt-2 text-[14px] leading-6 text-[#a7a7a7]">Manage targeting context and alert preferences without changing the worker pipeline.</p></div>{owner ? <CampaignMonitoringToggle campaignId={id} initialActive={campaign.isActive} /> : null}</div><div className="mt-6"><LiveCampaignTabs active="SETTINGS" campaignId={id} /></div></section>

    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-5 lg:p-6"><div className="mb-5 border-b border-white/[0.07] pb-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#777]">Targeting</p><h2 className="mt-2 text-[21px] font-bold text-white">Campaign details</h2></div><LiveCampaignSettingsForm campaign={campaign} readOnly={!owner} /></section>

    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-5 lg:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#777]">Semantic queries</p><h2 className="mt-2 text-[21px] font-bold text-white">{campaign._count.semanticQueries.toLocaleString()} monitoring queries</h2><p className="mt-2 text-[13px] leading-5 text-[#a7a7a7]">Showing the first {Math.min(20, campaign._count.semanticQueries)} so very large query sets stay fast and readable.</p></div>{canViewAnalytics(session.user.email) ? <Link className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" href={`/admin/analytics/semantic-queries?campaignId=${id}`}>Manage query set</Link> : null}</div><div className="mt-5 grid max-h-[360px] gap-2 overflow-y-auto pr-1">{campaign.semanticQueries.length ? campaign.semanticQueries.map((query, index) => <div className="rounded-[15px] bg-[#111111] p-4" key={query.id}><div className="flex flex-wrap gap-2"><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#55e982]">Query {index + 1}</span>{query.category ? <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#777]">{query.category}</span> : null}</div><p className="mt-2 text-[12px] leading-5 text-[#c7c7c7]">{query.queryText}</p></div>) : <div className="rounded-[16px] border border-dashed border-white/[0.12] bg-[#111111] p-5 text-[13px] text-[#a7a7a7]">No semantic queries are configured.</div>}</div></section>

    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-5 lg:p-6"><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-full ${notificationReady ? "bg-[#1ed760]/15 text-[#55e982]" : "bg-[#3b2d10] text-[#ffd66e]"}`}><Bell className="h-4 w-4" /></span><div><h2 className="text-[16px] font-bold text-white">Notifications {notificationReady ? "ready" : "need setup"}</h2><p className="mt-1 text-[12px] text-[#8f8f8f]">Primary channel: {user?.preferredAlertChannel ?? "Email"}</p></div></div><div className="mt-5 border-t border-white/[0.07] pt-5">{!owner ? <PersonalAlertThresholdForm campaignId={id} initialScore={clientThreshold} /> : <p className="text-[13px] leading-5 text-[#a7a7a7]">The campaign owner threshold is part of Campaign details above.</p>}<Link className="mt-4 inline-flex text-[10px] font-bold uppercase tracking-[0.12em] text-[#55e982] hover:text-[#73f5a0]" href="/settings/notifcation">Manage notification channel</Link></div></section>
  </div>;
}
