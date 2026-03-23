type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      className={className ?? "text-2xl font-semibold tracking-[-0.06em]"}
      aria-label="Redleadsai"
    >
      <span className="text-[#22c55e]">Redleads</span>
      <span className="text-white">ai</span>
    </span>
  );
}
