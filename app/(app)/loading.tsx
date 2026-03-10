function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[#161D1B] ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#27312E] bg-[#111716]/92 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] lg:p-8">
        <SkeletonBlock className="h-3 w-36 rounded-full" />
        <SkeletonBlock className="mt-4 h-10 w-56" />
        <SkeletonBlock className="mt-4 h-4 w-full max-w-2xl" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-[24px] border border-[#27312E] bg-[#111716] p-5">
          <SkeletonBlock className="h-3 w-28 rounded-full" />
          <SkeletonBlock className="mt-4 h-10 w-20" />
        </div>
        <div className="rounded-[24px] border border-[#27312E] bg-[#111716] p-5">
          <SkeletonBlock className="h-3 w-28 rounded-full" />
          <SkeletonBlock className="mt-4 h-10 w-20" />
        </div>
        <div className="rounded-[24px] border border-[#27312E] bg-[#111716] p-5">
          <SkeletonBlock className="h-3 w-28 rounded-full" />
          <SkeletonBlock className="mt-4 h-10 w-20" />
        </div>
      </div>

      <div className="rounded-[24px] border border-[#27312E] bg-[#111716] p-6">
        <SkeletonBlock className="h-7 w-40" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl" />

        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[#27312E] bg-[#0F1413] p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SkeletonBlock className="h-6 w-40" />
                    <SkeletonBlock className="h-6 w-20 rounded-full" />
                    <SkeletonBlock className="h-6 w-20 rounded-full" />
                  </div>
                  <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <SkeletonBlock className="h-4 w-28 rounded-full" />
                <SkeletonBlock className="h-4 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
