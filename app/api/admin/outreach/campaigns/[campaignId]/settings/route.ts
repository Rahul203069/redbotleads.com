import { NextResponse } from "next/server";

import { getOutreachAdmin, outreachSettingsSchema } from "@/lib/outreach";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ campaignId: string }> }) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const { campaignId } = await context.params;
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: admin.userId },
    select: { id: true, name: true, description: true, redditAccount: { select: { redditUser: true } }, outreachSettings: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  return NextResponse.json({
    campaign: { id: campaign.id, name: campaign.name, description: campaign.description },
    redditUsername: campaign.redditAccount?.redditUser ?? null,
    settings: campaign.outreachSettings ?? {
      firstTouchInstructions: "Write a concise, specific introduction that references the service the commenter offers. Be helpful and low pressure.",
      firstTouchExamples: "Saw your comment about offering [service]. I found a few relevant opportunities you may want to review: [public link]",
      followUpInstructions: "Write one respectful follow-up. Mention the earlier note without implying that the recipient owes a reply.",
      followUpExamples: "Quick follow-up in case this is useful for your work—these opportunities are still available here: [public link]",
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const admin = await getOutreachAdmin();
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const { campaignId } = await context.params;
  const input = await parseJson(request);
  const parsed = outreachSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid outreach settings." }, { status: 400 });
  }

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId: admin.userId }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const settings = await prisma.campaignOutreachSettings.upsert({
    where: { campaignId },
    create: { campaignId, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ settings });
}

async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
