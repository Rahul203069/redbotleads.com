export type TelegramSendMessageInput = {
  chatId: string;
  text: string;
  disableWebPagePreview?: boolean;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; url: string }>>;
  };
};

type TelegramErrorResponse = {
  ok?: false;
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
};

type TelegramWebhookInfoResponse =
  | {
      ok: true;
      result: {
        url?: string;
        has_custom_certificate?: boolean;
        pending_update_count?: number;
        ip_address?: string;
        last_error_date?: number;
        last_error_message?: string;
        last_synchronization_error_date?: number;
        max_connections?: number;
        allowed_updates?: string[];
      };
    }
  | {
      ok: false;
      description?: string;
      error_code?: number;
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
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
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

export async function getTelegramWebhookInfo() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!token) {
    throw new Error("Telegram bot token is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
    cache: "no-store",
  });
  const details = await response.text();
  const payload = parseTelegramWebhookInfo(details);

  if (!response.ok || !payload?.ok) {
    throw new TelegramApiError({
      status: response.status,
      statusText: response.statusText,
      description: payload && !payload.ok ? payload.description : undefined,
      rawBody: details,
    });
  }

  return payload.result;
}

function parseTelegramError(value: string) {
  try {
    return JSON.parse(value) as TelegramErrorResponse;
  } catch {
    return null;
  }
}

function parseTelegramWebhookInfo(value: string) {
  try {
    return JSON.parse(value) as TelegramWebhookInfoResponse;
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
