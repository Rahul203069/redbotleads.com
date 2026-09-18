import { NextResponse } from "next/server";
import { z } from "zod";

import { getRollingWindowStart, OUTREACH_ROLLING_LIMIT, resolveOutreachEligibility } from "@/lib/outreach-core";
import { getOutreachAdmin, recountOutreachRun } from "@/lib/outreach";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  status: z.enum(["AWAITING_APPROVAL", "SENT", "SKIPPED", "FAILED"]),
  error: z.string().trim().max(1000).optional(),
  doNotContact: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const { attemptId } = await context.params;
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attempt update." }, { status: 400 });

  const attempt = await prisma.outreachAttempt.findFirst({
    where: { id: attemptId, run: { is: { userId: admin.userId } } },
    include: { contact: true, run: true },
  });
  if (!attempt) return NextResponse.json({ error: "Outreach attempt not found." }, { status: 404 });
  if (attempt.status === "SENT" && parsed.data.status === "SENT") return NextResponse.json({ attempt });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.status === "SENT") {
        const sent = await tx.outreachAttempt.count({
          where: {
            status: "SENT",
            sentAt: { gte: getRollingWindowStart() },
            contact: { is: { redditAccountId: attempt.run.redditAccountId } },
          },
        });
        if (sent >= OUTREACH_ROLLING_LIMIT) throw new Error("ROLLING_LIMIT");
        const eligibility = resolveOutreachEligibility(attempt.contact);
        if (!eligibility.eligible || eligibility.stage !== attempt.stage) throw new Error("NO_LONGER_ELIGIBLE");
      }

      const now = new Date();
      const next = await tx.outreachAttempt.update({
        where: { id: attempt.id },
        data: {
          status: parsed.data.status,
          error: parsed.data.error ?? null,
          approvedAt: parsed.data.status === "AWAITING_APPROVAL" ? now : attempt.approvedAt,
          sentAt: parsed.data.status === "SENT" ? now : attempt.sentAt,
        },
      });
      if (parsed.data.doNotContact || parsed.data.status === "SENT") {
        await tx.outreachContact.update({
          where: { id: attempt.contactId },
          data: {
            ...(parsed.data.doNotContact ? { doNotContact: true } : {}),
            ...(parsed.data.status === "SENT"
              ? {
                  firstSentAt: attempt.stage === "INITIAL" ? now : attempt.contact.firstSentAt,
                  followUpSentAt: attempt.stage === "FOLLOW_UP" ? now : attempt.contact.followUpSentAt,
                  lastSentAt: now,
                }
              : {}),
          },
        });
      }
      if (parsed.data.status === "SENT") {
        await tx.lead.updateMany({
          where: { campaignId: attempt.campaignId, redditItemId: attempt.sourceRedditItemId },
          data: { status: "CONTACTED" },
        });
      }

      if (attempt.runPostId && ["SENT", "SKIPPED", "FAILED"].includes(parsed.data.status)) {
        const remaining = await tx.outreachAttempt.count({
          where: { runPostId: attempt.runPostId, id: { not: attempt.id }, status: { in: ["DRAFT", "AWAITING_APPROVAL"] } },
        });
        if (remaining === 0) {
          await tx.outreachRunPost.update({
            where: { id: attempt.runPostId },
            data: { status: "COMPLETED", completedAt: now },
          });
        }
      }
      await recountOutreachRun(tx, attempt.runId);
      const activePosts = await tx.outreachRunPost.count({
        where: { runId: attempt.runId, status: { in: ["QUEUED", "SCANNING", "GENERATING", "READY"] } },
      });
      if (activePosts === 0) {
        await tx.outreachRun.update({ where: { id: attempt.runId }, data: { status: "COMPLETED", completedAt: now } });
      }
      return next;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ attempt: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ROLLING_LIMIT") {
      await prisma.outreachRun.update({ where: { id: attempt.runId }, data: { status: "LIMIT_REACHED" } });
      return NextResponse.json({ error: "The 25-message rolling limit has been reached." }, { status: 429 });
    }
    if (message === "NO_LONGER_ELIGIBLE") {
      return NextResponse.json({ error: "This recipient is no longer eligible for this message stage." }, { status: 409 });
    }
    console.error("Outreach attempt update failed", { attemptId, error });
    return NextResponse.json({ error: "Could not update the outreach attempt." }, { status: 500 });
  }
}

async function parseJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}
