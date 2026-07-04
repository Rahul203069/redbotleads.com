import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/app/brand-logo";
import { PublicCampaignLeadCards } from "@/components/campaigns/public-campaign-lead-cards";
import {
  PUBLIC_CAMPAIGN_MIN_VISIBLE_LEAD_SCORE,
  getPublicCampaignLeadViews,
} from "@/lib/campaign-leads";
import { getDailyLeadDateRange } from "@/lib/daily-leads-analytics";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Shared Leads",
  description: "Public lead results.",
  robots: {
    index: false,
    follow: false,
  },
};

type SearchParams = {
  from?: string;
  range?: string;
  to?: string;
};

export default async function PublicLeadsOnlyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { id } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const leadRange = getDailyLeadDateRange(
    resolvedSearchParams.range || resolvedSearchParams.from || resolvedSearchParams.to
      ? resolvedSearchParams
      : { range: "all" },
  );
  const campaign = await prisma.campaign.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      subreddits: true,
      updatedAt: true,
      sync: {
        select: {
          updatedAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const leads = (await getPublicCampaignLeadViews({
    campaignId: campaign.id,
    from: leadRange.from,
    to: leadRange.to,
  }))
    .filter((lead) => lead.ai !== null)
    .sort((left, right) => right.score - left.score);
  const lastUpdated = campaign.sync?.completedAt ?? campaign.sync?.updatedAt ?? campaign.updatedAt;
  const sharedDateLabel = leadRange.source === "all" ? null : formatSharedDateRange(leadRange.from, leadRange.to);

  return (
    <main className="min-h-screen bg-[#050505] px-3 py-3 text-[#fdfdfd] sm:px-6 sm:py-5 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-[20px] bg-[#181818] px-4 py-4 shadow-[rgba(0,0,0,0.35)_0px_8px_16px] sm:flex-row sm:items-center sm:justify-between sm:rounded-[24px] sm:px-5">
          <div className="min-w-0">
            <BrandLogo className="block text-[1.45rem] font-semibold leading-none tracking-[-0.07em] sm:text-[1.65rem]" />
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
              Public leads report
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-[#121212] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            Leads-only view
          </span>
        </header>

        <section className="rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] sm:rounded-[28px] sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <HeroChip label="Shared leads" />
            {sharedDateLabel ? <HeroChip label={sharedDateLabel} /> : null}
            <HeroChip label={`${leads.length} lead${leads.length === 1 ? "" : "s"}`} />
          </div>
          <h1 className="mt-5 text-[1.85rem] font-bold leading-tight text-[#fdfdfd] sm:text-[2.5rem] lg:text-[3rem]">
            Classified leads
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-[#cbcbcb]">
            These Reddit items scored {PUBLIC_CAMPAIGN_MIN_VISIBLE_LEAD_SCORE}+ and were classified by the LLM.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/8 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3] sm:gap-3 sm:tracking-[0.18em]">
            <span>Updated {formatDate(lastUpdated.toISOString())}</span>
            {campaign.subreddits.slice(0, 6).map((subreddit) => (
              <span key={subreddit}>r/{subreddit}</span>
            ))}
            {campaign.subreddits.length > 6 ? <span>+{campaign.subreddits.length - 6} more</span> : null}
          </div>
        </section>

        <section className="rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] sm:rounded-[24px] sm:p-5 lg:p-6">
          <div className="space-y-4">
            {leads.length === 0 ? (
              <EmptyState />
            ) : (
              <PublicCampaignLeadCards leads={leads} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#121212] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[22px] bg-[#1f1f1f] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">No classified leads</p>
      <h3 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[#ffffff]">No scored leads are ready to share yet.</h3>
      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
        There are no classified leads at or above the public share threshold for this view.
      </p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSharedDateRange(from: Date, to: Date) {
  const end = new Date(to.getTime() - 1);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (
    from.getFullYear() === end.getFullYear()
    && from.getMonth() === end.getMonth()
    && from.getDate() === end.getDate()
  ) {
    return `Leads for ${formatter.format(from)}`;
  }

  return `${formatter.format(from)} - ${formatter.format(end)}`;
}
