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
        className="inline-flex items-center gap-3 rounded-full bg-[#1f1f1f] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
        href={href}
      >
        <span aria-hidden="true">{"<-"}</span>
        <span>{label}</span>
      </Link>
    </div>
  );
}
