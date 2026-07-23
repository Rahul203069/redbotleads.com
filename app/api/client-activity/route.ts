import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { CLIENT_ACTIVITY_EVENT_TYPES } from "@/lib/client-activity-core";
import { recordCampaignClientActivity } from "@/lib/client-activity";

const clientActivitySchema = z.object({
  campaignId: z.string().trim().min(1).max(128),
  eventId: z.string().uuid(),
  eventType: z.enum(CLIENT_ACTIVITY_EVENT_TYPES),
  leadId: z.string().trim().min(1).max(128).optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const input = await parseRequest(request);

  if (!input) {
    return NextResponse.json({ error: "Invalid activity event." }, { status: 400 });
  }

  try {
    await recordCampaignClientActivity({
      campaignId: input.campaignId,
      eventId: input.eventId,
      eventType: input.eventType,
      leadId: input.leadId,
      sessionUserId: session.user.id,
    });
  } catch (error) {
    console.error("Could not record assigned-client activity", {
      campaignId: input.campaignId,
      eventType: input.eventType,
      error,
    });
  }

  return new NextResponse(null, { status: 204 });
}

async function parseRequest(request: Request) {
  try {
    const result = clientActivitySchema.safeParse(await request.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
