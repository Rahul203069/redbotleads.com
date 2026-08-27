import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return noStoreJson({ error: "Authentication required." }, 401);
  }

  const pairingId = new URL(request.url).searchParams.get("pairingId")?.trim();

  if (!pairingId) {
    return noStoreJson({ error: "Pairing ID is required." }, 400);
  }

  const pairing = await prisma.telegramPairing.findFirst({
    where: {
      id: pairingId,
      userId: session.user.id,
    },
    select: {
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          telegramChatId: true,
          telegramConnectedAt: true,
          telegramUsername: true,
        },
      },
    },
  });

  if (!pairing) {
    return noStoreJson({ error: "Telegram connection was not found." }, 404);
  }

  if (pairing.usedAt && pairing.user.telegramChatId && pairing.user.telegramConnectedAt) {
    return noStoreJson({
      status: "connected",
      telegramUsername: pairing.user.telegramUsername,
    });
  }

  if (pairing.expiresAt.getTime() <= Date.now()) {
    return noStoreJson({ status: "expired" });
  }

  return noStoreJson({ status: "pending" });
}

function noStoreJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
