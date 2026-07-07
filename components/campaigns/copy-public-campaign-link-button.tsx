"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function CopyPublicCampaignLinkButton({
  campaignId,
  kind = "campaign",
}: {
  campaignId: string;
  kind?: "campaign" | "leads";
}) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isCopied, setIsCopied] = useState(false);
  const isLeadsOnly = kind === "leads";

  async function handleCopy() {
    const publicUrl = buildPublicUrl(window.location.origin, campaignId, searchParams, kind);

    try {
      await copyToClipboard(publicUrl);
      setIsCopied(true);
      toast({
        title: isLeadsOnly ? "Leads-only link copied" : "Public link copied",
        description: isLeadsOnly
          ? "Anyone with this link can view the leads without the campaign name."
          : "Anyone with this link can view the campaign results.",
      });
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast({
        title: "Could not copy link",
        description: publicUrl,
        variant: "destructive",
      });
    }
  }

  return (
    <Button className="w-full sm:w-auto" onClick={handleCopy} variant="secondary">
      <LinkIcon />
      {isCopied ? "Copied" : isLeadsOnly ? "Copy only leads" : "Copy public link"}
    </Button>
  );
}

function buildPublicUrl(
  origin: string,
  campaignId: string,
  searchParams: URLSearchParams,
  kind: "campaign" | "leads",
) {
  const url = new URL(kind === "leads" ? `/share/leads/${campaignId}` : `/share/campaigns/${campaignId}`, origin);
  const range = searchParams.get("range");
  const dates = searchParams.getAll("date").filter(Boolean);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (range === "all") {
    url.searchParams.set("range", "all");
  } else if (dates.length > 0) {
    for (const date of dates) {
      url.searchParams.append("date", date);
    }
  } else if (from && to) {
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
  }

  return url.toString();
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("input");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M10.5 13.5 13.5 10.5M9 7.5l1.2-1.2a4.24 4.24 0 0 1 6 6L15 13.5M15 16.5l-1.2 1.2a4.24 4.24 0 0 1-6-6L9 10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
