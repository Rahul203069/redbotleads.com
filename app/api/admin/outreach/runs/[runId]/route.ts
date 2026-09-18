import { NextResponse } from "next/server";
import { z } from "zod";

import { getRollingWindowStart, OUTREACH_ROLLING_LIMIT } from "@/lib/outreach-core";
import { countRecentSentMessages, getAdminOutreachRun, getOutreachAdmin, serializeOutreachRun } from "@/lib/outreach";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  action: z.enum(["pause", "resume", "stop"]),
  error: z.string().trim().max(1000).optional(),
});

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const { runId } = await context.params;
  const run = await getAdminOutreachRun(runId, admin.userId);
  if (!run) return NextResponse.json({ error: "Outreach run not found." }, { status: 404 });
  const sentLast24Hours = await countRecentSentMessages(run.redditAccountId, getRollingWindowStart());
  return NextResponse.json({ run: serializeOutreachRun(run), allowance: Math.max(0, OUTREACH_ROLLING_LIMIT - sentLast24Hours) });
}

export async function PATCH(request: Request, context: { params: Promise<{ runId: string }> }) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const { runId } = await context.params;
  const parsed = updateSchema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Choose pause, resume, or stop." }, { status: 400 });
  const existing = await prisma.outreachRun.findFirst({ where: { id: runId, userId: admin.userId } });
  if (!existing) return NextResponse.json({ error: "Outreach run not found." }, { status: 404 });

  let status: "PAUSED" | "RUNNING" | "STOPPED";
  if (parsed.data.action === "stop") status = "STOPPED";
  else if (parsed.data.action === "pause") status = "PAUSED";
  else {
    const sent = await countRecentSentMessages(existing.redditAccountId, getRollingWindowStart());
    if (sent >= OUTREACH_ROLLING_LIMIT) {
      return NextResponse.json({ error: "The 25-message rolling limit is still active." }, { status: 429 });
    }
    status = "RUNNING";
  }

  await prisma.outreachRun.update({
    where: { id: runId },
    data: {
      status,
      ...(parsed.data.error ? { lastError: parsed.data.error } : {}),
      ...(status === "STOPPED" ? { stoppedAt: new Date() } : {}),
      ...(status === "RUNNING" ? { lastError: null, startedAt: existing.startedAt ?? new Date() } : {}),
    },
  });
  const run = await getAdminOutreachRun(runId, admin.userId);
  return NextResponse.json({ run: run ? serializeOutreachRun(run) : null });
}

async function parseJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}
