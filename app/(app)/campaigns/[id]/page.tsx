import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BetaCampaignAccessButton } from "@/components/campaigns/beta-campaign-access-button";
import { CampaignDetailLiveSections } from "@/components/campaigns/campaign-detail-live-sections";
import { CopyPublicCampaignLinkButton } from "@/components/campaigns/copy-public-campaign-link-button";
import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { EditCampaignDialog } from "@/components/campaigns/edit-campaign-dialog";
import { ExportCampaignLeadsButton } from "@/components/campaigns/export-campaign-leads-button";
import { ManualSyncButton } from "@/components/campaigns/manual-sync-button";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getCampaignInitialRssDiagnostics } from "@/actions/campaigns";
import { isOwnerEmail } from "@/lib/beta-access";
import { getCampaignLeadViewsForUser } from "@/lib/campaign-leads";
import { prisma } from "@/lib/prisma";
import { reconcileCampaignSyncState } from "@/worker/sync-reconcile";

const MIN_VISIBLE_LEAD_SCORE = 40;

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

  const sync = await reconcileCampaignSyncState(campaign.id);

  const lastSyncSource =
    sync?.completedAt ??
    sync?.failedAt ??
    sync?.lastHeartbeat ??
    campaign.updatedAt;
  const nextSyncSource = new Date(lastSyncSource.getTime() + 24 * 60 * 60 * 1000);
  const nextSync = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(nextSyncSource);
  const initialLeads = await getCampaignLeadViewsForUser({
    campaignId: campaign.id,
    userId: session.user.id,
  });
  const initialDiagnostics = await getCampaignInitialRssDiagnostics(campaign.id);
  const classifiedLeads = initialLeads.filter((lead) => lead.ai !== null && lead.score >= MIN_VISIBLE_LEAD_SCORE);
  const leadCount = classifiedLeads.length;
  const highIntentCount = classifiedLeads.filter((lead) => lead.label === "HIGH").length;
  const canRunCampaigns = isOwnerEmail(session.user.email);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Link className="w-full sm:w-auto" href="/campaigns">
              <Button
                className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
                variant="secondary"
              >
                <BackIcon />
                Back to campaigns
              </Button>
            </Link>
            <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-stretch lg:justify-end">
              <CopyPublicCampaignLinkButton campaignId={campaign.id} />
              <ExportCampaignLeadsButton campaignId={campaign.id} campaignName={campaign.name} />
              {canRunCampaigns ? (
                <ManualSyncButton campaignId={campaign.id} disabled={!campaign.isActive} />
              ) : (
                <BetaCampaignAccessButton label="Manual sync" />
              )}
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
              <DeleteCampaignDialog campaignId={campaign.id} campaignName={campaign.name} />
            </div>
          </div>

          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.75rem]">
              {campaign.name}
            </h1>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-6 text-[#cbcbcb] sm:truncate">
              {campaign.description || "No campaign description added yet."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <HeroChip label={`${campaign.subreddits.length} subreddit${campaign.subreddits.length === 1 ? "" : "s"}`} />
              <HeroChip label={`${leadCount} lead${leadCount === 1 ? "" : "s"} tracked`} />
              <HeroChip label={`${highIntentCount} strong match${highIntentCount === 1 ? "" : "es"}`} />
            </div>
          </div>
        </div>
        </div>
      </section>

      <CampaignDetailLiveSections
        campaignId={campaign.id}
        initialDiagnostics={initialDiagnostics}
        initialLeads={classifiedLeads}
        initialSync={
          sync
            ? {
                status: sync.status,
                stage: sync.stage,
                message: sync.message,
                lastError: sync.lastError,
                queuedAt: sync.queuedAt?.toISOString() ?? null,
                startedAt: sync.startedAt?.toISOString() ?? null,
                completedAt: sync.completedAt?.toISOString() ?? null,
                failedAt: sync.failedAt?.toISOString() ?? null,
                lastHeartbeat: sync.lastHeartbeat?.toISOString() ?? null,
                statsJson: sync.statsJson as {
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
                updatedAt: sync.updatedAt.toISOString(),
              }
            : null
        }
        nextSyncLabel={nextSync}
      />
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
