import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { SemanticQueryEditor } from "@/components/admin/semantic-query-editor";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  campaignId?: string;
};

export default async function AdminSemanticQueriesPage({
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
  const campaigns = await prisma.campaign.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      leadType: true,
      description: true,
      isActive: true,
      subreddits: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      semanticQueries: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          queryText: true,
          category: true,
        },
      },
    },
  });
  const selectedCampaignId =
    campaigns.find((campaign) => campaign.id === params.campaignId)?.id
    ?? campaigns[0]?.id
    ?? null;

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[24px] bg-[#181818] px-5 py-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:px-6 lg:py-6">
        <div className="max-w-3xl">
          <Link
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#121212] px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] hover:text-[#ffffff]"
            href="/admin/analytics"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Link>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Admin analytics</p>
          <h1 className="mt-2 flex items-center gap-3 text-[1.85rem] font-bold text-[#ffffff] lg:text-[2.2rem]">
            <Search className="h-7 w-7 text-[#1ed760]" />
            Semantic queries
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
            Edit the live semantic search strings used by campaign workers.
          </p>
        </div>
      </section>

      <SemanticQueryEditor
        campaigns={campaigns.map((campaign) => ({
          ...campaign,
          owner: campaign.user.email ?? campaign.user.name ?? "No owner email",
        }))}
        selectedCampaignId={selectedCampaignId}
      />
    </div>
  );
}
