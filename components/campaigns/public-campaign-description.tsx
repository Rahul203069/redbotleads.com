"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";

const COLLAPSED_DESCRIPTION_LENGTH = 260;

export function PublicCampaignDescription({ description }: { description: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const fullDescription = description?.trim() || "No campaign description was added.";
  const normalizedDescription = fullDescription.replace(/\s+/g, " ").trim();
  const canExpand = normalizedDescription.length > COLLAPSED_DESCRIPTION_LENGTH;
  const visibleDescription = expanded || !canExpand
    ? fullDescription
    : createDescriptionPreview(normalizedDescription);

  return (
    <div className="mt-4 max-w-[70ch]">
      <p
        className={`break-words text-[15px] leading-6 text-[#cbcbcb] ${expanded ? "whitespace-pre-wrap" : "line-clamp-3"}`}
        id={descriptionId}
      >
        {visibleDescription}
      </p>
      {canExpand ? (
        <button
          aria-controls={descriptionId}
          aria-expanded={expanded}
          className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#fdfdfd] transition-colors hover:bg-white/6 hover:text-[#1ed760] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function createDescriptionPreview(description: string) {
  const candidate = description.slice(0, COLLAPSED_DESCRIPTION_LENGTH - 3).trimEnd();
  const lastSpaceIndex = candidate.lastIndexOf(" ");
  const preview = lastSpaceIndex >= COLLAPSED_DESCRIPTION_LENGTH * 0.7
    ? candidate.slice(0, lastSpaceIndex)
    : candidate;

  return `${preview}...`;
}
