"use client";

import { useId } from "react";

import {
  CAMPAIGN_SEMANTIC_SEARCH_SCOPES,
  getCampaignSemanticSearchScopeLabel,
  type CampaignSemanticSearchScope,
} from "@/lib/campaign-semantic-search-scope";

const scopeDescriptions: Record<CampaignSemanticSearchScope, string> = {
  CAMPAIGN: "Compare only against recent posts from this campaign's linked, enabled subreddits.",
  GLOBAL: "Compare against the shared pool of enabled subreddits linked to every active campaign.",
};

export function SemanticSearchScopeField({
  error,
  onChange,
  value,
}: {
  error?: string;
  onChange: (value: CampaignSemanticSearchScope) => void;
  value: CampaignSemanticSearchScope;
}) {
  const groupId = useId();
  const hintId = `${groupId}-hint`;

  return (
    <fieldset aria-describedby={hintId} className="grid gap-3">
      <div>
        <legend className="text-sm font-medium text-[#fdfdfd]">Semantic search scope</legend>
        <p className={error ? "mt-1 text-sm text-[#FCA5A5]" : "mt-1 text-sm text-[#b3b3b3]"} id={hintId} role={error ? "alert" : undefined}>
          {error ?? "Choose which recently polled Reddit communities this campaign can search."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPAIGN_SEMANTIC_SEARCH_SCOPES.map((scope) => {
          const selected = value === scope;
          const descriptionId = `${groupId}-${scope.toLowerCase()}-description`;

          return (
            <label
              className={[
                "flex min-h-28 cursor-pointer items-start gap-3 rounded-[18px] border p-4 transition-colors duration-200",
                "focus-within:ring-2 focus-within:ring-[#1ed760] focus-within:ring-offset-2 focus-within:ring-offset-[#121212]",
                selected
                  ? "border-[#1ed760] bg-[#16251c]"
                  : "border-[#343434] bg-[#121212] hover:border-[#5a5a5a] hover:bg-[#171717]",
              ].join(" ")}
              key={scope}
            >
              <input
                aria-describedby={descriptionId}
                checked={selected}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#1ed760]"
                name={`${groupId}-semantic-search-scope`}
                onChange={() => onChange(scope)}
                type="radio"
                value={scope}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#fdfdfd]">
                    {getCampaignSemanticSearchScopeLabel(scope)}
                  </span>
                  {selected ? (
                    <span className="rounded-full bg-[#1ed760] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#07150c]">
                      Selected
                    </span>
                  ) : null}
                </span>
                <span className="mt-2 block text-sm leading-6 text-[#cbcbcb]" id={descriptionId}>
                  {scopeDescriptions[scope]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
