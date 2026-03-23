import { redirect } from "next/navigation";

import { CampaignList } from "@/components/campaigns/campaign-list";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CampaignsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      leads: {
        select: {
          label: true,
        },
      },
      sync: {
        select: {
          status: true,
          stage: true,
          message: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const activeCount = campaigns.filter((campaign) => campaign.isActive).length;

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#27272a] bg-[linear-gradient(180deg,rgba(17,17,19,0.94),rgba(10,10,11,0.96))] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.46)] lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#d4d4d8]">Campaign targeting</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#F8FAFC] lg:text-4xl">Campaigns</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#a1a1aa] lg:text-base">
              Define the keywords, subreddits, and thresholds that decide which Reddit posts and comments become
              candidate leads for your workspace.
            </p>
          </div>
          {campaigns.length > 0 ? <CampaignWizard triggerLabel="Create campaign" /> : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <MetricCard label="Total campaigns" value={String(campaigns.length).padStart(2, "0")} />
        <MetricCard label="Active campaigns" value={String(activeCount).padStart(2, "0")} />
        <MetricCard label="Tracked subreddits" value={String(new Set(campaigns.flatMap((campaign) => campaign.subreddits)).size).padStart(2, "0")} />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns created yet</CardTitle>
            <CardDescription>
              Start with one focused campaign. The step-by-step flow will ask for each required targeting field and
              save the finished campaign to your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[24px] border border-dashed border-[#27272a] bg-[#111113] px-6 py-10 text-center">
              <div className="mx-auto max-w-2xl">
                <p className="text-sm uppercase tracking-[0.28em] text-[#d4d4d8]">Empty workspace</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#F8FAFC]">
                  No campaign created yet
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#a1a1aa]">
                  Create your first campaign to define the product or service you are tracking, the intent keywords to
                  match, the subreddits to monitor, and the score threshold that will later drive alerts.
                </p>
                <div className="mt-8 flex justify-center">
                  <CampaignWizard triggerLabel="Create campaign" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Live inventory</CardTitle>
            <CardDescription>
              Current user-scoped campaigns. This becomes the control center for targeting once ingestion is wired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignList
              campaigns={campaigns.map((campaign) => ({
                id: campaign.id,
                name: campaign.name,
                leadType: campaign.leadType,
                isActive: campaign.isActive,
                description: campaign.description,
                strongLeads: campaign.leads.filter((lead) => lead.label === "HIGH").length,
                partialLeads: campaign.leads.filter((lead) => lead.label !== "HIGH").length,
                sync: campaign.sync
                  ? {
                      status: campaign.sync.status,
                      stage: campaign.sync.stage,
                      message: campaign.sync.message,
                      updatedAt: campaign.sync.updatedAt.toISOString(),
                    }
                  : null,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">{label}</div>
        <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#F8FAFC]">{value}</div>
      </CardContent>
    </Card>
  );
}
