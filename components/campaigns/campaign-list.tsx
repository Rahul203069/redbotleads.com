"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

type CampaignListItem = {
  accessRole?: "OWNER" | "CLIENT";
  id: string;
  name: string;
  leadType: "PRODUCT" | "SERVICE";
  isActive: boolean;
  description: string | null;
  strongLeads: number;
  partialLeads: number;
  sync: {
    status: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    stage:
      | "NONE"
      | "QUEUED"
      | "FETCHING_POSTS"
      | "FETCHING_COMMENTS"
      | "CLASSIFYING"
      | "NOTIFYING"
      | "COMPLETED"
      | "FAILED";
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
            className="block cursor-pointer rounded-[22px] bg-[#1f1f1f] p-5 transition-colors hover:bg-[#252525] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
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
                <h3 className="text-[18px] font-semibold text-[#fdfdfd]">{campaign.name}</h3>
                <Badge>{campaign.leadType.toLowerCase()}</Badge>
                {campaign.accessRole === "CLIENT" ? <Badge tone="shared">Shared</Badge> : null}
                <Badge tone={campaign.isActive ? "active" : "muted"}>
                  {campaign.isActive ? "Active" : "Paused"}
                </Badge>
                {sync ? <SyncBadge status={sync.status} /> : null}
              </div>

              <p className="mt-3 max-w-xl truncate text-[14px] leading-6 text-[#cbcbcb]">
                {campaign.description || "No campaign description added yet."}
              </p>

              {sync?.message ? (
                <p className="mt-3 text-[13px] leading-5 text-[#b3b3b3]">{sync.message}</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
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

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "active" | "muted" | "shared";
}) {
  const className =
    tone === "active"
      ? "bg-[#121212] text-[#ffffff]"
      : tone === "shared"
        ? "bg-[#102742] text-[#8fc8ff]"
      : tone === "muted"
        ? "bg-[#121212] text-[#b3b3b3]"
        : "bg-[#121212] text-[#fdfdfd]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {children}
    </span>
  );
}

function SyncBadge({
  status,
}: {
  status: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}) {
  const className =
    status === "COMPLETED"
      ? "bg-[#121212] text-[#1ed760]"
      : status === "FAILED"
        ? "bg-[#121212] text-[#f3727f]"
        : "bg-[#121212] text-[#cbcbcb]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {status}
    </span>
  );
}

function formatStage(stage: NonNullable<CampaignListItem["sync"]>["stage"]) {
  if (stage === "CLASSIFYING") {
    return "PROCESSING LEADS";
  }

  return stage.replace(/_/g, " ");
}
