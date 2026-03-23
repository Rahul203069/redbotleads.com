"use server";

import { redirect } from "next/navigation";

export async function submitRssTest(formData: FormData) {
  const subreddits = normalizeSubreddits(String(formData.get("subreddits") ?? ""));
  const params = new URLSearchParams();

  if (subreddits.length > 0) {
    params.set("subreddits", subreddits.join(","));
  }

  redirect(params.size > 0 ? `/rss-lab?${params.toString()}` : "/rss-lab");
}

function normalizeSubreddits(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\r\n,]+/)
        .map((item) => item.trim().toLowerCase().replace(/^r\//, ""))
        .filter(Boolean),
    ),
  );
}
