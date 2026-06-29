import Link from "next/link";
import { redirect } from "next/navigation";

import { DailySubredditDateFilter } from "@/components/admin/daily-subreddit-date-filter";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  type DailySubredditAnalytics,
  getDailySubredditAnalytics,
  getDailySubredditDateRange,
} from "@/lib/daily-subreddit-analytics";

type SearchParams = {
  from?: string;
  to?: string;
};

export default async function AdminDailySubredditPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const params = await Promise.resolve(searchParams ?? {});
  const range = getDailySubredditDateRange(params);
  const analytics = await getDailySubredditAnalytics({
    from: range.from,
    to: range.to,
  });

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">Admin daily subreddit</p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">Daily subreddit</h1>
            <p className="mt-3 max-w-[78ch] text-[15px] leading-6 text-[#cbcbcb]">
              Per-subreddit daily view of unique posts stored, Reddit item embeddings completed, and embeddings queued by RSS workers.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
            <DailySubredditDateFilter />
            <Link
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
              href="/admin/analytics"
            >
              Back
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Subreddits" value={String(analytics.metrics.subreddits)} />
        <Metric label="Unique posts" value={String(analytics.metrics.uniquePostsFetched)} />
        <Metric label="Embeds done" value={String(analytics.metrics.embeddingsCompleted)} />
        <Metric label="Embeds queued" value={String(analytics.metrics.embeddingsQueued)} />
        <Metric label="RSS requests" value={String(analytics.metrics.rssRequests)} />
        <Metric label="Errors / limits" value={String(analytics.metrics.errorsAndRateLimits)} />
      </section>

      <DailySubredditTable analytics={analytics} />
    </div>
  );
}

function DailySubredditTable({ analytics }: { analytics: DailySubredditAnalytics }) {
  if (analytics.rows.length === 0) {
    return (
      <section className="rounded-[18px] bg-[#121212] p-5 text-[13px] leading-5 text-[#b3b3b3] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        No subreddit post or embedding activity found for this date.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[18px] bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-[12px]">
          <thead className="bg-[#181818] text-[10px] uppercase tracking-[0.16em] text-[#b3b3b3]">
            <tr>
              <Th>Subreddit</Th>
              <Th>Unique posts fetched</Th>
              <Th>Embeddings completed</Th>
              <Th>Embeddings queued</Th>
              <Th>RSS requests</Th>
              <Th>Errors / limits</Th>
              <Th>Latest fetched</Th>
              <Th>Latest embedded</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272a]">
            {analytics.rows.map((row) => (
              <tr className="text-[#cbcbcb] transition-colors hover:bg-[#181818]" key={row.subreddit}>
                <Td>
                  <div className="font-semibold text-[#ffffff]">r/{row.subreddit}</div>
                </Td>
                <Td>{row.uniquePostsFetched}</Td>
                <Td>{row.embeddingsCompleted}</Td>
                <Td>{row.embeddingsQueued}</Td>
                <Td>{row.rssRequests}</Td>
                <Td>
                  <span className={row.errorsAndRateLimits > 0 ? "font-semibold text-[#f8c15c]" : undefined}>{row.errorsAndRateLimits}</span>
                </Td>
                <Td>{formatDateTime(row.latestFetchedAt)}</Td>
                <Td>{formatDateTime(row.latestEmbeddingAt)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</div>
      <div className="mt-2 truncate text-[18px] font-bold leading-none text-[#ffffff]">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
