export const SEMANTIC_QUERY_SEPARATOR = ",,,";
export const MIN_SEMANTIC_QUERY_TEXT_LENGTH = 3;
export const MAX_SEMANTIC_QUERY_TEXT_LENGTH = 700;
export const MAX_SEMANTIC_QUERY_CATEGORY_LENGTH = 80;

export type SemanticQueryInputRow =
  | {
      category?: unknown;
      text?: unknown;
      queryText?: unknown;
    }
  | string;

export type CleanSemanticQuery = {
  category: string;
  text: string;
};

export type SemanticQueryDraftRow = CleanSemanticQuery & {
  id: string;
};

export type SemanticQueryParseResult =
  | { status: "success"; queries: CleanSemanticQuery[] }
  | { status: "error"; message: string };

export function parseSemanticQueryBulkInput(value: string): SemanticQueryParseResult {
  const input = value.trim();

  if (!input) {
    return {
      status: "error",
      message: "Paste JSON or plain text queries first.",
    };
  }

  const structuredInput = parseStructuredSemanticQueryInput(input);

  if (structuredInput.status === "error") {
    return structuredInput;
  }

  const rows = structuredInput.status === "parsed"
    ? structuredInput.rows
    : parsePlainTextSemanticQueryRows(input);

  return cleanSemanticQueryRows(rows);
}

export function parseSemanticQueriesJson(value: string): SemanticQueryParseResult {
  if (!value.trim()) {
    return {
      status: "error",
      message: "Add at least one semantic query.",
    };
  }

  const parsed = parseStructuredSemanticQueryInput(value.trim());

  if (parsed.status === "plainText") {
    return {
      status: "error",
      message: "Semantic queries JSON is invalid.",
    };
  }

  if (parsed.status === "error") {
    return parsed;
  }

  return cleanSemanticQueryRows(parsed.rows);
}

export function cleanSemanticQueryRows(rows: SemanticQueryInputRow[]): SemanticQueryParseResult {
  const cleanedRows: CleanSemanticQuery[] = [];
  const seenTexts = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const textValue = typeof row === "string"
      ? row
      : typeof row.text === "string"
        ? row.text
        : typeof row.queryText === "string"
          ? row.queryText
          : "";
    const categoryValue = typeof row === "string" ? "" : typeof row.category === "string" ? row.category : "";
    const text = textValue.trim();
    const category = categoryValue.trim();

    if (!text) {
      continue;
    }

    if (text.length < MIN_SEMANTIC_QUERY_TEXT_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} must be at least ${MIN_SEMANTIC_QUERY_TEXT_LENGTH} characters.`,
      };
    }

    if (text.length > MAX_SEMANTIC_QUERY_TEXT_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} must be ${MAX_SEMANTIC_QUERY_TEXT_LENGTH} characters or less.`,
      };
    }

    if (category.length > MAX_SEMANTIC_QUERY_CATEGORY_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} category must be ${MAX_SEMANTIC_QUERY_CATEGORY_LENGTH} characters or less.`,
      };
    }

    const dedupeKey = normalizeSemanticQueryText(text);

    if (seenTexts.has(dedupeKey)) {
      continue;
    }

    cleanedRows.push({ category, text });
    seenTexts.add(dedupeKey);
  }

  if (cleanedRows.length === 0) {
    return {
      status: "error",
      message: "Add at least one semantic query with 3 or more characters.",
    };
  }

  return {
    status: "success",
    queries: cleanedRows,
  };
}

export function normalizeSemanticQueryText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createSemanticQueryDraftRows(queries: CleanSemanticQuery[]): SemanticQueryDraftRow[] {
  return queries.map((query) => ({
    ...query,
    id: createSemanticQueryLocalId(),
  }));
}

export function createSemanticQueryLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `query-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseStructuredSemanticQueryInput(
  input: string,
):
  | { status: "plainText" }
  | { status: "parsed"; rows: SemanticQueryInputRow[] }
  | { status: "error"; message: string } {
  if (!input.startsWith("{") && !input.startsWith("[")) {
    return { status: "plainText" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    return {
      status: "error",
      message: "The semantic queries JSON is not valid. Check the brackets, commas, and quotes.",
    };
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.semanticQueries)
      ? parsed.semanticQueries
      : isRecord(parsed) && Array.isArray(parsed.queries)
        ? parsed.queries
        : null;

  if (!rows) {
    return {
      status: "error",
      message: "JSON must be an array, or an object with a semanticQueries or queries array.",
    };
  }

  return {
    status: "parsed",
    rows: rows.filter((row): row is SemanticQueryInputRow => isRecord(row) || typeof row === "string"),
  };
}

function parsePlainTextSemanticQueryRows(input: string): SemanticQueryInputRow[] {
  const chunks = input.includes(SEMANTIC_QUERY_SEPARATOR)
    ? input.split(SEMANTIC_QUERY_SEPARATOR)
    : input.split(/\r?\n/);

  return chunks
    .map((text) => stripListMarker(text).trim())
    .filter(Boolean);
}

function stripListMarker(value: string) {
  return value
    .replace(/^\s*(?:[-*\u2022]\s+|\d+[\).:-]\s*)/, "")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
