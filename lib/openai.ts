const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const DEFAULT_OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
const DEFAULT_OPENAI_EMBEDDING_DIMENSIONS = Number.parseInt(
  process.env.OPENAI_EMBEDDING_DIMENSIONS?.trim() || "1536",
  10,
);
const MAX_RETRY_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;
const OPENAI_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.OPENAI_REQUEST_TIMEOUT_MS?.trim() || "45000",
  10,
);
const OPENAI_CHAT_CONCURRENCY = parsePositiveInteger(process.env.OPENAI_CHAT_CONCURRENCY, 10);
const OPENAI_EMBEDDING_CONCURRENCY = parsePositiveInteger(process.env.OPENAI_EMBEDDING_CONCURRENCY, 3);

class RequestLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire() {
    if (this.active < this.concurrency) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiting.shift();

    if (next) {
      next();
    }
  }
}

const structuredOutputLimiter = new RequestLimiter(OPENAI_CHAT_CONCURRENCY);
const embeddingLimiter = new RequestLimiter(OPENAI_EMBEDDING_CONCURRENCY);

type WebSearchRequest = {
  enabled?: boolean;
  searchContextSize?: "low" | "medium" | "high";
  userLocation?: {
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
  };
};

type StructuredOutputRequest = {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  model?: string;
  webSearch?: WebSearchRequest;
};

type StructuredOutputResponse = {
  content: string;
  model: string;
};

type EmbeddingRequest = {
  input: string;
  model?: string;
  dimensions?: number;
};

type EmbeddingResponse = {
  embedding: number[];
  model: string;
  dimensions: number;
};

type EmbeddingsRequest = {
  input: string[];
  model?: string;
  dimensions?: number;
};

type EmbeddingsResponse = {
  embeddings: number[][];
  model: string;
  dimensions: number;
};

export async function generateStructuredOutput(
  request: StructuredOutputRequest,
): Promise<StructuredOutputResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = request.model?.trim() || DEFAULT_OPENAI_MODEL;
  const content = await structuredOutputLimiter.run(() =>
    request.webSearch?.enabled
      ? requestWithWebSearchRetry({
          apiKey,
          attempt: 0,
          model,
          schema: request.schema,
          schemaName: request.schemaName,
          systemPrompt: request.systemPrompt,
          temperature: request.temperature ?? 0.1,
          userPrompt: request.userPrompt,
          webSearch: request.webSearch,
        })
      : requestWithRetry({
          apiKey,
          attempt: 0,
          model,
          schema: request.schema,
          schemaName: request.schemaName,
          systemPrompt: request.systemPrompt,
          temperature: request.temperature ?? 0.1,
          userPrompt: request.userPrompt,
          webSearch: request.webSearch,
        }),
  );

  return {
    content,
    model,
  };
}

export async function generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
  const response = await generateEmbeddings({
    input: [request.input],
    model: request.model,
    dimensions: request.dimensions,
  });

  return {
    embedding: response.embeddings[0],
    model: response.model,
    dimensions: response.dimensions,
  };
}

export async function generateEmbeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = request.model?.trim() || DEFAULT_OPENAI_EMBEDDING_MODEL;
  const dimensions = request.dimensions ?? DEFAULT_OPENAI_EMBEDDING_DIMENSIONS;
  const embeddings = await embeddingLimiter.run(() =>
    requestEmbeddingWithRetry({
      apiKey,
      attempt: 0,
      dimensions,
      input: request.input,
      model,
    }),
  );

  return {
    embeddings,
    model,
    dimensions,
  };
}

