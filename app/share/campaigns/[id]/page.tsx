import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicCampaignLeadViews, type CampaignLeadView } from "@/lib/campaign-leads";
import { prisma } from "@/lib/prisma";

const MIN_VISIBLE_LEAD_SCORE = 40;

export const metadata: Metadata = {
  title: "Shared Campaign Results",
  description: "Public campaign lead results.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicCampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      leadType: true,
      description: true,
      subreddits: true,
      updatedAt: true,
      sync: {
        select: {
          status: true,
          updatedAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const leads = (await getPublicCampaignLeadViews(campaign.id))
    .filter((lead) => lead.ai !== null && lead.score >= MIN_VISIBLE_LEAD_SCORE)
    .sort((left, right) => right.score - left.score);
  const highIntentCount = leads.filter((lead) => lead.label === "HIGH").length;
  const lastUpdated = campaign.sync?.completedAt ?? campaign.sync?.updatedAt ?? campaign.updatedAt;

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-5 text-[#fdfdfd] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="rounded-[28px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] sm:p-7 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <HeroChip label="Shared results" />
                <HeroChip label={campaign.leadType.toLowerCase()} />
                {campaign.sync?.status ? <HeroChip label={campaign.sync.status.toLowerCase()} /> : null}
              </div>
              <h1 className="mt-5 text-[2rem] font-bold leading-tight tracking-[-0.04em] text-[#fdfdfd] sm:text-[2.5rem] lg:text-[3rem]">
                {campaign.name}
              </h1>
              <p className="mt-4 max-w-[70ch] text-[15px] leading-6 text-[#cbcbcb]">
                {campaign.description || "No campaign description was added."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <Metric label="Qualified leads" value={String(leads.length)} />
              <Metric label="High intent" value={String(highIntentCount)} />
              <Metric label="Subreddits" value={String(campaign.subreddits.length)} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/8 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            <span>Updated {formatDate(lastUpdated.toISOString())}</span>
            {campaign.subreddits.slice(0, 6).map((subreddit) => (
              <span key={subreddit}>r/{subreddit}</span>
            ))}
            {campaign.subreddits.length > 6 ? <span>+{campaign.subreddits.length - 6} more</span> : null}
          </div>
        </section>

        <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
          <div className="border-b border-white/8 pb-5">
            <h2 className="text-[24px] font-bold tracking-tight text-[#ffffff]">Qualified leads</h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
              These Reddit items passed semantic matching and LLM classification for this campaign.
            </p>
          </div>

          <div className="space-y-4 pt-5">
            {leads.length === 0 ? (
              <EmptyState />
            ) : (
              leads.map((lead) => <PublicLeadCard key={lead.id} lead={lead} />)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function PublicLeadCard({ lead }: { lead: CampaignLeadView }) {
  const sourceText = getContentPreview(lead.redditItem.body, lead.redditItem.description);

  return (
    <article className="rounded-[22px] bg-[linear-gradient(180deg,#1f1f1f_0%,#1a1a1a_100%)] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{lead.redditItem.type}</Badge>
            <Badge tone={lead.label === "HIGH" ? "good" : lead.label === "MED" ? "neutral" : "muted"}>{lead.label}</Badge>
            {lead.ai?.category ? <Badge tone="neutral">{lead.ai.category}</Badge> : null}
          </div>
          <div>
            <h3 className="text-[17px] font-semibold leading-6 text-[#fdfdfd]">
              {lead.redditItem.title || sourceText || "Untitled Reddit item"}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
              <span>r/{lead.redditItem.subreddit}</span>
              <span>Scored {formatDate(lead.createdAt)}</span>
              {lead.ai?.intentType ? <span>{formatEnumLabel(lead.ai.intentType)}</span> : null}
              {lead.ai?.buyerStage ? <span>{formatEnumLabel(lead.ai.buyerStage)}</span> : null}
            </div>
          </div>

          <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <p className="text-[14px] leading-6 text-[#cbcbcb]">
              {lead.ai?.summary?.trim() || "No summary available for this lead."}
            </p>
          </div>

          {sourceText ? (
            <div className="border-t border-white/8 pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Source text</div>
              <p className="mt-2 text-[14px] leading-6 text-[#bdbdbd]">{sourceText}</p>
            </div>
          ) : null}

          {lead.redditItem.url ? (
            <div className="flex pt-1 sm:justify-end">
              <a
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1ed760] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] sm:w-auto"
                href={lead.redditItem.url}
                rel="noreferrer"
                target="_blank"
              >
                View on Reddit
              </a>
            </div>
          ) : null}
        </div>
        <div className="w-full rounded-[18px] bg-[#121212] px-4 py-3 text-left shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:w-auto sm:min-w-[112px] sm:text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Score</div>
          <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{lead.score}</div>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.04em] text-[#ffffff]">{value}</div>
    </div>
  );
}

function HeroChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#121212] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      {label}
    </span>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "neutral" | "muted";
}) {
  const className =
    tone === "good"
      ? "bg-[#121212] text-[#1ed760]"
      : tone === "muted"
        ? "bg-[#121212] text-[#b3b3b3]"
        : "bg-[#121212] text-[#fdfdfd]";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}>
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[22px] bg-[#1f1f1f] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">No qualified leads</p>
      <h3 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[#ffffff]">No leads are ready to share yet.</h3>
      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
        This campaign does not currently have classified leads above the public visibility threshold.
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

function getContentPreview(body: string | null, description: string | null) {
  const content = (body?.trim() || description?.trim() || "").replace(/\s+/g, " ").trim();

  if (!content) {
    return "";
  }

  if (content.length <= 280) {
    return content;
  }

  return `${content.slice(0, 277)}...`;
}

function formatEnumLabel(value: string) {
  return value.replace(/_/g, " ");
}
