"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopySubredditListButton({ subreddits }: { subreddits: string[] }) {
  const [copied, setCopied] = useState(false);
  const subredditList = useMemo(() => subreddits.map(normalizeSubredditName).filter(Boolean).join(" "), [subreddits]);

  async function handleCopy() {
    if (!subredditList) {
      return;
    }

    await copyToClipboard(subredditList);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      aria-label="Copy subreddit names as a space-separated list"
      className="w-full rounded-full border-none bg-[#1f1f1f] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
      disabled={!subredditList}
      onClick={handleCopy}
      size="sm"
      type="button"
      variant="secondary"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy subreddits"}
    </Button>
  );
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "");
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}
