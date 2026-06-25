export type TelegramSendMessageInput = {
  chatId: string;
  text: string;
  disableWebPagePreview?: boolean;
};

type TelegramErrorResponse = {
  ok?: false;
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
};

export class TelegramApiError extends Error {
  status: number;
  description?: string;
  retryAfterSeconds?: number;

  constructor(input: {
    status: number;
    statusText: string;
    description?: string;
    retryAfterSeconds?: number;
    rawBody?: string;
  }) {
    super(input.description || input.rawBody || `Telegram returned ${input.status} ${input.statusText}`);
    this.name = "TelegramApiError";
    this.status = input.status;
    this.description = input.description;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export function isTelegramRateLimitError(error: unknown): error is TelegramApiError & { retryAfterSeconds: number } {
  return error instanceof TelegramApiError && error.status === 429 && typeof error.retryAfterSeconds === "number";
}

export async function sendTelegramMessage(input: TelegramSendMessageInput) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!token) {
    throw new Error("Telegram bot token is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: input.disableWebPagePreview ?? false,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    const payload = parseTelegramError(details);

    throw new TelegramApiError({
      status: response.status,
      statusText: response.statusText,
      description: payload?.description,
      retryAfterSeconds: payload?.parameters?.retry_after,
      rawBody: details,
    });
  }

  return response.json() as Promise<unknown>;
}

function parseTelegramError(value: string) {
  try {
    return JSON.parse(value) as TelegramErrorResponse;
  } catch {
    return null;
  }
}

export function getTelegramBotStartUrl(code: string) {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");

  if (!username) {
    throw new Error("Telegram bot username is not configured.");
  }

  return `https://t.me/${username}?start=${encodeURIComponent(code)}`;
}
