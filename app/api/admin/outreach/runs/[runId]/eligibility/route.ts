import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRollingWindowStart,
  isValidRedditUsername,
  normalizeRedditUsername,
  OUTREACH_COMMENT_LIMIT,
  OUTREACH_ROLLING_LIMIT,
  resolveOutreachEligibility,
} from "@/lib/outreach-core";
import { countRecentSentMessages, getOutreachAdmin } from "@/lib/outreach";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  runPostId: z.string().trim().min(1).max(128),
  authors: z.array(z.object({ username: z.string().trim().max(64) })).max(OUTREACH_COMMENT_LIMIT),
});

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const { runId } = await context.params;
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid author list." }, { status: 400 });

  const run = await prisma.outreachRun.findFirst({
    where: { id: runId, userId: admin.userId },
    include: {
      campaign: { select: { name: true, description: true, outreachSettings: true } },
      redditAccount: { select: { redditUser: true } },
      posts: {
        where: { id: parsed.data.runPostId },
        select: { id: true, redditItem: { select: { author: true } } },
      },
    },
  });
  if (!run || !run.posts[0]) return NextResponse.json({ error: "Run post not found." }, { status: 404 });
  if (run.status !== "RUNNING") return NextResponse.json({ error: `Run is ${run.status.toLowerCase()}.` }, { status: 409 });

  const sent = await countRecentSentMessages(run.redditAccountId, getRollingWindowStart());
  const allowance = Math.max(0, OUTREACH_ROLLING_LIMIT - sent);
  if (allowance === 0) {
    await prisma.outreachRun.update({ where: { id: run.id }, data: { status: "LIMIT_REACHED" } });
    return NextResponse.json({ error: "The 25-message rolling limit has been reached.", allowance: 0 }, { status: 429 });
  }

  const excluded = new Set([
    normalizeRedditUsername(run.redditAccount.redditUser),
    normalizeRedditUsername(run.posts[0].redditItem.author ?? ""),
    "automoderator",
    "deleted",
  ]);
  const uniqueAuthors = [...new Map(parsed.data.authors.map((author) => [normalizeRedditUsername(author.username), author.username])).entries()]
    .filter(([normalized]) => isValidRedditUsername(normalized) && !excluded.has(normalized));
  const contacts = uniqueAuthors.length
    ? await prisma.outreachContact.findMany({
        where: { redditAccountId: run.redditAccountId, normalizedUsername: { in: uniqueAuthors.map(([name]) => name) } },
      })
    : [];
  const contactByUsername = new Map(contacts.map((contact) => [contact.normalizedUsername, contact]));
  const authors = uniqueAuthors.map(([normalizedUsername, username]) => ({
    username,
    normalizedUsername,
    ...resolveOutreachEligibility(contactByUsername.get(normalizedUsername) ?? null),
  }));

  await prisma.outreachRunPost.update({
    where: { id: run.posts[0].id },
    data: { status: "GENERATING", commentCount: parsed.data.authors.length, startedAt: new Date(), error: null },
  });
  return NextResponse.json({
    allowance,
    authors,
    campaign: { name: run.campaign.name, description: run.campaign.description },
    settings: run.campaign.outreachSettings,
    publicLeadsUrl: run.publicLeadsUrl,
    constraints: { commentLimit: OUTREACH_COMMENT_LIMIT, messageLimit: 500 },
  });
}

async function parseJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}
