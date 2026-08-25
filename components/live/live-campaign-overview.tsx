import { ArrowRight, Bell, Clock3, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DailyLeadsDateFilter } from "@/components/admin/daily-leads-date-filter";
import { CampaignMonitoringToggle } from "@/components/live/campaign-monitoring-toggle";
import { EditCampaignDescriptionDialog } from "@/components/live/edit-campaign-description-dialog";
import { LiveCampaignTabs } from "@/components/live/live-campaign-tabs";
import { ReadOnlyLiveLeadFeed } from "@/components/live/read-only-live-lead-feed";
import type { DailyLeadDateSelection } from "@/lib/daily-leads-analytics";
import { getLiveCampaignOverview } from "@/lib/live-leads";
import { prisma } from "@/lib/prisma";
import { formatDateInTimeZone, formatDateTimeInTimeZone } from "@/lib/time-zone";

export async function LiveCampaignOverview({
  campaignId,
  dateSelection,
  email,
  isAdminAccount,
  page,
  timeZone,
  userId,
}: {
  campaignId: string;
  dateSelection: DailyLeadDateSelection;
  email?: string | null;
  isAdminAccount: boolean;
  page: number;
  timeZone: string;
  userId: string;
}) {
  const [overview, user] = await Promise.all([
    getLiveCampaignOverview(
      { campaignId, email, userId },
      { dateRanges: dateSelection.ranges, page },
    ),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferredAlertChannel: true,
        slackWebhookUrl: true,
        telegramConnectedAt: true,
      },
    }),
  ]);

  if (!overview) notFound();

  const notificationReady = user?.preferredAlertChannel === "TELEGRAM"
    ? Boolean(user.telegramConnectedAt)
    : user?.preferredAlertChannel === "SLACK"
      ? Boolean(user.slackWebhookUrl)
      : true;
  const dateLabel = formatDateSelectionLabel(dateSelection, timeZone);
  const firstRow = overview.pagination.totalRows === 0
    ? 0
    : (overview.pagination.page - 1) * overview.pagination.pageSize + 1;
  const lastRow = Math.min(
    overview.pagination.totalRows,
    overview.pagination.page * overview.pagination.pageSize,
  );

  return (
    <div className="space-y-5">
      {isAdminAccount ? (
        <AdminCampaignHero
          campaign={overview.campaign}
          campaignId={campaignId}
          timeZone={timeZone}
        />
      ) : (
        <NonAdminCampaignHero
          campaign={overview.campaign}
          campaignId={campaignId}
          timeZone={timeZone}
        />
      )}

      {isAdminAccount ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric accent label="Leads found" value={overview.metrics.total} />
          <Metric label="High intent" value={overview.metrics.highIntent} />
          <Metric label="Contacted" value={overview.metrics.contacted} />
          <div className="rounded-[20px] border border-white/[0.06] bg-[#181818] p-5">
            <div className="flex items-center gap-2">
              <Bell className={`h-4 w-4 ${notificationReady ? "text-[#55e982]" : "text-[#ffd66e]"}`} />
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#777]">Notifications</p>
            </div>
            <p className="mt-3 text-[15px] font-bold text-white">
              {notificationReady ? `${user?.preferredAlertChannel ?? "Email"} ready` : "Needs setup"}
            </p>
            <Link
              className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#55e982] transition-colors hover:text-[#73f5a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70"
              href={`/settings/notifcation?campaignId=${encodeURIComponent(campaignId)}`}
            >
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className={`rounded-[24px] bg-[#181818] p-5 lg:p-6 ${isAdminAccount ? "border border-white/[0.06]" : "shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"}`}>
        <div className={`flex flex-col gap-3 sm:flex-row sm:justify-between ${isAdminAccount ? "sm:items-end" : "border-b border-white/8 pb-5 sm:items-start"}`}>
          <div>
            {isAdminAccount ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#55e982]">
                Daily lead report
              </p>
            ) : null}
            <h2 className={`${isAdminAccount ? "mt-2 text-[22px]" : "text-[24px] tracking-tight"} font-bold text-white`}>
              {isAdminAccount ? "Qualified leads" : "Classified leads"}
            </h2>
            <p className={`${isAdminAccount ? "text-[13px] leading-5 text-[#a7a7a7]" : "text-[14px] leading-6 text-[#cbcbcb]"} mt-2`}>
              {isAdminAccount
                ? `${dateLabel} · Showing ${firstRow}-${lastRow} of ${overview.pagination.totalRows}`
                : `Qualified Reddit posts for ${dateLabel}. Showing ${firstRow}-${lastRow} of ${overview.pagination.totalRows}.`}
            </p>
          </div>
          {isAdminAccount ? (
            <Link
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70"
              href={`/campaigns/${campaignId}/history`}
            >
              Advanced history <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {isAdminAccount ? <DailyLeadsDateFilter defaultRange="today" enableMultipleDates /> : null}

        <div className="pt-5">
          <ReadOnlyLiveLeadFeed
            appearance={isAdminAccount ? "default" : "daily"}
            emptyDescription={`No qualified Reddit leads were detected for ${dateLabel}.`}
            emptyTitle="No leads for these dates"
            leads={overview.leads}
            timeZone={timeZone}
          />
        </div>

        {overview.pagination.hasPreviousPage || overview.pagination.hasNextPage ? (
          <nav
            aria-label="Lead report pagination"
            className="mt-5 flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-[11px] text-[#8f8f8f]">
              Page {overview.pagination.page} of {overview.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              {overview.pagination.hasPreviousPage ? (
                <PaginationLink
                  href={buildPageHref(campaignId, dateSelection, overview.pagination.page - 1)}
                  label="Previous"
                />
              ) : null}
              {overview.pagination.hasNextPage ? (
                <PaginationLink
                  href={buildPageHref(campaignId, dateSelection, overview.pagination.page + 1)}
                  label="Next"
                />
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

type CampaignHeroData = {
  description: string | null;
  isActive: boolean;
  lastCheckedAt: string | null;
  name: string;
  regions: string[];
  role: string;
};

function AdminCampaignHero({
  campaign,
  campaignId,
  timeZone,
}: {
  campaign: CampaignHeroData;
  campaignId: string;
  timeZone: string;
}) {
  return (
    <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.45)_0px_8px_24px] lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${campaign.isActive ? "bg-[#1ed760]/15 text-[#73f5a0]" : "bg-[#3b2d10] text-[#ffd66e]"}`}>
              {campaign.isActive ? "Active" : "Paused"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#777]">
              {campaign.role}
            </span>
          </div>
          <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-white lg:text-[2.6rem]">
            {campaign.name}
          </h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <InfoPill
              icon={Clock3}
              label={campaign.lastCheckedAt
                ? `Last checked ${formatDateTimeInTimeZone(campaign.lastCheckedAt, timeZone)}`
                : "Awaiting first completed run"}
            />
            {campaign.regions.length ? (
              <InfoPill icon={MapPin} label={campaign.regions.join(", ")} />
            ) : null}
          </div>
        </div>
        {campaign.role === "OWNER" ? (
          <div className="grid shrink-0 gap-3 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
            <CampaignMonitoringToggle campaignId={campaignId} initialActive={campaign.isActive} />
          </div>
        ) : null}
      </div>
      <div className="mt-6">
        <LiveCampaignTabs active="OVERVIEW" campaignId={campaignId} />
      </div>
    </section>
  );
}

function NonAdminCampaignHero({
  campaign,
  campaignId,
  timeZone,
}: {
  campaign: CampaignHeroData;
  campaignId: string;
  timeZone: string;
}) {
  return (
    <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.75rem]">
              {campaign.name}
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <LiveStatusPill isActive={campaign.isActive} />
              <DailyHeroChip
                icon={Clock3}
                label={campaign.lastCheckedAt
                  ? `Last checked ${formatDateTimeInTimeZone(campaign.lastCheckedAt, timeZone)}`
                  : "Awaiting first completed run"}
              />
              {campaign.regions.length ? (
                <DailyHeroChip icon={MapPin} label={campaign.regions.join(", ")} />
              ) : null}
            </div>
          </div>
          <div className="grid shrink-0 gap-3 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
            <EditCampaignDescriptionDialog campaignId={campaignId} description={campaign.description} />
            {campaign.role === "OWNER" ? (
              <CampaignMonitoringToggle campaignId={campaignId} initialActive={campaign.isActive} />
            ) : null}
          </div>
        </div>
        <LiveCampaignTabs active="OVERVIEW" campaignId={campaignId} />
        <div className="w-full">
          <DailyLeadsDateFilter defaultRange="today" enableMultipleDates />
        </div>
      </div>
    </section>
  );
}

function DailyHeroChip({ icon: Icon, label }: { icon: typeof Clock3; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#121212] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[#b3b3b3]" />
      {label}
    </span>
  );
}

function LiveStatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${isActive ? "border-[#1ed760]/25 bg-[#1ed760]/10 text-[#7cf5a3]" : "border-[#3f3f46] bg-[#121212] text-[#b3b3b3]"}`}>
      <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
      {isActive ? "Monitoring active" : "Paused"}
    </span>
  );
}

function InfoPill({ icon: Icon, label }: { icon: typeof Clock3; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-3 py-2 text-[10px] font-semibold text-[#a7a7a7]">
      <Icon className="h-3.5 w-3.5 text-[#55e982]" />
      {label}
    </span>
  );
}

function Metric({ accent = false, label, value }: { accent?: boolean; label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#181818] p-5">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#777]">{label}</p>
      <p className={`mt-3 text-[30px] font-bold leading-none ${accent ? "text-[#55e982]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function PaginationLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70"
      href={href}
      scroll={false}
    >
      {label}
    </Link>
  );
}

function buildPageHref(campaignId: string, selection: DailyLeadDateSelection, page: number) {
  const params = new URLSearchParams();

  if (selection.source === "all") {
    params.set("range", "all");
  } else if (selection.source === "dates") {
    for (const dateStart of selection.dateStarts) {
      params.append("date", dateStart);
    }
  } else {
    params.set("from", selection.range.from.toISOString());
    params.set("to", selection.range.to.toISOString());
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  return `/campaigns/${campaignId}?${params.toString()}`;
}

function formatDateSelectionLabel(selection: DailyLeadDateSelection, timeZone: string) {
  if (selection.source === "all") {
    return "All time";
  }

  if (selection.source === "dates") {
    const labels = selection.ranges.map((range) => formatDateInTimeZone(range.from, timeZone));

    if (labels.length === 1) {
      return labels[0];
    }

    if (labels.length <= 3) {
      return labels.join(", ");
    }

    return `${labels.length} selected dates`;
  }

  const fromLabel = formatDateInTimeZone(selection.range.from, timeZone);
  const inclusiveTo = new Date(selection.range.to.getTime() - 1);
  const toLabel = formatDateInTimeZone(inclusiveTo, timeZone);

  return fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;
}
