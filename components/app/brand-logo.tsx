import { Zap } from "lucide-react";

type BrandLogoProps = {
  className?: string;
  showMark?: boolean;
};

export function BrandLogo({ className, showMark = false }: BrandLogoProps) {
  return (
    <span
      className={`${showMark ? "inline-flex items-center gap-[0.22em] leading-none" : ""} ${className ?? "text-2xl font-semibold tracking-[-0.06em]"}`}
      aria-label="Redleadsai"
    >
      {showMark ? (
        <span aria-hidden="true" className="inline-flex h-[0.95em] w-[0.95em] shrink-0 items-center justify-center rounded-[0.22em] bg-brand-green text-black">
          <Zap className="h-[0.58em] w-[0.58em]" fill="currentColor" />
        </span>
      ) : null}
      <span>
        <span className="text-[#22c55e]">Redleads</span>
        <span className="text-white">ai</span>
      </span>
    </span>
  );
}
