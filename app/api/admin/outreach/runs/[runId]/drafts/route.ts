import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRollingWindowStart,
  isValidRedditUsername,
  normalizeRedditUsername,
  OUTREACH_ROLLING_LIMIT,
  resolveOutreachEligibility,
  validateOutreachMessage,
} from "@/lib/outreach-core";
import { getOutreachAdmin, recountOutreachRun } from "@/lib/outreach";
import { prisma } from "@/lib/prisma";

const draftSchema = z.object({
  username: z.string().trim().max(64),
  sourceCommentId: z.string().trim().max(128).optional(),
  sourceCommentUrl: z.string().url().max(2048).optional(),
  stage: z.enum(["INITIAL", "FOLLOW_UP"]),
  qualificationReason: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(500),
});
const schema = z.object({
  runPostId: z.string().trim().min(1).max(128),
  drafts: z.array(draftSchema).max(25),
});

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const { runId } = await context.params;
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid drafts." }, { status: 400 });

  const run = await prisma.outreachRun.findFirst({
    where: { id: runId, userId: admin.userId },
    include: { posts: { where: { id: parsed.data.runPostId }, select: { id: true, redditItemId: true } } },
  });
  if (!run || !run.posts[0]) return NextResponse.json({ error: "Run post not found." }, { status: 404 });
  if (run.status !== "RUNNING") return NextResponse.json({ error: `Run is ${run.status.toLowerCase()}.` }, { status: 409 });

  const deduped = [...new Map(parsed.data.drafts.map((draft) => [normalizeRedditUsername(draft.username), draft])).entries()];
  for (const [username, draft] of deduped) {
    if (!isValidRedditUsername(username)) return NextResponse.json({ error: `Invalid Reddit username: ${draft.username}` }, { status: 400 });
    const messageError = validateOutreachMessage(draft.message, run.publicLeadsUrl);
    if (messageError) return NextResponse.json({ error: `${draft.username}: ${messageError}` }, { status: 400 });
  }

  const attempts = await prisma.$transaction(async (tx) => {
    const sent = await tx.outreachAttempt.count({
      where: { status: "SENT", sentAt: { gte: getRollingWindowStart() }, contact: { is: { redditAccountId: run.redditAccountId } } },
    });
    const remaining = Math.max(0, OUTREACH_ROLLING_LIMIT - sent);
    if (remaining === 0) {
      await tx.outreachRun.update({ where: { id: run.id }, data: { status: "LIMIT_REACHED" } });
      return [];
    }

    const created = [];
    for (const [normalizedUsername, draft] of deduped.slice(0, remaining)) {
      const contact = await tx.outreachContact.upsert({
        where: { redditAccountId_normalizedUsername: { redditAccountId: run.redditAccountId, normalizedUsername } },
        create: { redditAccountId: run.redditAccountId, normalizedUsername, displayUsername: draft.username.replace(/^u\//i, "") },
        update: { displayUsername: draft.username.replace(/^u\//i, "") },
      });
      const eligibility = resolveOutreachEligibility(contact);
      if (!eligibility.eligible || eligibility.stage !== draft.stage) continue;

      const attempt = await tx.outreachAttempt.upsert({
        where: { contactId_stage: { contactId: contact.id, stage: draft.stage } },
        create: {
          runId: run.id,
          runPostId: run.posts[0].id,
          campaignId: run.campaignId,
          contactId: contact.id,
          sourceRedditItemId: run.posts[0].redditItemId,
          sourceCommentId: draft.sourceCommentId,
          sourceCommentUrl: draft.sourceCommentUrl,
          stage: draft.stage,
          status: "AWAITING_APPROVAL",
          qualificationReason: draft.qualificationReason,
          message: draft.message,
          publicLeadsUrl: run.publicLeadsUrl,
        },
        update: {
          runId: run.id,
          runPostId: run.posts[0].id,
          campaignId: run.campaignId,
          sourceRedditItemId: run.posts[0].redditItemId,
          sourceCommentId: draft.sourceCommentId,
          sourceCommentUrl: draft.sourceCommentUrl,
          status: "AWAITING_APPROVAL",
          qualificationReason: draft.qualificationReason,
          message: draft.message,
          publicLeadsUrl: run.publicLeadsUrl,
          error: null,
        },
      });
      created.push({
        ...attempt,
        username: contact.displayUsername,
        normalizedUsername: contact.normalizedUsername,
      });
    }

    await tx.outreachRunPost.update({
      where: { id: run.posts[0].id },
      data: {
        status: created.length ? "READY" : "SKIPPED",
        selectedCount: created.length,
        completedAt: created.length ? null : new Date(),
      },
    });
    await recountOutreachRun(tx, run.id);
    if (created.length === 0) {
      const activePosts = await tx.outreachRunPost.count({
        where: { runId: run.id, status: { in: ["QUEUED", "SCANNING", "GENERATING", "READY"] } },
      });
      if (activePosts === 0) {
        await tx.outreachRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      }
    }
    return created;
  });

  if (deduped.length > 0 && attempts.length === 0) {
    return NextResponse.json({ error: "No draft remained eligible, or the rolling limit was reached.", attempts: [] }, { status: 409 });
  }
  return NextResponse.json({ attempts });
}

async function parseJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}
