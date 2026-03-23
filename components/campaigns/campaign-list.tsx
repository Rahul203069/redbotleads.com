"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

type CampaignListItem = {
  id: string;
  name: string;
  leadType: "PRODUCT" | "SERVICE";
  isActive: boolean;
  description: string | null;
  strongLeads: number;
  partialLeads: number;
  sync: {
    status: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    stage: "NONE" | "QUEUED" | "FETCHING_POSTS" | "FETCHING_COMMENTS" | "CLASSIFYING" | "NOTIFYING" | "COMPLETED" | "FAILED";
    message: string | null;
    updatedAt: string;
  } | null;
};

export function CampaignList({ campaigns }: { campaigns: CampaignListItem[] }) {
  const router = useRouter();
  const syncMap = useMemo(
    () => Object.fromEntries(campaigns.map((campaign) => [campaign.id, campaign.sync])),
    [campaigns],
  );

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => {
        const sync = syncMap[campaign.id];
        const href = `/campaigns/${campaign.id}`;

        return (
          <article
            key={campaign.id}
            aria-label={`Open campaign ${campaign.name}`}
            className="block cursor-pointer rounded-2xl border border-[#27272a] bg-[#111113] p-4 transition-colors hover:border-[#52525b] hover:bg-[#161618] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            onClick={() => router.push(href)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(href);
              }
            }}
            role="link"
            tabIndex={0}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-[#F8FAFC]">{campaign.name}</h3>
                <Badge>{campaign.leadType}</Badge>
                <Badge tone={campaign.isActive ? "active" : "muted"}>{campaign.isActive ? "Active" : "Paused"}</Badge>
                {sync ? <SyncBadge status={sync.status} /> : null}
              </div>
              <p className="mt-2 max-w-xl truncate text-sm leading-6 text-[#a1a1aa]">
                {campaign.description || "No campaign description added yet."}
              </p>
              {sync?.message ? (
                <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{sync.message}</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#71717a]">
              <span>Strong leads {campaign.strongLeads}</span>
              <span>Partial leads {campaign.partialLeads}</span>
              {sync?.stage && sync.stage !== "NONE" ? <span>{formatStage(sync.stage)}</span> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "active" | "muted" }) {
  const className =
    tone === "active"
      ? "border-[#52525b] bg-[#18181b] text-[#fafafa]"
      : tone === "muted"
        ? "border-[#27272a] bg-[#18181b] text-[#a1a1aa]"
        : "border-[#27272a] bg-[#18181b] text-[#fafafa]";

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${className}`}>{children}</span>;
}

function SyncBadge({
  status,
}: {
  status: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}) {
  const tone =
    status === "COMPLETED"
      ? "border-[#52525b] bg-[#18181b] text-[#fafafa]"
      : status === "FAILED"
        ? "border-[#7f1d1d] bg-[#241313] text-[#fca5a5]"
        : "border-[#27272a] bg-[#18181b] text-[#d4d4d8]";

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${tone}`}>{status}</span>;
}

function formatStage(stage: NonNullable<CampaignListItem["sync"]>["stage"]) {
  if (stage === "CLASSIFYING") {
    return "PROCESSING LEADS";
  }

  return stage.replace(/_/g, " ");
}
