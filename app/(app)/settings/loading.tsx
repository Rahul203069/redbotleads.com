function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[16px] bg-[#252525] ${className}`} />;
}

const settingsCards = [
  {
    hasStatus: false,
    hasMetaIcon: false,
    metaWidth: "w-36",
    titleWidth: "w-24",
  },
  {
    hasStatus: false,
    hasMetaIcon: false,
    metaWidth: "w-20",
    titleWidth: "w-24",
  },
  {
    hasStatus: true,
    hasMetaIcon: true,
    metaWidth: "w-24",
    titleWidth: "w-36",
  },
];

export default function SettingsLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="max-w-2xl">
          <SkeletonBlock className="h-3 w-40 rounded-full" />
          <SkeletonBlock className="mt-3 h-10 w-40 lg:h-12" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-[36rem]" />
          <SkeletonBlock className="mt-2 h-4 w-full max-w-[30rem]" />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {settingsCards.map((card, index) => (
          <div
            className="rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
            key={index}
          >
            <SkeletonBlock className="h-3 w-24 rounded-full" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SkeletonBlock className={`h-8 ${card.titleWidth}`} />
              {card.hasStatus ? <SkeletonBlock className="h-6 w-28 rounded-full" /> : null}
            </div>
            <SkeletonBlock className="mt-3 h-4 w-full" />
            <SkeletonBlock className="mt-2 h-4 w-4/5" />
            <div className="mt-6 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {card.hasMetaIcon ? <SkeletonBlock className="h-5 w-5 rounded-full" /> : null}
                <SkeletonBlock className={`h-4 ${card.metaWidth}`} />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-3 w-10 rounded-full" />
                <SkeletonBlock className="h-4 w-4 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
