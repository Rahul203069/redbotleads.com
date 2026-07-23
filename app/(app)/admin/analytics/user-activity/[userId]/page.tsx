import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Eye,
  ListTree,
  MousePointerClick,
  UserRoundCheck,
} from "lucide-react";

import { ClientActivityTrendChart } from "@/components/admin/client-activity-trend-chart";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  CLIENT_ACTIVITY_RANGE_OPTIONS,
  getClientActivityEventLabel,
  getClientActivityRange,
  isClientActivityPageView,
  type ClientActivityEventType,
  type ClientActivityStatus,
} from "@/lib/client-activity-core";
import { getCampaignClientActivityDetail } from "@/lib/client-activity";
import { formatDateInTimeZone, formatDateTimeInTimeZone } from "@/lib/time-zone";

type SearchParams = {
  campaignId?: string;
  from?: string;
  page?: string;
  range?: string;
  to?: string;
};

export default async function ClientActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const [{ userId }, query] = await Promise.all([params, Promise.resolve(searchParams ?? {})]);
  const range = getClientActivityRange(query);
  const page = parsePage(query.page);
  const detail = await getCampaignClientActivityDetail({
    campaignId: query.campaignId,
    page,
    range,
    userId,
  });

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,#1b1b1b_0%,#151515_58%,#102118_100%)] px-5 py-6 shadow-[rgba(0,0,0,0.28)_0px_12px_32px] lg:px-7 lg:py-7">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#121212] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
          href="/admin/analytics/user-activity"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          All beta users
        </Link>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <EngagementStatusBadge status={detail.allTime.engagementStatus} />
              <span className="rounded-full bg-[#121212] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b3b3b3]">
                Joined {formatDateInTimeZone(detail.user.createdAt, "UTC")}
              </span>
            </div>
            <h1 className="mt-3 truncate text-[2rem] font-bold tracking-[-0.04em] text-[#ffffff] lg:text-[2.6rem]">
              {detail.user.name || detail.user.email}
            </h1>
            <p className="mt-2 text-[14px] text-[#b8b8b8]">{detail.user.email}</p>
          </div>
          <div className="rounded-[16px] border border-white/[0.08] bg-[#101010] px-4 py-3 text-[12px] text-[#b3b3b3]">
            <span className="font-semibold text-[#ffffff]">{range.label}</span>
            <span className="mx-2 text-[#505050]">·</span>
            Times shown in UTC
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Eye className="h-5 w-5" />} label="Dashboard visits" value={detail.range.dashboardVisits} />
        <MetricCard icon={<CalendarDays className="h-5 w-5" />} label="Active days" value={detail.range.activeDays} />
        <MetricCard icon={<UserRoundCheck className="h-5 w-5" />} label="Unique leads reviewed" tone="good" value={detail.range.uniqueLeadsReviewed} />
        <MetricCard icon={<ListTree className="h-5 w-5" />} label="Lead expansions" value={detail.range.leadExpansions} />
        <MetricCard icon={<MousePointerClick className="h-5 w-5" />} label="Reddit clicks" value={detail.range.redditClicks} />
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]" method="get">
          <FilterField label="Campaign">
            <select className={inputClassName} defaultValue={query.campaignId ?? ""} name="campaignId">
              <option value="">All assigned campaigns</option>
              {detail.campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.clientDisplayName}{campaign.clientDisplayName !== campaign.internalName ? ` · ${campaign.internalName}` : ""}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Range">
            <select className={inputClassName} defaultValue={range.key} name="range">
              {CLIENT_ACTIVITY_RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>{formatRangeOption(option)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Custom from">
            <input className={inputClassName} defaultValue={query.from ?? ""} name="from" type="date" />
          </FilterField>
          <FilterField label="Custom to">
            <input className={inputClassName} defaultValue={query.to ?? ""} name="to" type="date" />
          </FilterField>
          <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-1 xl:self-end">
            <button className={primaryButtonClassName} type="submit">Apply</button>
            <Link className={secondaryButtonClassName} href={`/admin/analytics/user-activity/${detail.user.id}`}>Reset</Link>
          </div>
        </form>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
          <div className="border-b border-white/8 pb-5">
            <h2 className="text-[20px] font-bold text-[#ffffff]">Usage trend</h2>
            <p className="mt-2 text-[13px] leading-5 text-[#b3b3b3]">Page visits and direct lead-review actions by UTC day.</p>
          </div>
          <div className="pt-5">
            <ClientActivityTrendChart rows={detail.trendRows} />
          </div>
        </div>

        <div className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
          <div className="border-b border-white/8 pb-5">
            <h2 className="text-[20px] font-bold text-[#ffffff]">All-time signals</h2>
            <p className="mt-2 text-[13px] text-[#b3b3b3]">Independent of the selected report range.</p>
          </div>
          <dl className="grid gap-4 pt-5">
            <SignalRow label="Last activity" value={formatOptionalDate(detail.allTime.lastActivityAt)} />
            <SignalRow label="Last dashboard access" value={formatOptionalDate(detail.allTime.lastDashboardAccessAt)} />
            <SignalRow label="Last lead review" value={formatOptionalDate(detail.allTime.lastLeadReviewAt)} />
            <SignalRow label="Active days" value={String(detail.allTime.activeDays)} />
            <SignalRow label="Dashboard visits" value={String(detail.allTime.dashboardVisits)} />
            <SignalRow label="Unique leads reviewed" value={String(detail.allTime.uniqueLeadsReviewed)} />
          </dl>
        </div>
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="border-b border-white/8 pb-5">
          <h2 className="text-[20px] font-bold text-[#ffffff]">Campaign breakdown</h2>
          <p className="mt-2 text-[13px] text-[#b3b3b3]">Engagement within the selected date range.</p>
        </div>
        <div className="grid gap-3 pt-5 lg:grid-cols-2">
          {detail.campaignBreakdown.map((campaign) => (
            <article className="rounded-[18px] bg-[#121212] p-4" key={campaign.id}>
              <h3 className="text-[15px] font-bold text-[#ffffff]">{campaign.clientDisplayName}</h3>
              {campaign.clientDisplayName !== campaign.internalName ? (
                <p className="mt-1 text-[11px] text-[#8f8f8f]">Internal: {campaign.internalName}</p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniMetric label="Visits" value={campaign.dashboardVisits} />
                <MiniMetric label="Days" value={campaign.activeDays} />
                <MiniMetric label="Reviewed" value={campaign.uniqueLeadsReviewed} />
                <MiniMetric label="Reddit" value={campaign.redditClicks} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-[#ffffff]">Activity timeline</h2>
            <p className="mt-2 text-[13px] text-[#b3b3b3]">
              Showing page {detail.pagination.page} of {detail.pagination.totalPages} · {detail.pagination.totalEvents} event{detail.pagination.totalEvents === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex gap-2">
            {detail.pagination.hasPreviousPage ? (
              <Link className={secondaryButtonClassName} href={buildPageHref(detail.user.id, query, detail.pagination.page - 1)}>Previous</Link>
            ) : null}
            {detail.pagination.hasNextPage ? (
              <Link className={secondaryButtonClassName} href={buildPageHref(detail.user.id, query, detail.pagination.page + 1)}>Next</Link>
            ) : null}
          </div>
        </div>

        {detail.timeline.length === 0 ? (
          <div className="mt-5 rounded-[18px] border border-dashed border-[#3f3f46] p-6 text-[14px] leading-6 text-[#b3b3b3]">
            No activity was recorded in this range.
          </div>
        ) : (
          <ol className="space-y-3 pt-5">
            {detail.timeline.map((event) => (
              <li className="rounded-[18px] border border-white/[0.06] bg-[#121212] p-4" key={event.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <EventIcon eventType={event.eventType} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#ffffff]">{getClientActivityEventLabel(event.eventType)}</p>
                      <p className="mt-1 text-[12px] text-[#8f8f8f]">
                        {event.campaignDisplayName} · {formatDateTimeInTimeZone(event.createdAt, "UTC")} UTC
                      </p>
                      {event.lead ? (
                        <div className="mt-3 rounded-[14px] bg-[#1a1a1a] p-3">
                          <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-[#ffffff]">{event.lead.title}</p>
                          <p className="mt-1 text-[11px] text-[#8f8f8f]">
                            r/{event.lead.subreddit} · {event.lead.label} · score {event.lead.score}
                          </p>
                          {event.lead.url ? (
                            <a
                              className="mt-3 inline-flex min-h-11 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1ed760] hover:text-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
                              href={event.lead.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Open Reddit
                              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                      {isClientActivityPageView(event.eventType) && event.availableLeadCount !== null ? (
                        <p className="mt-3 text-[12px] text-[#b3b3b3]">
                          {event.availableLeadCount} visible lead{event.availableLeadCount === 1 ? "" : "s"} available
                          {event.newLeadCountSinceLastVisit !== null
                            ? ` · ${event.newLeadCountSinceLastVisit} new since the previous visit`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const inputClassName =
  "h-11 w-full rounded-[12px] border border-white/[0.08] bg-[#101010] px-3 text-[13px] text-[#ffffff] outline-none transition-colors hover:border-white/[0.14] focus:border-[#1ed760]/60 focus:ring-2 focus:ring-[#1ed760]/15";
const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]";
const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffffff] transition-colors hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]";

function MetricCard({
  icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "good" | "neutral";
  value: number;
}) {
  return (
    <div className="rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#121212] text-[#b3b3b3]">{icon}</div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8f8f]">{label}</p>
      <p className={`mt-2 text-[2rem] font-bold leading-none tracking-[-0.05em] ${tone === "good" ? "text-[#1ed760]" : "text-[#ffffff]"}`}>
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function FilterField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</span>
      {children}
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[13px] bg-[#1a1a1a] px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8f8f8f]">{label}</p>
      <p className="mt-2 text-[18px] font-bold leading-none text-[#ffffff]">{value}</p>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] bg-[#121212] px-4 py-3">
      <dt className="text-[12px] text-[#8f8f8f]">{label}</dt>
      <dd className="text-right text-[12px] font-semibold text-[#ffffff]">{value}</dd>
    </div>
  );
}

function EventIcon({ eventType }: { eventType: ClientActivityEventType }) {
  const isReview = eventType === "LEAD_EXPANDED" || eventType === "REDDIT_LINK_CLICKED";

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${isReview ? "bg-[#12331f] text-[#73f5a0]" : "bg-[#102742] text-[#8fc8ff]"}`}>
      {eventType === "REDDIT_LINK_CLICKED"
        ? <ExternalLink aria-hidden="true" className="h-4 w-4" />
        : eventType === "LEAD_EXPANDED"
          ? <ListTree aria-hidden="true" className="h-4 w-4" />
          : <Eye aria-hidden="true" className="h-4 w-4" />}
    </div>
  );
}

function EngagementStatusBadge({ status }: { status: ClientActivityStatus }) {
  const className = status === "ACTIVE"
    ? "bg-[#12331f] text-[#73f5a0]"
    : status === "QUIET"
      ? "bg-[#102742] text-[#8fc8ff]"
      : status === "INACTIVE"
        ? "bg-[#3a151b] text-[#ff9aa5]"
        : "bg-[#27272a] text-[#cbcbcb]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}>
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

function formatOptionalDate(value: Date | null) {
  return value ? `${formatDateTimeInTimeZone(value, "UTC")} UTC` : "Never";
}

function formatRangeOption(value: string) {
  if (value === "all") {
    return "All activity";
  }

  if (value === "custom") {
    return "Custom dates";
  }

  return `Last ${value} days`;
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function buildPageHref(userId: string, query: SearchParams, page: number) {
  const search = new URLSearchParams();

  for (const key of ["campaignId", "from", "range", "to"] as const) {
    const value = query[key];

    if (value) {
      search.set(key, value);
    }
  }

  search.set("page", String(page));
  return `/admin/analytics/user-activity/${userId}?${search.toString()}`;
}
