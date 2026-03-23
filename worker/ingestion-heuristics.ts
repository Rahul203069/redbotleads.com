 const DEFAULT_INTENT_PHRASES = [
  "looking for",
  "need",
  "recommend",
  "recommendation",
  "best tool",
  "any tool",
  "any software",
  "alternative to",
  "struggling with",
  "how do you handle",
  "what do you use",
  "need help",
];

type PromisingPostInput = {
  title?: string | null;
  body?: string | null;
  score?: number | null;
  numComments?: number | null;
  createdUtc: Date;
};

type PromisingPostOptions = {
  keywords: string[];
  negativeKeywords: string[];
  recentDays: number;
  now?: Date;
  intentPhrases?: string[];
  minimumScore?: number;
};

type PromisingPostResult = {
  shouldIngestComments: boolean;
  score: number;
  reasons: string[];
};

export function isPromisingPost(
  post: PromisingPostInput,
  options: PromisingPostOptions,
): PromisingPostResult {
  const now = options.now ?? new Date();
  const recentDays = Math.min(Math.max(options.recentDays, 1), 10);
  const minimumScore = options.minimumScore ?? 4;
  const intentPhrases = options.intentPhrases ?? DEFAULT_INTENT_PHRASES;

  const title = normalize(post.title);
  const body = normalize(post.body);
  const combined = `${title}\n${body}`.trim();
  const reasons: string[] = [];

  if (combined.length === 0) {
    return {
      shouldIngestComments: false,
      score: -2,
      reasons: ["empty-content"],
    };
  }

  if (isOlderThanWindow(post.createdUtc, now, recentDays)) {
    return {
      shouldIngestComments: false,
      score: -3,
      reasons: ["outside-recency-window"],
    };
  }

  let heuristicScore = 0;

  const titleKeywordMatches = countMatches(title, options.keywords);
  const bodyKeywordMatches = countMatches(body, options.keywords);

  if (titleKeywordMatches > 0) {
    heuristicScore += 3;
    reasons.push("keyword-in-title");
  }

  if (bodyKeywordMatches > 0) {
    heuristicScore += 2;
    reasons.push("keyword-in-body");
  }

  const titleIntentMatches = countMatches(title, intentPhrases);
  const bodyIntentMatches = countMatches(body, intentPhrases);

  if (titleIntentMatches > 0) {
    heuristicScore += 3;
    reasons.push("intent-in-title");
  }

  if (bodyIntentMatches > 0) {
    heuristicScore += 2;
    reasons.push("intent-in-body");
  }

  const negativeMatches = countMatches(combined, options.negativeKeywords);
  if (negativeMatches > 0) {
    heuristicScore -= 4;
    reasons.push("negative-keyword-match");
  }

  if (combined.length < 40) {
    heuristicScore -= 2;
    reasons.push("low-information");
  }

  if ((post.numComments ?? 0) >= 2) {
    heuristicScore += 1;
    reasons.push("has-discussion");
  }

  if ((post.score ?? 0) >= 3) {
    heuristicScore += 1;
    reasons.push("has-engagement");
  }

  return {
    shouldIngestComments: heuristicScore >= minimumScore,
    score: heuristicScore,
    reasons,
  };
}

function countMatches(content: string, terms: string[]) {
  const normalizedTerms = terms
    .map((term) => normalize(term))
    .filter(Boolean);

  return normalizedTerms.reduce((count, term) => count + (content.includes(term) ? 1 : 0), 0);
}

function isOlderThanWindow(createdUtc: Date, now: Date, recentDays: number) {
  const diffMs = now.getTime() - createdUtc.getTime();
  const maxAgeMs = recentDays * 24 * 60 * 60 * 1000;
  return diffMs > maxAgeMs;
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}
