import Link from "next/link";
import { redirect } from "next/navigation";

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
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const activeCount = campaigns.filter((campaign) => campaign.isActive).length;

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#27312E] bg-[#111716]/92 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#7BF179]">Campaign targeting</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#F3F5F4] lg:text-4xl">Campaigns</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9DA9A4] lg:text-base">
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
            <div className="rounded-[24px] border border-dashed border-[#27312E] bg-[#111716] px-6 py-10 text-center">
              <div className="mx-auto max-w-2xl">
                <p className="text-sm uppercase tracking-[0.28em] text-[#7BF179]">Empty workspace</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#F3F5F4]">
                  No campaign created yet
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#9DA9A4]">
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
          <CardContent className="space-y-4">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="block rounded-2xl border border-[#27312E] bg-[#111716] p-4 transition-colors hover:border-[#3A4843]"
              >
                {(() => {
                  const strongLeads = campaign.leads.filter((lead) => lead.label === "HIGH").length;
                  const partialLeads = campaign.leads.length - strongLeads;

                  return (
                    <>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-[#F3F5F4]">{campaign.name}</h3>
                          <Badge>{campaign.leadType}</Badge>
                          <Badge tone={campaign.isActive ? "active" : "muted"}>{campaign.isActive ? "Active" : "Paused"}</Badge>
                        </div>
                        <p className="mt-2 max-w-xl truncate text-sm leading-6 text-[#9DA9A4]">
                          {campaign.description || "No campaign description added yet."}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#6F7C77]">
                        <span>Strong leads {strongLeads}</span>
                        <span>Partial leads {partialLeads}</span>
                      </div>
                    </>
                  );
                })()}
              </Link>
            ))}
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
        <div className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">{label}</div>
        <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#F3F5F4]">{value}</div>
      </CardContent>
    </Card>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "active" | "muted" }) {
  const className =
    tone === "active"
      ? "border-[#2b5a36] bg-[#142219] text-[#7BF179]"
      : tone === "muted"
        ? "border-[#27312E] bg-[#161D1B] text-[#9DA9A4]"
        : "border-[#27312E] bg-[#161D1B] text-[#F3F5F4]";

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${className}`}>{children}</span>;
}
