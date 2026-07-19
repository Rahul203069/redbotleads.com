import { prisma } from "@/lib/prisma";
import {
  buildPublicShareViewStats,
  getPublicShareViewCounters,
  type PublicShareViewKind,
  type PublicShareViewStats,
} from "@/lib/public-share-analytics-core";

export async function recordPublicShareView({
  campaignId,
  kind,
  visitorHash,
}: {
  campaignId: string;
  kind: PublicShareViewKind;
  visitorHash: string;
}) {
  const counters = getPublicShareViewCounters(kind);

  await prisma.campaignPublicVisitor.upsert({
    where: {
      campaignId_visitorHash: {
        campaignId,
        visitorHash,
      },
    },
    create: {
      campaignId,
      visitorHash,
      ...counters,
    },
    update: kind === "campaign"
      ? {
          campaignViews: {
            increment: 1,
          },
        }
      : {
          leadsViews: {
            increment: 1,
          },
        },
  });
}

export async function getPublicShareViewStats(campaignId: string): Promise<PublicShareViewStats> {
  const [totals, campaignUniqueVisitors, leadsUniqueVisitors] = await Promise.all([
    prisma.campaignPublicVisitor.aggregate({
      where: {
        campaignId,
      },
      _count: true,
      _sum: {
        campaignViews: true,
        leadsViews: true,
      },
    }),
    prisma.campaignPublicVisitor.count({
      where: {
        campaignId,
        campaignViews: {
          gt: 0,
        },
      },
    }),
    prisma.campaignPublicVisitor.count({
      where: {
        campaignId,
        leadsViews: {
          gt: 0,
        },
      },
    }),
  ]);

  return buildPublicShareViewStats({
    campaignUniqueVisitors,
    campaignViews: totals._sum.campaignViews ?? 0,
    leadsUniqueVisitors,
    leadsViews: totals._sum.leadsViews ?? 0,
    overallUniqueVisitors: totals._count,
  });
}
