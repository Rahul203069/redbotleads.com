import Link from "next/link";

import { submitRssTest } from "@/actions/rss-tester";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchSubredditPosts } from "@/worker/reddit";

type RssLabPageProps = {
  searchParams: Promise<{
    subreddits?: string;
  }>;
};

type FeedResult = {
  subreddit: string;
  posts: Awaited<ReturnType<typeof fetchSubredditPosts>>;
  error: string | null;
};

export default async function RssLabPage({ searchParams }: RssLabPageProps) {
  const params = await searchParams;
  const subreddits = normalizeSubreddits(params.subreddits);
  const results = await Promise.all(subreddits.map(loadSubredditPosts));
  const posts = results
    .flatMap((result) => result.posts)
    .sort((a, b) => b.createdUtc.getTime() - a.createdUtc.getTime());
  const hasQuery = subreddits.length > 0;

  return (
    <div className="space-y-6">
      <AppHeader
        eyebrow="RSS parser lab"
        title="Reddit RSS Test"
        description="Enter one or more subreddits to fetch live RSS feeds through the existing worker parser and inspect the normalized post output in card form."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Test parser input</CardTitle>
          <CardDescription>
            Enter subreddit names separated by commas or new lines. The page uses the server-side worker parser, not a separate app-only implementation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitRssTest} className="space-y-4">
            <Textarea
              className="min-h-32"
              defaultValue={subreddits.join("\n")}
              name="subreddits"
              placeholder={"startups\nsaas\nsmallbusiness"}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Fetch RSS posts</Button>
              <Link href="/rss-lab">
                <Button type="button" variant="secondary">
                  Clear
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {hasQuery ? (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Run summary</CardTitle>
              <CardDescription>Fetch status for each requested subreddit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryStat label="Subreddits requested" value={String(subreddits.length)} />
              <SummaryStat label="Posts parsed" value={String(posts.length)} />
              <SummaryStat label="Feed errors" value={String(results.filter((result) => result.error).length)} />
              <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">Subreddits</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {subreddits.map((subreddit) => (
                    <span
                      key={subreddit}
                      className="rounded-full border border-[#3f3f46] bg-[#18181b] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#fafafa]"
                    >
                      r/{subreddit}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Feed status</CardTitle>
              <CardDescription>Each subreddit is fetched independently so one failure does not hide the rest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.map((result) => (
                <div key={result.subreddit} className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[#fafafa]">r/{result.subreddit}</div>
                    <div
                      className={
                        result.error
                          ? "rounded-full border border-[#5f2b2b] bg-[#241313] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#fca5a5]"
                          : "rounded-full border border-[#52525b] bg-[#18181b] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#fafafa]"
                      }
                    >
                      {result.error ? "Error" : `${result.posts.length} posts`}
                    </div>
                  </div>
                  {result.error ? (
                    <p className="mt-3 text-sm leading-6 text-[#d7b4b4]">{result.error}</p>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">
                      Parsed {result.posts.length} normalized posts from the existing worker RSS parser.
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {hasQuery ? (
        posts.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {posts.map((post) => (
              <Card key={`${post.subreddit}:${post.fullname}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-[#52525b] bg-[#18181b] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#fafafa]">
                      r/{post.subreddit}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-[#71717a]">
                      {formatDate(post.createdUtc)}
                    </span>
                  </div>
                  <CardTitle className="text-xl leading-8">{post.title}</CardTitle>
                  <CardDescription>{post.description || "No RSS summary or description was available."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm text-[#d4d4d8]">
                    <FieldRow label="Author" value={post.author ?? "Unknown"} />
                    <FieldRow label="Fullname" value={post.fullname} />
                    <FieldRow label="URL" value={post.url} />
                  </div>

                  {post.body ? (
                    <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">Body</div>
                      <p className="mt-3 text-sm leading-6 text-[#d4d4d8]">{post.body}</p>
                    </div>
                  ) : null}

                  <details className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
                    <summary className="cursor-pointer text-sm font-medium text-[#fafafa]">Raw parsed payload</summary>
                    <pre className="mt-4 overflow-x-auto rounded-xl border border-[#27272a] bg-[#09090b] p-4 text-xs leading-6 text-[#a1a1aa]">
                      {JSON.stringify(post.rawJson, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">No posts returned</CardTitle>
              <CardDescription>
                No normalized posts were returned for the current input. That can mean an empty feed, a fetch failure, or a parsing mismatch.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Ready for a feed test</CardTitle>
            <CardDescription>
              Submit a few subreddit names above and this page will render the parsed RSS output as cards using the worker parser directly.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

async function loadSubredditPosts(subreddit: string): Promise<FeedResult> {
  try {
    const posts = await fetchSubredditPosts(subreddit, 12);
    return {
      subreddit,
      posts,
      error: null,
    };
  } catch (error) {
    return {
      subreddit,
      posts: [],
      error: error instanceof Error ? error.message : "RSS fetch failed.",
    };
  }
}

function normalizeSubreddits(value: string | undefined) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(/[\r\n,]+/)
        .map((item) => item.trim().toLowerCase().replace(/^r\//, ""))
        .filter(Boolean),
    ),
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#fafafa]">{value}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#27272a] bg-[#111113] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#71717a]">{label}</div>
      <div className="mt-1 break-all text-sm text-[#fafafa]">{value}</div>
    </div>
  );
}
