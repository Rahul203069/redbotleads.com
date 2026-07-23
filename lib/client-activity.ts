import { Prisma } from "../generated/prisma/client";

import { canViewAnalytics } from "@/lib/beta-access";
import {
  CLIENT_ACTIVITY_LEAD_REVIEW_TYPES,
  CLIENT_ACTIVITY_PAGE_VIEW_COALESCE_MS,
  CLIENT_ACTIVITY_PAGE_VIEW_TYPES,
  type ClientActivityEventType,
  type ClientActivityRange,
  type ClientActivityStatusFilter,
  getClientActivityEligibility,
  getClientEngagementStatus,
  isClientActivityEventShapeValid,
  isClientActivityLeadReview,
  isClientActivityPageView,
  shouldCoalesceClientPageView,
  summarizeClientActivity,
} from "@/lib/client-activity-core";
import { normalizeAccessEmail } from "@/lib/campaign-access";
import { prisma } from "@/lib/prisma";

const MIN_VISIBLE_CLIENT_LEAD_SCORE = 40;
const DETAIL_PAGE_SIZE = 50;

type ActivityEventShape = {
  createdAt: Date;
  eventType: ClientActivityEventType;
  leadId: string | null;
};

export async function recordCampaignClientActivity({
  campaignId,
  eventId,
  eventType,
  leadId,
  now = new Date(),
  sessionUserId,
}: {
  campaignId: string;
  eventId: string;
  eventType: ClientActivityEventType;
  leadId?: string;
  now?: Date;
  sessionUserId: string;
}) {
  const user = await prisma.user.findUnique({
    where: {
      id: sessionUserId,
    },
    select: {
      email: true,
      id: true,
    },
  });

  if (!user?.email) {
    return {
      recorded: false,
      reason: "USER_NOT_FOUND",
    } as const;
  }

  const normalizedEmail = normalizeAccessEmail(user.email);
  const adminEligibility = getClientActivityEligibility({
    hasAssignment: true,
    isAdmin: canViewAnalytics(user.email),
  });

  if (adminEligibility) {
    return {
      recorded: false,
      reason: adminEligibility,
    } as const;
  }

  const clientAccess = await prisma.campaignClientAccess.findUnique({
    where: {
      campaignId_normalizedEmail: {
        campaignId,
        normalizedEmail,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  const assignmentEligibility = getClientActivityEligibility({
    hasAssignment: Boolean(clientAccess),
    isAdmin: false,
  });

  if (assignmentEligibility || !clientAccess) {
    return {
      recorded: false,
      reason: assignmentEligibility ?? "NOT_ASSIGNED",
    } as const;
  }

  if (clientAccess.userId !== user.id) {
    await prisma.campaignClientAccess.update({
      where: {
        id: clientAccess.id,
      },
      data: {
        userId: user.id,
      },
    });
  }

  const isPageView = isClientActivityPageView(eventType);

  if (!isClientActivityEventShapeValid({ eventType, leadId })) {
    return {
      recorded: false,
      reason: "INVALID_EVENT",
    } as const;
  }

  if (leadId) {
    const leadExists = await prisma.lead.count({
      where: {
        id: leadId,
        campaignId,
        score: {
          gte: MIN_VISIBLE_CLIENT_LEAD_SCORE,
        },
        ai: {
          isNot: null,
        },
      },
    });

    if (leadExists === 0) {
      return {
        recorded: false,
        reason: "INVALID_LEAD",
      } as const;
    }
  }

  if (isPageView) {
    const recentView = await prisma.campaignClientActivityEvent.findFirst({
      where: {
        campaignId,
        userId: user.id,
        eventType,
        createdAt: {
          gte: new Date(now.getTime() - CLIENT_ACTIVITY_PAGE_VIEW_COALESCE_MS),
        },
      },
      select: {
        createdAt: true,
      },
    });

    if (shouldCoalesceClientPageView({
      eventType,
      lastRecordedAt: recentView?.createdAt ?? null,
      now,
    })) {
      return {
        recorded: false,
        reason: "COALESCED",
      } as const;
    }
  }

  let availableLeadCount: number | null = null;
  let newLeadCountSinceLastVisit: number | null = null;

  if (isPageView) {
    const previousVisit = await prisma.campaignClientActivityEvent.findFirst({
      where: {
        campaignId,
        userId: user.id,
        eventType: {
          in: [...CLIENT_ACTIVITY_PAGE_VIEW_TYPES],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });
    const visibleLeadWhere: Prisma.LeadWhereInput = {
      campaignId,
      score: {
        gte: MIN_VISIBLE_CLIENT_LEAD_SCORE,
      },
      ai: {
        isNot: null,
      },
    };

    [availableLeadCount, newLeadCountSinceLastVisit] = await Promise.all([
      prisma.lead.count({
        where: visibleLeadWhere,
      }),
      prisma.lead.count({
        where: {
          ...visibleLeadWhere,
          ai: {
            is: {
              createdAt: {
                gt: previousVisit?.createdAt ?? new Date(0),
                lte: now,
              },
            },
          },
        },
      }),
    ]);
  }

  try {
    const event = await prisma.campaignClientActivityEvent.create({
      data: {
        availableLeadCount,
        campaignId,
        clientAccessId: clientAccess.id,
        createdAt: now,
        eventKey: eventId,
        eventType,
        leadId: leadId ?? null,
        newLeadCountSinceLastVisit,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    return {
      eventId: event.id,
      recorded: true,
    } as const;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        recorded: false,
        reason: "DUPLICATE",
      } as const;
    }

    throw error;
  }
}

export async function getCampaignClientActivityOverview({
  campaignId,
  range,
  search,
  status,
  now = new Date(),
}: {
  campaignId?: string;
  range: ClientActivityRange;
  search?: string;
  status: ClientActivityStatusFilter;
  now?: Date;
}) {
  const allAccesses = await prisma.campaignClientAccess.findMany({
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          createdAt: true,
          email: true,
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const accesses = campaignId
    ? allAccesses.filter((access) => access.campaignId === campaignId)
    : allAccesses;
  const normalizedEmails = Array.from(new Set(accesses.map((access) => access.normalizedEmail)));
  const emailUsers = normalizedEmails.length === 0
    ? []
    : await prisma.user.findMany({
        where: {
          OR: normalizedEmails.map((email) => ({
            email: {
              equals: email,
              mode: "insensitive" as const,
            },
          })),
        },
        select: {
          createdAt: true,
          email: true,
          id: true,
          name: true,
        },
      });
  const userByEmail = new Map(
    emailUsers
      .filter((user): user is typeof user & { email: string } => Boolean(user.email))
      .map((user) => [normalizeAccessEmail(user.email), user]),
  );
  const assignments = new Map<string, {
    accesses: typeof accesses;
    email: string;
    normalizedEmail: string;
    user: (typeof emailUsers)[number] | null;
  }>();

  for (const access of accesses) {
    const user = access.user ?? userByEmail.get(access.normalizedEmail) ?? null;
    const email = user?.email ?? access.email;

    if (canViewAnalytics(email)) {
      continue;
    }

    const key = user?.id ?? `pending:${access.normalizedEmail}`;
    const existing = assignments.get(key);

    if (existing) {
      existing.accesses.push(access);
    } else {
      assignments.set(key, {
        accesses: [access],
        email,
        normalizedEmail: access.normalizedEmail,
        user,
      });
    }
  }

  const userIds = Array.from(assignments.values())
    .map((assignment) => assignment.user?.id)
    .filter((value): value is string => Boolean(value));
  const campaignIds = Array.from(new Set(accesses.map((access) => access.campaignId)));
  const eventWhere: Prisma.CampaignClientActivityEventWhereInput = {
    userId: {
      in: userIds,
    },
    campaignId: {
      in: campaignIds,
    },
  };
  const [rangeEvents, lastAny, lastViews, lastReviews] = userIds.length === 0
    ? [[], [], [], []] as const
    : await Promise.all([
        prisma.campaignClientActivityEvent.findMany({
          where: {
            ...eventWhere,
            createdAt: {
              gte: range.from,
              lt: range.to,
            },
          },
          select: {
            createdAt: true,
            eventType: true,
            leadId: true,
            userId: true,
          },
        }),
        prisma.campaignClientActivityEvent.groupBy({
          by: ["userId"],
          where: eventWhere,
          _max: {
            createdAt: true,
          },
        }),
        prisma.campaignClientActivityEvent.groupBy({
          by: ["userId"],
          where: {
            ...eventWhere,
            eventType: {
              in: [...CLIENT_ACTIVITY_PAGE_VIEW_TYPES],
            },
          },
          _max: {
            createdAt: true,
          },
        }),
        prisma.campaignClientActivityEvent.groupBy({
          by: ["userId"],
          where: {
            ...eventWhere,
            eventType: {
              in: [...CLIENT_ACTIVITY_LEAD_REVIEW_TYPES],
            },
          },
          _max: {
            createdAt: true,
          },
        }),
      ]);
  const eventsByUser = groupBy(Array.from(rangeEvents), (event) => event.userId);
  const lastAnyByUser = new Map(lastAny.map((row) => [row.userId, row._max.createdAt]));
  const lastViewByUser = new Map(lastViews.map((row) => [row.userId, row._max.createdAt]));
  const lastReviewByUser = new Map(lastReviews.map((row) => [row.userId, row._max.createdAt]));
  const normalizedSearch = String(search ?? "").trim().toLowerCase();
  const rows = Array.from(assignments.values())
    .map((assignment) => {
      const userId = assignment.user?.id ?? null;
      const events = userId
        ? (eventsByUser.get(userId) ?? []).map(toActivityEventShape)
        : [];
      const summary = summarizeClientActivity(events);
      const lastActivityAt = userId ? lastAnyByUser.get(userId) ?? null : null;
      const engagementStatus = getClientEngagementStatus(lastActivityAt, now);

      return {
        activeDays: summary.activeDays,
        assignedAt: assignment.accesses.reduce(
          (earliest, access) => access.createdAt < earliest ? access.createdAt : earliest,
          assignment.accesses[0].createdAt,
        ),
        campaigns: assignment.accesses.map((access) => ({
          clientDisplayName: access.displayName,
          id: access.campaign.id,
          internalName: access.campaign.name,
        })),
        dashboardVisits: summary.dashboardVisits,
        email: assignment.email,
        engagementStatus,
        lastActivityAt,
        lastDashboardAccessAt: userId ? lastViewByUser.get(userId) ?? null : null,
        lastLeadReviewAt: userId ? lastReviewByUser.get(userId) ?? null : null,
        leadExpansions: summary.leadExpansions,
        name: assignment.user?.name ?? null,
        redditClicks: summary.redditClicks,
        signedUpAt: assignment.user?.createdAt ?? null,
        uniqueLeadsReviewed: summary.uniqueLeadsReviewed,
        userId,
      };
    })
    .filter((row) => status === "ALL" || row.engagementStatus === status)
    .filter((row) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        row.email,
        row.name ?? "",
        ...row.campaigns.flatMap((campaign) => [campaign.clientDisplayName, campaign.internalName]),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) => {
      const leftTime = left.lastActivityAt?.getTime() ?? -1;
      const rightTime = right.lastActivityAt?.getTime() ?? -1;
      return rightTime - leftTime || left.email.localeCompare(right.email);
    });
  const allRows = Array.from(assignments.values()).map((assignment) => {
    const userId = assignment.user?.id ?? null;
    const lastActivityAt = userId ? lastAnyByUser.get(userId) ?? null : null;

    return {
      lastActivityAt,
      status: getClientEngagementStatus(lastActivityAt, now),
      userId,
    };
  });
  const reviewedLeadIds = new Set(
    rangeEvents
      .filter((event) => event.leadId && isClientActivityLeadReview(event.eventType))
      .map((event) => event.leadId as string),
  );

  return {
    campaigns: Array.from(
      new Map(
        allAccesses
          .filter((access) => !canViewAnalytics(access.user?.email ?? access.email))
          .map((access) => [
          access.campaign.id,
          {
            id: access.campaign.id,
            name: access.campaign.name,
          },
          ]),
      ).values(),
    ).sort((left, right) => left.name.localeCompare(right.name)),
    metrics: {
      activeLast30Days: allRows.filter((row) =>
        row.lastActivityAt && now.getTime() - row.lastActivityAt.getTime() <= 30 * 24 * 60 * 60 * 1000
      ).length,
      activeLast7Days: allRows.filter((row) =>
        row.lastActivityAt && now.getTime() - row.lastActivityAt.getTime() <= 7 * 24 * 60 * 60 * 1000
      ).length,
      assignedUsers: allRows.length,
      neverActive: allRows.filter((row) => row.status === "NEVER_ACTIVE").length,
      uniqueLeadsReviewed: reviewedLeadIds.size,
    },
    rows,
  };
}

export async function getCampaignClientActivityDetail({
  campaignId,
  page,
  range,
  userId,
  now = new Date(),
}: {
  campaignId?: string;
  page: number;
  range: ClientActivityRange;
  userId: string;
  now?: Date;
}) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      createdAt: true,
      email: true,
      id: true,
      name: true,
    },
  });

  if (!user?.email || canViewAnalytics(user.email)) {
    return null;
  }

  const normalizedEmail = normalizeAccessEmail(user.email);
  const accesses = await prisma.campaignClientAccess.findMany({
    where: {
      normalizedEmail,
      ...(campaignId ? { campaignId } : {}),
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (accesses.length === 0) {
    return null;
  }

  const assignedCampaignIds = accesses.map((access) => access.campaignId);
  const baseWhere: Prisma.CampaignClientActivityEventWhereInput = {
    campaignId: {
      in: assignedCampaignIds,
    },
    userId: user.id,
  };
  const rangeWhere: Prisma.CampaignClientActivityEventWhereInput = {
    ...baseWhere,
    createdAt: {
      gte: range.from,
      lt: range.to,
    },
  };
  const currentPage = Math.max(1, Math.floor(page));
  const skip = (currentPage - 1) * DETAIL_PAGE_SIZE;
  const [rangeEvents, timeline, totalEvents, allTimeEvents] = await Promise.all([
    prisma.campaignClientActivityEvent.findMany({
      where: rangeWhere,
      select: {
        campaignId: true,
        createdAt: true,
        eventType: true,
        leadId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.campaignClientActivityEvent.findMany({
      where: rangeWhere,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        lead: {
          select: {
            id: true,
            label: true,
            score: true,
            redditItem: {
              select: {
                subreddit: true,
                title: true,
                body: true,
                url: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: DETAIL_PAGE_SIZE,
    }),
    prisma.campaignClientActivityEvent.count({
      where: rangeWhere,
    }),
    prisma.campaignClientActivityEvent.findMany({
      where: baseWhere,
      select: {
        createdAt: true,
        eventType: true,
        leadId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);
  const allTimeSummary = summarizeClientActivity(allTimeEvents.map(toActivityEventShape));
  const rangeSummary = summarizeClientActivity(rangeEvents.map(toActivityEventShape));
  const lastActivityAt = allTimeEvents.at(-1)?.createdAt ?? null;
  const lastDashboardAccessAt = findLastEventAt(allTimeEvents, (event) => isClientActivityPageView(event.eventType));
  const lastLeadReviewAt = findLastEventAt(allTimeEvents, (event) => isClientActivityLeadReview(event.eventType));
  const accessByCampaignId = new Map(accesses.map((access) => [access.campaignId, access]));
  const campaignBreakdown = accesses.map((access) => {
    const events = rangeEvents
      .filter((event) => event.campaignId === access.campaignId)
      .map(toActivityEventShape);
    const summary = summarizeClientActivity(events);

    return {
      activeDays: summary.activeDays,
      clientDisplayName: access.displayName,
      dashboardVisits: summary.dashboardVisits,
      id: access.campaignId,
      internalName: access.campaign.name,
      redditClicks: summary.redditClicks,
      uniqueLeadsReviewed: summary.uniqueLeadsReviewed,
    };
  });
  const trendByDay = new Map<string, {
    dashboardVisits: number;
    day: string;
    label: string;
    leadReviews: number;
  }>();

  for (const event of rangeEvents) {
    const day = event.createdAt.toISOString().slice(0, 10);
    const row = trendByDay.get(day) ?? {
      dashboardVisits: 0,
      day,
      label: formatTrendDate(event.createdAt),
      leadReviews: 0,
    };

    if (isClientActivityPageView(event.eventType)) {
      row.dashboardVisits += 1;
    }

    if (isClientActivityLeadReview(event.eventType)) {
      row.leadReviews += 1;
    }

    trendByDay.set(day, row);
  }

  const totalPages = Math.max(1, Math.ceil(totalEvents / DETAIL_PAGE_SIZE));

  return {
    allTime: {
      activeDays: allTimeSummary.activeDays,
      dashboardVisits: allTimeSummary.dashboardVisits,
      engagementStatus: getClientEngagementStatus(lastActivityAt, now),
      lastActivityAt,
      lastDashboardAccessAt,
      lastLeadReviewAt,
      uniqueLeadsReviewed: allTimeSummary.uniqueLeadsReviewed,
    },
    campaignBreakdown,
    campaigns: accesses.map((access) => ({
      clientDisplayName: access.displayName,
      id: access.campaignId,
      internalName: access.campaign.name,
    })),
    pagination: {
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      page: currentPage,
      totalEvents,
      totalPages,
    },
    range: {
      activeDays: rangeSummary.activeDays,
      dashboardVisits: rangeSummary.dashboardVisits,
      leadExpansions: rangeSummary.leadExpansions,
      redditClicks: rangeSummary.redditClicks,
      uniqueLeadsReviewed: rangeSummary.uniqueLeadsReviewed,
    },
    timeline: timeline.map((event) => {
      const access = accessByCampaignId.get(event.campaignId);

      return {
        availableLeadCount: event.availableLeadCount,
        campaignDisplayName: access?.displayName ?? event.campaign.name,
        campaignId: event.campaignId,
        createdAt: event.createdAt,
        eventType: event.eventType,
        id: event.id,
        lead: event.lead
          ? {
              id: event.lead.id,
              label: event.lead.label,
              score: event.lead.score,
              subreddit: event.lead.redditItem.subreddit,
              title: event.lead.redditItem.title ?? event.lead.redditItem.body ?? "Untitled Reddit item",
              url: event.lead.redditItem.url,
            }
          : null,
        newLeadCountSinceLastVisit: event.newLeadCountSinceLastVisit,
      };
    }),
    trendRows: Array.from(trendByDay.values()).sort((left, right) => left.day.localeCompare(right.day)),
    user: {
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
    },
  };
}

function groupBy<T, K>(values: T[], keyOf: (value: T) => K) {
  const result = new Map<K, T[]>();

  for (const value of values) {
    const key = keyOf(value);
    const group = result.get(key);

    if (group) {
      group.push(value);
    } else {
      result.set(key, [value]);
    }
  }

  return result;
}

function toActivityEventShape(event: {
  createdAt: Date;
  eventType: ClientActivityEventType;
  leadId: string | null;
}): ActivityEventShape {
  return {
    createdAt: event.createdAt,
    eventType: event.eventType,
    leadId: event.leadId,
  };
}

function findLastEventAt<T extends ActivityEventShape>(events: T[], predicate: (event: T) => boolean) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (predicate(events[index])) {
      return events[index].createdAt;
    }
  }

  return null;
}

function formatTrendDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(value);
}
