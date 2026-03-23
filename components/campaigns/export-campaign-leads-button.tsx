"use client";

import { useTransition } from "react";

import { getCampaignLeads } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";

export function ExportCampaignLeadsButton({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="w-full sm:w-auto"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const leads = await getCampaignLeads(campaignId);
          const csv = buildCsv(leads);
          downloadCsv(csv, `${slugify(campaignName)}-leads.csv`);
        });
      }}
      variant="secondary"
    >
      <ExportIcon />
      {isPending ? "Exporting..." : "Export CSV"}
    </Button>
  );
}

type ExportLead = Awaited<ReturnType<typeof getCampaignLeads>>[number];

function buildCsv(leads: ExportLead[]) {
  const headers = [
    "Lead ID",
    "Type",
    "Subreddit",
    "Title",
    "Post Content",
    "Summary",
    "Category",
    "Pain Points",
    "Score",
    "Semantic Score",
    "Label",
    "Status",
    "Scored At",
    "Source URL",
  ];

  const rows = leads.map((lead) => [
    lead.id,
    lead.redditItem.type,
    lead.redditItem.subreddit,
    lead.redditItem.title ?? "",
    lead.redditItem.body?.trim() || lead.redditItem.description?.trim() || "",
    lead.ai?.summary?.trim() || "",
    lead.ai?.category ?? "",
    lead.ai?.painPoints.join(" | ") ?? "",
    String(lead.score),
    lead.semanticScore !== null ? lead.semanticScore.toFixed(3) : "",
    lead.label,
    lead.status,
    lead.createdAt,
    lead.redditItem.url ?? "",
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

function escapeCsvCell(value: string) {
  const normalized = String(value ?? "");
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "campaign";
}

function ExportIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
