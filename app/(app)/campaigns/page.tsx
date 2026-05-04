import { redirect } from "next/navigation";

import { CampaignList } from "@/components/campaigns/campaign-list";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
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
          ai: {
            select: {
              leadId: true,
            },
          },
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
  const subredditCount = new Set(campaigns.flatMap((campaign) => campaign.subreddits)).size;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
              Campaigns
            </p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
              Targeting workspace
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
              Create and manage the campaign rules that decide which Reddit conversations
              enter your lead pipeline.
            </p>
          </div>
          <CampaignWizard triggerLabel="Create campaign" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Total" value={String(campaigns.length).padStart(2, "0")} />
        <MetricCard label="Active" value={String(activeCount).padStart(2, "0")} />
        <MetricCard label="Subreddits" value={String(subredditCount).padStart(2, "0")} />
      </section>

      {campaigns.length === 0 ? (
        <section className="rounded-[24px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-8">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
              Empty state
            </p>
            <h2 className="mt-3 text-[1.8rem] font-bold tracking-[-0.04em] text-[#ffffff]">
              No campaigns yet
            </h2>
            <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
              Start with one focused campaign. Add the offer context, keywords, subreddits,
              and score threshold, then refine from there.
            </p>
            <div className="mt-6">
              <CampaignWizard triggerLabel="Create first campaign" />
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
          <div className="flex flex-col gap-2 border-b border-white/8 pb-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
              Inventory
            </p>
            <p className="text-[15px] leading-6 text-[#cbcbcb]">
              Active and paused campaigns in this workspace.
            </p>
          </div>
          <div className="pt-4">
            <CampaignList
              campaigns={campaigns.map((campaign) => {
                const classifiedLeads = campaign.leads.filter((lead) => lead.ai !== null);

                return {
                  id: campaign.id,
                  name: campaign.name,
                  leadType: campaign.leadType,
                  isActive: campaign.isActive,
                  description: campaign.description,
                  strongLeads: classifiedLeads.filter((lead) => lead.label === "HIGH").length,
                  partialLeads: classifiedLeads.filter((lead) => lead.label !== "HIGH").length,
                  sync: campaign.sync
                    ? {
                        status: campaign.sync.status,
                        stage: campaign.sync.stage,
                        message: campaign.sync.message,
                        updatedAt: campaign.sync.updatedAt.toISOString(),
                      }
                    : null,
                };
              })}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#181818] px-5 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">{label}</p>
      <p className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{value}</p>
    </div>
  );
}
