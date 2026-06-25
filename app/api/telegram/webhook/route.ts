import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

type TelegramWebhookUpdate = {
  message?: {
    chat?: {
      id?: number | string;
      username?: string;
    };
    from?: {
      username?: string;
    };
    text?: string;
  };
};

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const actualSecret = request.headers.get("x-telegram-bot-api-secret-token")?.trim();

  if (expectedSecret && actualSecret !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json()) as TelegramWebhookUpdate;
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() ?? "";

  if (!chatId || !text.startsWith("/start")) {
    return NextResponse.json({ ok: true });
  }

  const code = text.split(/\s+/)[1]?.trim();

  if (!code) {
    await safeTelegramReply(String(chatId), "Open Telegram from the Connect Telegram button in Redbot Leads.");
    return NextResponse.json({ ok: true });
  }

  const pairing = await prisma.telegramPairing.findFirst({
    where: {
      code,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!pairing) {
    await safeTelegramReply(String(chatId), "This Telegram connection link is expired. Please generate a new one in settings.");
    return NextResponse.json({ ok: true });
  }

  const username = update.message?.from?.username ?? update.message?.chat?.username ?? null;

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: pairing.userId,
      },
      data: {
        telegramChatId: String(chatId),
        telegramConnectedAt: new Date(),
        telegramUsername: username,
      },
    }),
    prisma.telegramPairing.update({
      where: {
        id: pairing.id,
      },
      data: {
        usedAt: new Date(),
      },
    }),
  ]);

  await safeTelegramReply(String(chatId), "Telegram connected. Lead alerts can now be sent here.");

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

async function safeTelegramReply(chatId: string, text: string) {
  try {
    await sendTelegramMessage({
      chatId,
      text,
      disableWebPagePreview: true,
    });
  } catch (error) {
    console.error("Telegram webhook reply failed", error);
  }
}
