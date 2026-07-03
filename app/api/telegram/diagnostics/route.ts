import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTelegramWebhookInfo } from "@/lib/telegram";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const expectedWebhookUrl = buildExpectedWebhookUrl();
  const [latestPairing, webhookInfoResult] = await Promise.all([
    prisma.telegramPairing.findFirst({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        expiresAt: true,
        usedAt: true,
      },
    }),
    getWebhookInfoResult(),
  ]);

  return NextResponse.json({
    ok: true,
    env: {
      hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      hasBotUsername: Boolean(process.env.TELEGRAM_BOT_USERNAME?.trim()),
      hasWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
      nextAuthUrl: process.env.NEXTAUTH_URL?.trim() || null,
    },
    expectedWebhookUrl,
    latestPairing: latestPairing
      ? {
          createdAt: latestPairing.createdAt.toISOString(),
          expiresAt: latestPairing.expiresAt.toISOString(),
          isExpired: latestPairing.expiresAt.getTime() <= Date.now(),
          isUsed: Boolean(latestPairing.usedAt),
          usedAt: latestPairing.usedAt?.toISOString() ?? null,
        }
      : null,
    webhookInfo: {
      ...webhookInfoResult,
      matchesExpectedUrl:
        webhookInfoResult.ok && expectedWebhookUrl
          ? webhookInfoResult.url === expectedWebhookUrl
          : false,
    },
  });
}

async function getWebhookInfoResult() {
  try {
    const info = await getTelegramWebhookInfo();

    return {
      ok: true,
      allowedUpdates: info.allowed_updates ?? null,
      hasCustomCertificate: info.has_custom_certificate ?? null,
      ipAddress: info.ip_address ?? null,
      lastErrorDate: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
      lastErrorMessage: info.last_error_message ?? null,
      lastSynchronizationErrorDate: info.last_synchronization_error_date
        ? new Date(info.last_synchronization_error_date * 1000).toISOString()
        : null,
      maxConnections: info.max_connections ?? null,
      pendingUpdateCount: info.pending_update_count ?? null,
      url: info.url ?? "",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not fetch Telegram webhook info.",
    };
  }
}

function buildExpectedWebhookUrl() {
  const baseUrl = process.env.NEXTAUTH_URL?.trim();

  if (!baseUrl) {
    return null;
  }

  try {
    return new URL("/api/telegram/webhook", baseUrl).toString();
  } catch {
    return null;
  }
}
