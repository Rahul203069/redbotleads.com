import Link from "next/link";

import type { DailyLeadSemanticStatusFilter } from "@/lib/daily-leads-analytics";

type SemanticFilterOption = {
  label: string;
  status: DailyLeadSemanticStatusFilter;
};

const OPTIONS: SemanticFilterOption[] = [
  { label: "All", status: "ALL" },
  { label: "Leads only", status: "MATCHED" },
  { label: "Filtered out", status: "NO_MATCH" },
];

export function DailyLeadsSemanticFilter({
  currentStatus,
  hrefForStatus,
}: {
  currentStatus: DailyLeadSemanticStatusFilter;
  hrefForStatus: (status: DailyLeadSemanticStatusFilter) => string;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Semantic rows</p>
      <div className="flex rounded-full bg-[#121212] p-1 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        {OPTIONS.map((option) => {
          const active = option.status === currentStatus;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-8 items-center rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                active ? "bg-[#1ed760] text-[#121212]" : "text-[#b3b3b3] hover:text-[#ffffff]"
              }`}
              href={hrefForStatus(option.status)}
              key={option.status}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
