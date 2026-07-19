import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_SHARE_VISITOR_COOKIE,
  PUBLIC_SHARE_VISITOR_COOKIE_MAX_AGE,
  hashPublicShareVisitorToken,
  isPublicShareVisitorToken,
  shouldTrackPublicShareView,
} from "@/lib/public-share-analytics-core";
import { recordPublicShareView } from "@/lib/public-share-analytics";

const publicShareViewRequestSchema = z.object({
  campaignId: z.string().trim().min(1).max(128),
  kind: z.enum(["campaign", "leads"]),
});

export async function POST(request: NextRequest) {
  const input = await parseRequest(request);

  if (!input) {
    return NextResponse.json({ error: "Invalid tracking request." }, { status: 400 });
  }

  const [campaign, session] = await Promise.all([
    prisma.campaign.findUnique({
      where: {
        id: input.campaignId,
      },
      select: {
        id: true,
        userId: true,
      },
    }),
    auth(),
  ]);

  if (!campaign || !shouldTrackPublicShareView({
    campaignOwnerId: campaign.userId,
    sessionUserId: session?.user?.id,
  })) {
    return new NextResponse(null, { status: 204 });
  }

  const existingToken = request.cookies.get(PUBLIC_SHARE_VISITOR_COOKIE)?.value;
  const visitorToken = isPublicShareVisitorToken(existingToken) ? existingToken : randomUUID();

  try {
    await recordPublicShareView({
      campaignId: campaign.id,
      kind: input.kind,
      visitorHash: hashPublicShareVisitorToken(visitorToken),
    });
  } catch (error) {
    console.error("Could not record public share view", {
      campaignId: campaign.id,
      error,
      kind: input.kind,
    });

    return new NextResponse(null, { status: 204 });
  }

  const response = new NextResponse(null, { status: 204 });

  if (visitorToken !== existingToken) {
    response.cookies.set(PUBLIC_SHARE_VISITOR_COOKIE, visitorToken, {
      httpOnly: true,
      maxAge: PUBLIC_SHARE_VISITOR_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

async function parseRequest(request: NextRequest) {
  try {
    const result = publicShareViewRequestSchema.safeParse(await request.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
