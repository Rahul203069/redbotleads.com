import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  Clock3,
  Eye,
  MousePointerClick,
  Search,
  UserCheck,
  Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  CLIENT_ACTIVITY_RANGE_OPTIONS,
  CLIENT_ACTIVITY_STATUS_OPTIONS,
  getClientActivityRange,
  parseClientActivityStatus,
  type ClientActivityStatus,
} from "@/lib/client-activity-core";
import { getCampaignClientActivityOverview } from "@/lib/client-activity";
import { formatDateTimeInTimeZone } from "@/lib/time-zone";

type SearchParams = {
  campaignId?: string;
  from?: string;
  range?: string;
  search?: string;
  status?: string;
  to?: string;
};

export default async function ClientActivityOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const params = await Promise.resolve(searchParams ?? {});
  const range = getClientActivityRange(params);
  const status = parseClientActivityStatus(params.status);
  const report = await getCampaignClientActivityOverview({
    campaignId: params.campaignId,
    range,
    search: params.search,
    status,
  });

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,#1b1b1b_0%,#151515_58%,#102118_100%)] px-5 py-6 shadow-[rgba(0,0,0,0.28)_0px_12px_32px] lg:px-7 lg:py-7">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#121212] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] hover:text-[#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
          href="/admin/analytics"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Admin analytics
        </Link>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#73f5a0]">Beta engagement</p>
            <h1 className="mt-2 text-[1.9rem] font-bold tracking-[-0.04em] text-[#ffffff] lg:text-[2.4rem]">
              Assigned-user activity
            </h1>
            <p className="mt-3 max-w-[70ch] text-[14px] leading-6 text-[#b8b8b8]">
              See when assigned non-admin users open their lead dashboards and whether they expand leads or continue to Reddit.
              Admin activity is excluded.
            </p>
          </div>
          <div className="rounded-[16px] border border-white/[0.08] bg-[#101010] px-4 py-3 text-[12px] text-[#b3b3b3]">
            <span className="font-semibold text-[#ffffff]">{range.label}</span>
            <span className="mx-2 text-[#505050]">·</span>
            Times shown in UTC
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Assigned users" value={report.metrics.assignedUsers} />
        <MetricCard icon={<UserCheck className="h-5 w-5" />} label="Active in 7 days" value={report.metrics.activeLast7Days} tone="good" />
        <MetricCard icon={<CalendarCheck2 className="h-5 w-5" />} label="Active in 30 days" value={report.metrics.activeLast30Days} />
        <MetricCard icon={<MousePointerClick className="h-5 w-5" />} label="Leads reviewed" value={report.metrics.uniqueLeadsReviewed} tone="good" />
        <MetricCard icon={<Clock3 className="h-5 w-5" />} label="Never active" value={report.metrics.neverActive} tone="warn" />
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="border-b border-white/8 pb-5">
          <h2 className="text-[20px] font-bold text-[#ffffff]">Filter beta users</h2>
          <p className="mt-2 text-[13px] leading-5 text-[#b3b3b3]">Metrics and user cards update for the selected activity window.</p>
        </div>
        <form className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-[1.25fr_0.8fr_0.9fr_0.9fr_1.35fr_auto]" method="get">
          <FilterField label="Search">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f8f8f]" />
              <input
                className={inputClassName + " pl-10"}
                defaultValue={params.search ?? ""}
                name="search"
                placeholder="Name, email or campaign"
                type="search"
              />
            </div>
          </FilterField>
          <FilterField label="Campaign">
            <select className={inputClassName} defaultValue={params.campaignId ?? ""} name="campaignId">
              <option value="">All campaigns</option>
              {report.campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Status">
            <select className={inputClassName} defaultValue={status} name="status">
              {CLIENT_ACTIVITY_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{formatStatus(option)}</option>
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
          <div className="grid gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b3b3b3]">Custom dates</span>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="sr-only">Custom date from</span>
                <input aria-label="Custom date from" className={inputClassName} defaultValue={params.from ?? ""} name="from" type="date" />
              </label>
              <label>
                <span className="sr-only">Custom date to</span>
                <input aria-label="Custom date to" className={inputClassName} defaultValue={params.to ?? ""} name="to" type="date" />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-1 xl:self-end">
            <button className={primaryButtonClassName} type="submit">Apply</button>
            <Link className={secondaryButtonClassName} href="/admin/analytics/user-activity">Reset</Link>
          </div>
        </form>
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="flex flex-col gap-2 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-[#ffffff]">Assigned beta users</h2>
            <p className="mt-2 text-[13px] text-[#b3b3b3]">{report.rows.length} user{report.rows.length === 1 ? "" : "s"} match the filters.</p>
          </div>
          <p className="text-[11px] text-[#8f8f8f]">A reviewed lead requires expansion or a Reddit click.</p>
        </div>

        {report.rows.length === 0 ? (
          <div className="mt-5 rounded-[18px] border border-dashed border-[#3f3f46] p-6 text-[14px] leading-6 text-[#b3b3b3]">
            No assigned non-admin users match these filters.
          </div>
        ) : (
          <div className="grid gap-4 pt-5 xl:grid-cols-2">
            {report.rows.map((row) => (
              <article className="rounded-[20px] border border-white/[0.06] bg-[#121212] p-5" key={row.userId ?? row.email}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <EngagementStatusBadge status={row.engagementStatus} />
                      {!row.userId ? <span className="rounded-full bg-[#3b2d10] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffd66e]">Awaiting signup</span> : null}
                    </div>
                    <h3 className="mt-3 truncate text-[18px] font-bold text-[#ffffff]">{row.name || row.email}</h3>
                    <p className="mt-1 truncate text-[13px] text-[#b3b3b3]">{row.email}</p>
                  </div>
                  {row.userId ? (
                    <Link
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
                      href={buildUserDetailHref(row.userId, params)}
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                      View activity
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {row.campaigns.map((campaign) => (
                    <span className="rounded-full bg-[#1f1f1f] px-3 py-1.5 text-[10px] font-semibold text-[#cbcbcb]" key={campaign.id}>
                      {campaign.clientDisplayName}
                      {campaign.clientDisplayName !== campaign.internalName ? ` · ${campaign.internalName}` : ""}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniMetric label="Visits" value={row.dashboardVisits} />
                  <MiniMetric label="Active days" value={row.activeDays} />
                  <MiniMetric label="Leads reviewed" value={row.uniqueLeadsReviewed} />
                  <MiniMetric label="Reddit clicks" value={row.redditClicks} />
                </div>

                <div className="mt-4 grid gap-2 border-t border-white/8 pt-4 text-[12px] text-[#b3b3b3] sm:grid-cols-2">
                  <ActivityTime label="Last dashboard" value={row.lastDashboardAccessAt} />
                  <ActivityTime label="Last lead review" value={row.lastLeadReviewAt} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inputClassName =
  "h-11 w-full rounded-[12px] border border-white/[0.08] bg-[#101010] px-3 text-[13px] text-[#ffffff] outline-none transition-colors placeholder:text-[#686868] hover:border-white/[0.14] focus:border-[#1ed760]/60 focus:ring-2 focus:ring-[#1ed760]/15";
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
  tone?: "good" | "neutral" | "warn";
  value: number;
}) {
  const toneClass = tone === "good" ? "text-[#1ed760]" : tone === "warn" ? "text-[#ffd66e]" : "text-[#ffffff]";

  return (
    <div className="rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#121212] text-[#b3b3b3]">{icon}</div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8f8f]">{label}</p>
      <p className={`mt-2 text-[2rem] font-bold leading-none tracking-[-0.05em] ${toneClass}`}>{value.toLocaleString("en-US")}</p>
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
    <div className="rounded-[14px] bg-[#1a1a1a] px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8f8f8f]">{label}</p>
      <p className="mt-2 text-[20px] font-bold leading-none text-[#ffffff]">{value.toLocaleString("en-US")}</p>
    </div>
  );
}

function ActivityTime({ label, value }: { label: string; value: Date | null }) {
  return (
    <p>
      <span className="text-[#8f8f8f]">{label}:</span>{" "}
      <span className="font-semibold text-[#ffffff]">{value ? formatDateTimeInTimeZone(value, "UTC") : "Never"}</span>
    </p>
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
      {formatStatus(status)}
    </span>
  );
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
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

function buildUserDetailHref(userId: string, params: SearchParams) {
  const search = new URLSearchParams();

  for (const key of ["campaignId", "from", "range", "to"] as const) {
    const value = params[key];

    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return `/admin/analytics/user-activity/${userId}${query ? `?${query}` : ""}`;
}
