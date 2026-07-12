function SkeletonBlock({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse rounded-[16px] bg-[#252525] ${className}`} />;
}

export default function OverviewLoading() {
  return (
    <div aria-label="Loading overview dashboard" className="space-y-5" role="status">
      <span className="sr-only">Loading overview dashboard</span>

      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-2xl">
            <SkeletonBlock className="h-3 w-36 rounded-full" />
            <SkeletonBlock className="mt-4 h-10 w-full max-w-md" />
            <SkeletonBlock className="mt-4 h-4 w-full max-w-2xl" />
            <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
          </div>
          <SkeletonBlock className="h-11 w-40 rounded-full" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="rounded-[20px] bg-[#1f1f1f] px-5 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
            key={index}
          >
            <SkeletonBlock className="h-3 w-24 rounded-full" />
            <SkeletonBlock className="mt-4 h-8 w-20" />
          </div>
        ))}
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="border-b border-white/8 pb-5">
          <SkeletonBlock className="h-7 w-64" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
        </div>

        <div className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                className="rounded-[16px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
                key={index}
              >
                <SkeletonBlock className="h-3 w-24 rounded-full" />
                <SkeletonBlock className="mt-3 h-7 w-16" />
                <SkeletonBlock className="mt-3 h-3 w-32 rounded-full" />
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[20px] bg-[#101010] px-4 pb-4 pt-5 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="mt-2 h-3 w-28 rounded-full" />
              </div>
              <SkeletonBlock className="h-3 w-40 rounded-full" />
            </div>
            <SkeletonBlock className="mt-5 h-[340px] w-full sm:h-[390px]" />
          </div>
        </div>
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="border-b border-white/8 pb-5">
          <SkeletonBlock className="h-7 w-56" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-lg" />
        </div>
        <div className="space-y-3 pt-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
              key={index}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-full max-w-xl">
                  <SkeletonBlock className="h-4 w-4/5" />
                  <SkeletonBlock className="mt-3 h-3 w-28 rounded-full" />
                </div>
                <SkeletonBlock className="h-6 w-12 rounded-full" />
              </div>
              <SkeletonBlock className="mt-4 h-4 w-full" />
              <SkeletonBlock className="mt-2 h-4 w-3/4" />
              <div className="mt-4 flex items-center justify-between gap-4">
                <SkeletonBlock className="h-3 w-28 rounded-full" />
                <SkeletonBlock className="h-8 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
