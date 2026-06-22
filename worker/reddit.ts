import { createHash } from "node:crypto";

import { redditRssMaxRetries, redditRssRequestIntervalMs } from "./config";

const REDDIT_RSS_BASE_URL = "https://www.reddit.com";
const DEFAULT_USER_AGENT = "my-app-rss-ingestion/0.1";
const DEFAULT_RETRY_AFTER_MS = 60_000;
let nextRedditRssRequestAt = 0;
let redditRssRequestChain = Promise.resolve();

export type RedditPost = {
  fullname: string;
  subreddit: string;
  title: string;
  description: string;
  body: string;
  author: string | null;
  permalink: string;
  url: string;
  createdUtc: Date;
  score: number;
  numComments: number;
  rawJson: {
    id: string | null;
    link: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
    author: string | null;
    title: string | null;
    summary: string | null;
    description: string | null;
    content: string | null;
    subreddit: string;
  };
};

// Example normalized output:
// {
//   fullname: "t3_abc123",
//   subreddit: "startups",
//   title: "Looking for a CRM for my SaaS startup",
//   description: "Founder asking for CRM recommendations and pricing tradeoffs.",
//   body: "Founder asking for CRM recommendations and pricing tradeoffs.",
//   author: "throwaway_founder",
//   permalink: "https://www.reddit.com/r/startups/comments/abc123/looking_for_a_crm/",
//   url: "https://www.reddit.com/r/startups/comments/abc123/looking_for_a_crm/",
//   createdUtc: new Date("2026-03-11T08:45:00.000Z"),
//   score: 0,
//   numComments: 0,
//   rawJson: {
//     id: "tag:reddit.com,2005:abc123",
//     link: "https://www.reddit.com/r/startups/comments/abc123/looking_for_a_crm/",
//     publishedAt: "2026-03-11T08:45:00+00:00",
//     updatedAt: "2026-03-11T08:45:00+00:00",
//     author: "throwaway_founder",
//     title: "Looking for a CRM for my SaaS startup",
//     summary: "<div>Founder asking for <b>CRM</b> recommendations...</div>",
//     description: null,
//     content: null,
//     subreddit: "startups"
//   }
// }

type ParsedFeedEntry = {
  id: string | null;
  link: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  author: string | null;
  title: string | null;
  summary: string | null;
  description: string | null;
  content: string | null;
};

export class RedditRssFetchError extends Error {
  status: number;
  statusText: string;
  retryAfterMs: number | null;