async function requestWithRetry(input: {
  apiKey: string;
  attempt: number;
  model: string;
  schema: Record<string, unknown>;
  schemaName: string;
  systemPrompt: string;
  temperature: number;
  userPrompt: string;
  webSearch?: WebSearchRequest;
}): Promise<string> {
  const webSearchOptions = input.webSearch?.enabled
    ? {
        search_context_size: input.webSearch.searchContextSize ?? "medium",
        ...(input.webSearch.userLocation
          ? {
              user_location: {
                type: "approximate",
                ...input.webSearch.userLocation,
              },
            }
          : {}),
      }
    : undefined;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
      ...(webSearchOptions ? { web_search_options: webSearchOptions } : {}),
    }),
  });

  if ((response.status === 429 || response.status >= 500) && input.attempt < MAX_RETRY_ATTEMPTS) {
    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
    const backoffMs =
      retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : getExponentialBackoffDelay(input.attempt);
    await sleep(backoffMs);
    return requestWithRetry({
      ...input,
      attempt: input.attempt + 1,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
        refusal?: string;
      };
    }>;
  };

  const message = payload.choices?.[0]?.message;

  if (message?.refusal) {
    throw new Error(`OpenAI refused the request: ${message.refusal}`);
  }

  const content =
    typeof message?.content === "string"
      ? message.content
      : message?.content
          ?.map((part) => (part.type === "text" ? part.text ?? "" : ""))
          .join("")
          .trim();

  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  return content;
}

async function requestWithWebSearchRetry(input: {
  apiKey: string;
  attempt: number;
  model: string;
  schema: Record<string, unknown>;
  schemaName: string;
  systemPrompt: string;
  temperature: number;
  userPrompt: string;
  webSearch?: WebSearchRequest;
}): Promise<string> {
  const tool = {
    type: "web_search",
    search_context_size: input.webSearch?.searchContextSize ?? "medium",
    ...(input.webSearch?.userLocation
      ? {
          user_location: {
            type: "approximate",
            ...input.webSearch.userLocation,
          },
        }
      : {}),
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: input.model,
      input: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
      tools: [tool],
      tool_choice: "auto",
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
    }),
  });

  if ((response.status === 429 || response.status >= 500) && input.attempt < MAX_RETRY_ATTEMPTS) {
    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
    const backoffMs =
      retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : getExponentialBackoffDelay(input.attempt);
    await sleep(backoffMs);
    return requestWithWebSearchRetry({
      ...input,
      attempt: input.attempt + 1,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI web search request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  const payload = (await response.json()) as {
    error?: {
      message?: string;
    };
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
        refusal?: string;
      }>;
    }>;
  };

  if (payload.error?.message) {
    throw new Error(`OpenAI web search request failed: ${payload.error.message}`);
  }

  if (payload.output_text?.trim()) {
    return payload.output_text.trim();
  }

  const refusal = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((part) => part.refusal)
    .find((value) => Boolean(value));

  if (refusal) {
    throw new Error(`OpenAI refused the request: ${refusal}`);
  }

  const content = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" || part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!content) {
    throw new Error("OpenAI returned an empty web search response.");
  }

  return content;
}

async function requestEmbeddingWithRetry(input: {
  apiKey: string;
  attempt: number;
  dimensions: number;
  input: string[];
  model: string;
}): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      input: input.input,
      model: input.model,
      dimensions: input.dimensions,
    }),
  });

  if ((response.status === 429 || response.status >= 500) && input.attempt < MAX_RETRY_ATTEMPTS) {
    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
    const backoffMs =
      retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : getExponentialBackoffDelay(input.attempt);
    await sleep(backoffMs);
    return requestEmbeddingWithRetry({
      ...input,
      attempt: input.attempt + 1,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embedding request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  const payload = (await response.json()) as {
    data?: Array<{
      embedding?: number[];
    }>;
  };

  const embeddings = payload.data?.map((item) => item.embedding).filter((item): item is number[] => Array.isArray(item) && item.length > 0);

  if (!embeddings || embeddings.length !== input.input.length) {
    throw new Error("OpenAI returned an incomplete embeddings response.");
  }

  return embeddings;
}

function getExponentialBackoffDelay(attempt: number) {
  const exponentialMs = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  const jitterMs = Math.floor(Math.random() * 500);
  return exponentialMs + jitterMs;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
