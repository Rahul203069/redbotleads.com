import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DailyLeadsDateFilter } from "@/components/admin/daily-leads-date-filter";
import { DailyLeadsReport } from "@/components/admin/daily-leads-report";
import { DailyLeadsSemanticFilter } from "@/components/admin/daily-leads-semantic-filter";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import {
  type DailyLeadSemanticStatusFilter,
  getDailyLeadAnalytics,
  getDailyLeadDateRange,
  parseDailyLeadSemanticStatus,
  parseDailyLeadsPage,
} from "@/lib/daily-leads-analytics";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  from?: string;
  page?: string;
  status?: string;
  to?: string;
};

export default async function CampaignDailyLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
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
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (!campaign) {
    notFound();
  }

  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const range = getDailyLeadDateRange(resolvedSearchParams);
  const page = parseDailyLeadsPage(resolvedSearchParams.page);
  const semanticStatus = parseDailyLeadSemanticStatus(resolvedSearchParams.status);
  const analytics = await getDailyLeadAnalytics({
    campaignId: campaign.id,
    from: range.from,
    page,
    semanticStatus,
    to: range.to,
    userId: session.user.id,
  });

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">Daily leads</p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">{campaign.name}</h1>
            <p className="mt-3 max-w-[72ch] text-[15px] leading-6 text-[#cbcbcb]">
              {campaign.description || "Daily semantic filtering, AI scoring, and notification results for this campaign."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
            <DailyLeadsDateFilter />
            <DailyLeadsSemanticFilter
              currentStatus={semanticStatus}
              hrefForStatus={(targetStatus) =>
                buildCampaignDailyLeadsHref({
                  campaignId: campaign.id,
                  from: range.from,
                  page: 1,
                  status: targetStatus,
                  to: range.to,
                })
              }
            />
            <Link href={`/campaigns/${campaign.id}`}>
              <Button
                className="h-10 rounded-full border-none bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525]"
                variant="secondary"
              >
                Back
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <DailyLeadsReport
        analytics={analytics}
        pageHref={(targetPage) =>
          buildCampaignDailyLeadsHref({
            campaignId: campaign.id,
            from: range.from,
            page: targetPage,
            status: semanticStatus,
            to: range.to,
          })
        }
      />
    </div>
  );
}

function buildCampaignDailyLeadsHref({
  campaignId,
  from,
  page,
  status,
  to,
}: {
  campaignId: string;
  from: Date;
  page: number;
  status?: DailyLeadSemanticStatusFilter;
  to: Date;
}) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    page: String(page),
  });

  if (status && status !== "ALL") {
    params.set("status", status);
  }

  return `/campaigns/${campaignId}/daily-leads?${params.toString()}`;
}