  constructor(subreddit: string, status: number, statusText: string, retryAfterMs: number | null) {
    super(`Could not fetch RSS for r/${subreddit}: ${status} ${statusText}`);
    this.name = "RedditRssFetchError";
    this.status = status;
    this.statusText = statusText;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function fetchSubredditPosts(subreddit: string, limit?: number) {
  const xml = await fetchSubredditRss(subreddit);
  return parseSubredditPostsFromRss(xml, { subreddit, limit });
}

export async function fetchSubredditRss(subreddit: string) {
  const normalizedSubreddit = normalizeSubredditName(subreddit);

  for (let attempt = 0; attempt <= redditRssMaxRetries; attempt += 1) {
    await waitForRedditRssSlot();

    const response = await fetch(`${REDDIT_RSS_BASE_URL}/r/${encodeURIComponent(normalizedSubreddit)}/.rss`, {
      headers: {
        "User-Agent": process.env.REDDIT_RSS_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
      },
    });

    if (response.ok) {
      return response.text();
    }

    const error = new RedditRssFetchError(
      normalizedSubreddit,
      response.status,
      response.statusText,
      parseRetryAfterMs(response.headers.get("retry-after")),
    );

    const shouldRetry =
      attempt < redditRssMaxRetries &&
      (response.status === 429 || response.status === 408 || response.status >= 500);

    if (!shouldRetry) {
      throw error;
    }

    await sleep(error.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS);
  }

  throw new Error(`Could not fetch RSS for r/${normalizedSubreddit}.`);
}

export function parseSubredditPostsFromRss(
  xml: string,
  options: {
    subreddit: string;
    limit?: number;
  },
) {
  const subreddit = normalizeSubredditName(options.subreddit);
  const entries = parseFeedEntries(xml);
  const posts = entries
    .map((entry) => mapParsedEntryToPost(entry, subreddit))
    .filter((post): post is RedditPost => post !== null);

  if (typeof options.limit === "number") {
    return posts.slice(0, Math.max(1, options.limit));
  }

  return posts;
}

function parseFeedEntries(xml: string) {
  const normalizedXml = stripXmlNoise(xml);
  const atomEntries = matchBlocks(normalizedXml, "entry").map(parseEntryBlock);

  if (atomEntries.length > 0) {
    return atomEntries;
  }

  return matchBlocks(normalizedXml, "item").map(parseItemBlock);
}

function parseEntryBlock(block: string): ParsedFeedEntry {
  return {
    id: getTagValue(block, "id"),
    link: getAtomLinkHref(block),
    publishedAt: getTagValue(block, "published"),
    updatedAt: getTagValue(block, "updated"),
    author: getNestedTagValue(block, "author", "name") ?? getTagValue(block, "author"),
    title: getTagValue(block, "title"),
    summary: getTagValue(block, "summary"),
    description: getTagValue(block, "description"),
    content: getTagValue(block, "content"),
  };
}

function parseItemBlock(block: string): ParsedFeedEntry {
  return {
    id: getTagValue(block, "guid") ?? getTagValue(block, "id"),
    link: getTagValue(block, "link"),
    publishedAt: getTagValue(block, "pubDate") ?? getTagValue(block, "published"),
    updatedAt: getTagValue(block, "updated") ?? getTagValue(block, "dc:date"),
    author: getTagValue(block, "author") ?? getTagValue(block, "dc:creator"),
    title: getTagValue(block, "title"),
    summary: getTagValue(block, "summary"),
    description: getTagValue(block, "description"),
    content: getTagValue(block, "content:encoded") ?? getTagValue(block, "content"),
  };
}

function mapParsedEntryToPost(entry: ParsedFeedEntry, fallbackSubreddit: string): RedditPost | null {
  const permalink = normalizeRedditUrl(entry.link ?? entry.id);
  const title = cleanPlainText(entry.title);
  const summary = cleanPlainText(entry.summary);
  const description = cleanPlainText(entry.description);
  const content = cleanPlainText(entry.content);
  const author = normalizeAuthor(entry.author);
  const createdUtc = parsePublishedDate(entry.publishedAt ?? entry.updatedAt);

  if (!permalink || !title || !createdUtc) {
    return null;
  }

  const subreddit = inferSubreddit(permalink, fallbackSubreddit);
  const cleanedDescription = summary || description || content;
  const cleanedBody = content || summary || description;

  return {
    fullname: derivePostFullname(entry.id, permalink),
    subreddit,
    title,
    description: cleanedDescription,
    body: cleanedBody,
    author,
    permalink,
    url: permalink,
    createdUtc,
    score: 0,
    numComments: 0,
    rawJson: {
      id: entry.id,
      link: entry.link,
      publishedAt: entry.publishedAt,
      updatedAt: entry.updatedAt,
      author: entry.author,
      title: entry.title,
      summary: entry.summary,
      description: entry.description,
      content: entry.content,
      subreddit,
    },
  };
}

function stripXmlNoise(xml: string) {
  return String(xml ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .trim();
}

function matchBlocks(xml: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const matches: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    matches.push(match[0]);
  }

  return matches;
}

function getTagValue(xml: string, tagName: string) {
  const escapedTagName = escapeForRegex(tagName);
  const pattern = new RegExp(`<${escapedTagName}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`, "i");
  const match = pattern.exec(xml);
  return match ? decodeXmlEntities(stripCdata(match[1])).trim() : null;
}

function getNestedTagValue(xml: string, parentTagName: string, childTagName: string) {
  const parentPattern = new RegExp(
    `<${escapeForRegex(parentTagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeForRegex(parentTagName)}>`,
    "i",
  );
  const parentMatch = parentPattern.exec(xml);
  return parentMatch ? getTagValue(parentMatch[0], childTagName) : null;
}

function getAtomLinkHref(xml: string) {
  const linkPattern = /<link\b[^>]*href=(["'])(.*?)\1[^>]*\/?>/i;
  const match = linkPattern.exec(xml);
  return match ? decodeXmlEntities(match[2]).trim() : null;
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/i, "").replace(/\]\]>$/i, "");
}

function cleanPlainText(value: string | null | undefined) {
  const decoded = decodeXmlEntities(String(value ?? ""));
  const withoutTags = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return withoutTags
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_match, codePoint) => {
      const parsed = Number.parseInt(codePoint, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint) => {
      const parsed = Number.parseInt(codePoint, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    });
}

function parsePublishedDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRedditUrl(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return `${REDDIT_RSS_BASE_URL}${normalized}`;
  }

  return `${REDDIT_RSS_BASE_URL}/${normalized.replace(/^\/+/, "")}`;
}

async function waitForRedditRssSlot() {
  const previousRequest = redditRssRequestChain;
  let releaseSlot: () => void = () => {};
  redditRssRequestChain = new Promise((resolve) => {
    releaseSlot = resolve;
  });

  try {
    await previousRequest;

    const now = Date.now();
    const waitMs = Math.max(0, nextRedditRssRequestAt - now);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    nextRedditRssRequestAt = Date.now() + redditRssRequestIntervalMs;
  } finally {
    releaseSlot();
  }
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function derivePostFullname(id: string | null, permalink: string) {
  const idMatch = /\/comments\/([a-z0-9]+)\//i.exec(`${id ?? ""} ${permalink}`);

  if (idMatch?.[1]) {
    return `t3_${idMatch[1].toLowerCase()}`;
  }

  const stableSource = `${id ?? ""}|${permalink}`;
  const digest = createHash("sha1").update(stableSource).digest("hex").slice(0, 16);
  return `rss_${digest}`;
}

function inferSubreddit(permalink: string, fallbackSubreddit: string) {
  const match = /reddit\.com\/r\/([^/]+)/i.exec(permalink);
  return normalizeSubredditName(match?.[1] ?? fallbackSubreddit);
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function normalizeAuthor(author: string | null | undefined) {
  const normalized = cleanPlainText(author);
  return normalized.length > 0 && normalized !== "[deleted]" ? normalized : null;
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
