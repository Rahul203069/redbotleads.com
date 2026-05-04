function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[16px] bg-[#252525] ${className}`} />;
}

export default function CampaignDetailLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-3 w-28 rounded-full" />
            <SkeletonBlock className="mt-4 h-10 w-64" />
            <SkeletonBlock className="mt-4 h-4 w-full max-w-3xl" />
          </div>
          <div className="flex flex-wrap gap-3">
            <SkeletonBlock className="h-11 w-36 rounded-full" />
            <SkeletonBlock className="h-11 w-24 rounded-full" />
            <SkeletonBlock className="h-11 w-36 rounded-full" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[20px] bg-[#181818] px-5 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
            <SkeletonBlock className="h-3 w-20 rounded-full" />
            <SkeletonBlock className="mt-4 h-9 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="mt-3 h-4 w-56" />

        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
              <div className="flex flex-wrap items-center gap-2">
                <SkeletonBlock className="h-6 w-20 rounded-full" />
                <SkeletonBlock className="h-6 w-20 rounded-full" />
                <SkeletonBlock className="h-6 w-24 rounded-full" />
              </div>
              <SkeletonBlock className="mt-4 h-5 w-full max-w-2xl" />
              <div className="mt-4 flex flex-wrap gap-3">
                <SkeletonBlock className="h-4 w-16 rounded-full" />
                <SkeletonBlock className="h-4 w-16 rounded-full" />
                <SkeletonBlock className="h-4 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
