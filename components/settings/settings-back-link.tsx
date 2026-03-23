import Link from "next/link";

type SettingsBackLinkProps = {
  href?: string;
  label?: string;
};

export function SettingsBackLink({
  href = "/settings",
  label = "Back to settings",
}: SettingsBackLinkProps) {
  return (
    <div className="flex items-center justify-start">
      <Link
        className="inline-flex items-center gap-3 rounded-2xl border border-[#3f3f46] bg-[#18181b] px-5 py-3 text-sm font-semibold text-[#fafafa] shadow-[0_16px_36px_rgba(0,0,0,0.28)] transition hover:border-[#52525b] hover:bg-[#1f1f23]"
        href={href}
      >
        <span aria-hidden="true">{"<-"}</span>
        <span>{label}</span>
      </Link>
    </div>
  );
}
