import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { isValidRedditUsername, normalizeRedditUsername, OUTREACH_MIN_SCORE } from "@/lib/outreach-core";
import {
  buildOutreachLeadCreatedWhere,
  getAdminOutreachRun,
  getOutreachAdmin,
  outreachDateFilterSchema,
  serializeOutreachRun,
  validatePublicLeadsUrl,
} from "@/lib/outreach";
import { prisma } from "@/lib/prisma";

const createRunSchema = z.object({
  campaignId: z.string().trim().min(1).max(128),
  redditUsername: z.string().trim().min(1).max(32),
  publicLeadsUrl: z.string().url().max(2048),
  extensionVersion: z.string().trim().max(32).optional(),
  dateFilter: outreachDateFilterSchema,
});

export async function POST(request: Request) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const input = await parseJson(request);
  const parsed = createRunSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid run request." }, { status: 400 });
  if (!isValidRedditUsername(parsed.data.redditUsername)) {
    return NextResponse.json({ error: "Enter a valid Reddit username." }, { status: 400 });
  }

  const publicLeadsUrl = validatePublicLeadsUrl(parsed.data.publicLeadsUrl, parsed.data.campaignId, request.url);
  if (!publicLeadsUrl) return NextResponse.json({ error: "The public leads link is invalid." }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: parsed.data.campaignId, userId: admin.userId },
    select: { id: true, outreachSettings: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (!campaign.outreachSettings?.firstTouchInstructions || !campaign.outreachSettings.followUpInstructions) {
    return NextResponse.json({ error: "Save first-touch and follow-up instructions before starting." }, { status: 409 });
  }

  const normalizedUsername = normalizeRedditUsername(parsed.data.redditUsername);
  const redditAccount = await prisma.redditAccount.upsert({
    where: { userId_redditUser: { userId: admin.userId, redditUser: normalizedUsername } },
    create: { userId: admin.userId, redditUser: normalizedUsername },
    update: {},
  });
  const activeRun = await prisma.outreachRun.findFirst({
    where: { redditAccountId: redditAccount.id, status: { in: ["QUEUED", "RUNNING", "PAUSED", "LIMIT_REACHED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (activeRun) {
    return NextResponse.json({ error: "This Reddit account already has an active outreach run.", runId: activeRun.id }, { status: 409 });
  }

  const leadDateWhere = buildOutreachLeadCreatedWhere(parsed.data.dateFilter);
  const leads = await prisma.lead.findMany({
    where: {
      campaignId: campaign.id,
      score: { gte: OUTREACH_MIN_SCORE },
      ai: { isNot: null },
      redditItem: { is: { type: "POST", url: { not: null } } },
      ...leadDateWhere,
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    select: { id: true, redditItemId: true },
  });

  const run = await prisma.$transaction(async (tx) => {
    await tx.campaign.update({ where: { id: campaign.id }, data: { redditAccountId: redditAccount.id } });
    return tx.outreachRun.create({
      data: {
        userId: admin.userId,
        campaignId: campaign.id,
        redditAccountId: redditAccount.id,
        status: leads.length ? "RUNNING" : "COMPLETED",
        filterJson: parsed.data.dateFilter as Prisma.InputJsonValue,
        publicLeadsUrl,
        extensionVersion: parsed.data.extensionVersion,
        queuedPosts: leads.length,
        startedAt: new Date(),
        completedAt: leads.length ? null : new Date(),
        posts: { create: leads.map((lead) => ({ leadId: lead.id, redditItemId: lead.redditItemId })) },
      },
    });
  });
  const hydrated = await getAdminOutreachRun(run.id, admin.userId);
  return NextResponse.json({ run: hydrated ? serializeOutreachRun(hydrated) : null }, { status: 201 });
}

async function parseJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}
