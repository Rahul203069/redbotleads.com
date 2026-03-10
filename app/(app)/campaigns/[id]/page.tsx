import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { EditCampaignDialog } from "@/components/campaigns/edit-campaign-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      leads: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
        include: {
          redditItem: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const strongMatches = campaign.leads.filter((lead) => lead.label === "HIGH").length;
  const partialMatches = campaign.leads.filter((lead) => lead.label !== "HIGH").length;
  const lastSync = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(campaign.updatedAt);
  const nextSync = campaign.isActive ? "Awaiting worker" : "Paused";

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#27312E] bg-[#111716]/92 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#7BF179]">Campaign detail</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#F3F5F4] lg:text-4xl">{campaign.name}</h1>
            <p className="mt-3 max-w-3xl truncate text-sm leading-7 text-[#9DA9A4] lg:text-base">
              {campaign.description || "No campaign description added yet."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/campaigns">
              <Button variant="secondary">
                <BackIcon />
                Back to campaigns
              </Button>
            </Link>
            <DeleteCampaignDialog campaignId={campaign.id} campaignName={campaign.name} />
            <EditCampaignDialog
              campaign={{
                id: campaign.id,
                name: campaign.name,
                leadType: campaign.leadType,
                description: campaign.description,
                keywords: campaign.keywords,
                negativeKeywords: campaign.negativeKeywords,
                subreddits: campaign.subreddits,
                minScoreToAlert: campaign.minScoreToAlert,
                isActive: campaign.isActive,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr_1fr]">
        <MetricCard label="Strong match" value={String(strongMatches)} />
        <MetricCard label="Partial match" value={String(partialMatches)} />
        <MetricCard label="Last sync" value={lastSync} />
        <MetricCard label="Next sync" value={nextSync} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads found</CardTitle>
          <CardDescription>Matched Reddit items for this campaign. Full lead management can grow here next.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaign.leads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#27312E] bg-[#111716] px-4 py-8 text-sm leading-6 text-[#9DA9A4]">
              No leads found yet. Once ingestion is wired, matched posts and comments will appear here.
            </div>
          ) : (
            campaign.leads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-[#27312E] bg-[#111716] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#27312E] bg-[#161D1B] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#F3F5F4]">
                      {lead.redditItem.type}
                    </span>
                    <span className="rounded-full border border-[#2b5a36] bg-[#142219] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#7BF179]">
                      {lead.label}
                    </span>
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-[#6F7C77]">Score {lead.score}</span>
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-[#F3F5F4]">
                  {lead.redditItem.title || lead.redditItem.body || "Untitled Reddit item"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#6F7C77]">
                  <span>r/{lead.redditItem.subreddit}</span>
                  <span>{lead.status}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">{label}</div>
        <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#F3F5F4]">{value}</div>
      </CardContent>
    </Card>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M15 18 9 12l6-6M10 12h10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
