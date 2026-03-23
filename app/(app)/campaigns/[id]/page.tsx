import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CampaignLeadsLiveSection } from "@/components/campaigns/campaign-leads-live-section";
import { CampaignSyncPanel } from "@/components/campaigns/campaign-sync-panel";
import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { EditCampaignDialog } from "@/components/campaigns/edit-campaign-dialog";
import { ExportCampaignLeadsButton } from "@/components/campaigns/export-campaign-leads-button";
import { ManualSyncButton } from "@/components/campaigns/manual-sync-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getCampaignLeadViewsForUser } from "@/lib/campaign-leads";
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
        include: {
          ai: {
            select: {
              category: true,
              summary: true,
              painPoints: true,
            },
          },
          redditItem: true,
        },
      },
      sync: {
        select: {
          status: true,
          stage: true,
          message: true,
          lastError: true,
          queuedAt: true,
          startedAt: true,
          completedAt: true,
          failedAt: true,
          lastHeartbeat: true,
          statsJson: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const lastSyncSource = campaign.sync?.completedAt ?? campaign.sync?.failedAt ?? campaign.sync?.lastHeartbeat ?? campaign.updatedAt;
  const lastSync = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(lastSyncSource);
  const nextSync = campaign.isActive ? "Awaiting worker" : "Paused";
  const initialLeads = await getCampaignLeadViewsForUser({
    campaignId: campaign.id,
    userId: session.user.id,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#27312E] bg-[#111716]/92 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[#d4d4d8]">Campaign detail</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#F3F5F4] lg:text-4xl">{campaign.name}</h1>
            <p className="mt-3 max-w-3xl truncate text-sm leading-7 text-[#9DA9A4] lg:text-base">
              {campaign.description || "No campaign description added yet."}
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-3 lg:max-w-[50%] lg:justify-end">
            <Link className="w-full sm:w-auto" href="/campaigns">
              <Button className="w-full sm:w-auto" variant="secondary">
                <BackIcon />
                Back to campaigns
              </Button>
            </Link>
            <ExportCampaignLeadsButton campaignId={campaign.id} campaignName={campaign.name} />
            <ManualSyncButton campaignId={campaign.id} disabled={!campaign.isActive} />
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
                recentDays: campaign.recentDays,
                minScoreToAlert: campaign.minScoreToAlert,
                isActive: campaign.isActive,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr_1fr]">
        <MetricCard label="Last sync" value={lastSync} />
        <MetricCard label="Next sync" value={nextSync} />
      </div>

      <CampaignSyncPanel
        campaignId={campaign.id}
        initialSync={
          campaign.sync
            ? {
                status: campaign.sync.status,
                stage: campaign.sync.stage,
                message: campaign.sync.message,
                lastError: campaign.sync.lastError,
                queuedAt: campaign.sync.queuedAt?.toISOString() ?? null,
                startedAt: campaign.sync.startedAt?.toISOString() ?? null,
                completedAt: campaign.sync.completedAt?.toISOString() ?? null,
                failedAt: campaign.sync.failedAt?.toISOString() ?? null,
                lastHeartbeat: campaign.sync.lastHeartbeat?.toISOString() ?? null,
                statsJson: campaign.sync.statsJson as {
                  fetchedPosts?: number;
                  promisingPosts?: number;
                  fetchedComments?: number;
                  matchedItems?: number;
                  createdLeads?: number;
                  embeddedLeads?: number;
                  semanticCheckedLeads?: number;
                  semanticPassedLeads?: number;
                  semanticFilteredLeads?: number;
                  classifiedLeads?: number;
                  durationMs?: number;
                } | null,
                updatedAt: campaign.sync.updatedAt.toISOString(),
              }
            : null
        }
      />

      <CampaignLeadsLiveSection
        campaignId={campaign.id}
        initialLeads={initialLeads}
        initialSyncStatus={campaign.sync?.status ?? "IDLE"}
      />
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
