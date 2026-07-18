import {
  Skeleton, SkeletonCard, SkeletonTable, SkeletonStats, SkeletonStatCards,
  SkeletonList, SkeletonChart, SkeletonDonut, SkeletonForm, SkeletonHeader,
  SkeletonFilterPills, SkeletonProfileCard, SkeletonSearchBar, SkeletonText,
} from "./Skeleton";

export default function PageSkeleton({ page }: { page: string }) {
  switch (page) {
    case "dashboard":
      return (
        <div className="bg-th-base min-h-screen space-y-6 px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" delay={0} />
              <Skeleton className="h-4 w-48" delay={60} />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28 rounded-lg" delay={80} />
              <Skeleton className="h-10 w-20 rounded-lg" delay={120} />
            </div>
          </div>
          <div className="bg-th-surface rounded-xl p-5 md:p-6 shadow-lg border border-th-border animate-skeleton-stagger">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="space-y-1.5"><Skeleton className="h-3 w-24" delay={0} /><Skeleton className="h-6 w-20" delay={30} /></div>
              <div className="w-px h-8 bg-th-border hidden sm:block" />
              <div className="space-y-1.5"><Skeleton className="h-3 w-24" delay={60} /><Skeleton className="h-6 w-20" delay={90} /></div>
              <div className="w-px h-8 bg-th-border hidden sm:block" />
              <div className="space-y-1.5"><Skeleton className="h-3 w-20" delay={120} /><Skeleton className="h-6 w-12" delay={150} /></div>
              <div className="w-px h-8 bg-th-border hidden sm:block" />
              <div className="space-y-1.5"><Skeleton className="h-3 w-20" delay={180} /><Skeleton className="h-6 w-12" delay={210} /></div>
              <div className="ml-auto"><Skeleton className="h-4 w-28" delay={240} /></div>
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-3" delay={200} />
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-th-surface rounded-lg p-3 flex flex-col items-center gap-2 animate-skeleton-stagger" style={{ animationDelay: `${250 + i * 30}ms` }}>
                  <Skeleton className="w-10 h-10 rounded-xl" delay={250 + i * 30} />
                  <Skeleton className="h-3 w-14" delay={280 + i * 30} />
                  <Skeleton className="h-2 w-20" delay={310 + i * 30} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-3" delay={500} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-th-surface rounded-lg p-4 animate-skeleton-stagger" style={{ animationDelay: `${520 + i * 50}ms` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <Skeleton className="w-9 h-9 rounded-lg shrink-0" delay={520 + i * 50} />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-16" delay={550 + i * 50} />
                      <Skeleton className="h-5 w-12" delay={580 + i * 50} />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-20" delay={610 + i * 50} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><SkeletonChart /></div>
            <div className="lg:col-span-2"><SkeletonDonut /></div>
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-3" delay={900} />
            <div className="bg-th-surface rounded-lg p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-skeleton-stagger" style={{ animationDelay: `${920 + i * 60}ms` }}>
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" delay={920 + i * 60} />
                  <Skeleton className="h-4 flex-1" delay={950 + i * 60} />
                  <Skeleton className="h-4 w-16 shrink-0" delay={980 + i * 60} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-th-surface rounded-lg p-4 animate-skeleton-stagger" style={{ animationDelay: `${1100 + i * 80}ms` }}>
                <Skeleton className="h-4 w-28 mb-3" delay={1100 + i * 80} />
                <SkeletonList items={3} />
              </div>
            ))}
          </div>
        </div>
      );

    case "orders":
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <SkeletonStats count={4} />
          <SkeletonFilterPills count={6} />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-56 rounded-lg" delay={300} />
            <Skeleton className="h-9 w-28 rounded-lg" delay={340} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      );

    case "customers":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" delay={0} />
              <Skeleton className="h-4 w-64" delay={60} />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28 rounded-lg" delay={100} />
              <Skeleton className="h-10 w-36 rounded-lg" delay={140} />
            </div>
          </div>
          <SkeletonSearchBar />
          <p className="text-[11px]"><Skeleton className="h-3 w-28 inline-block" delay={200} /></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-th-surface rounded-xl p-4 animate-skeleton-stagger" style={{ animationDelay: `${220 + i * 40}ms` }}>
                <div className="flex items-start gap-3">
                  <Skeleton className="w-11 h-11 rounded-full shrink-0" delay={220 + i * 40} />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" delay={250 + i * 40} />
                    <Skeleton className="h-3 w-24" delay={280 + i * 40} />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-th-hover flex items-center justify-between">
                  <Skeleton className="h-3 w-16" delay={310 + i * 40} />
                  <Skeleton className="h-6 w-14 rounded-full" delay={340 + i * 40} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "customerdetail":
      return (
        <div className="space-y-6">
          <Skeleton className="h-4 w-24" delay={0} />
          <SkeletonProfileCard />
          <div className="flex gap-2 border-b border-th-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28" delay={300 + i * 40} />
            ))}
          </div>
          <SkeletonTable rows={4} cols={5} />
        </div>
      );

    case "bills":
    case "payments":
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-56 rounded-lg" delay={120} />
            <Skeleton className="h-9 w-28 rounded-lg" delay={160} />
          </div>
          <SkeletonStats count={3} />
          <SkeletonTable rows={6} cols={5} />
        </div>
      );

    case "inventory":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" delay={0} />
              <Skeleton className="h-4 w-56" delay={60} />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32 rounded-lg" delay={100} />
              <Skeleton className="h-10 w-28 rounded-lg" delay={140} />
            </div>
          </div>
          <SkeletonSearchBar />
          <SkeletonTable rows={8} cols={6} />
        </div>
      );

    case "delivery":
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <div className="flex gap-2 border-b border-th-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24" delay={120 + i * 40} />
            ))}
          </div>
          <SkeletonStats count={3} />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      );

    case "pickup":
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <div className="flex gap-2 border-b border-th-border">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28" delay={120 + i * 40} />
            ))}
          </div>
          <SkeletonStats count={3} />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      );

    case "reports":
      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" delay={0} />
              <Skeleton className="h-4 w-56" delay={60} />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" delay={100} />
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-th-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 shrink-0" delay={120 + i * 40} />
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-8 w-20 rounded-lg" delay={320} />
            <Skeleton className="h-8 w-16 rounded-lg" delay={360} />
            <Skeleton className="h-8 w-16 rounded-lg" delay={400} />
            <Skeleton className="h-8 w-20 rounded-lg" delay={440} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-th-surface rounded-lg p-5 text-center animate-skeleton-stagger" style={{ animationDelay: `${500 + i * 60}ms` }}>
                <Skeleton className="h-8 w-16 mx-auto mb-2" delay={500 + i * 60} />
                <Skeleton className="h-3 w-24 mx-auto" delay={530 + i * 60} />
              </div>
            ))}
          </div>
          <SkeletonTable rows={5} cols={6} />
        </div>
      );

    case "settings":
      return (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-full shrink-0" delay={0} />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" delay={60} />
              <Skeleton className="h-4 w-32" delay={120} />
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-th-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28 shrink-0" delay={160 + i * 40} />
            ))}
          </div>
          <div className="bg-th-surface rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="w-5 h-5 rounded" delay={360} />
              <Skeleton className="h-5 w-32" delay={400} />
            </div>
            <div className="flex gap-5">
              <Skeleton className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-sm" delay={440} />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" delay={480 + i * 40} />
                    <Skeleton className="h-10 w-full" delay={500 + i * 40} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-th-surface rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="w-5 h-5 rounded" delay={700} />
              <Skeleton className="h-5 w-36" delay={740} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" delay={780 + i * 40} />
                  <Skeleton className="h-10 w-full" delay={800 + i * 40} />
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "workspace":
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <div className="bg-th-surface rounded-lg p-6 space-y-5">
            <div className="relative">
              <Skeleton className="h-12 w-full" delay={120} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" delay={180 + i * 40} />
                  <Skeleton className="h-10 w-full" delay={200 + i * 40} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-th-surface rounded-lg p-4 text-center animate-skeleton-stagger" style={{ animationDelay: `${400 + i * 50}ms` }}>
                <Skeleton className="w-10 h-10 rounded-xl mx-auto mb-2" delay={400 + i * 50} />
                <Skeleton className="h-3 w-16 mx-auto" delay={430 + i * 50} />
              </div>
            ))}
          </div>
          <SkeletonForm fields={4} />
        </div>
      );

    case "announcement":
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <div className="bg-th-surface rounded-lg p-6 space-y-4">
            <Skeleton className="h-10 w-full" delay={120} />
            <Skeleton className="h-24 w-full" delay={180} />
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-lg" delay={240 + i * 40} />
              ))}
            </div>
            <Skeleton className="h-10 w-32" delay={440} />
          </div>
          <SkeletonList items={5} />
        </div>
      );

    case "login":
    case "register":
      return (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="bg-th-surface rounded-xl p-8 w-full max-w-sm space-y-5 animate-skeleton-stagger">
            <Skeleton className="h-8 w-32 mx-auto" delay={0} />
            <Skeleton className="h-3 w-48 mx-auto" delay={60} />
            <div className="space-y-4 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" delay={120 + i * 60} />
                  <Skeleton className="h-10 w-full" delay={150 + i * 60} />
                </div>
              ))}
              <Skeleton className="h-11 w-full mt-2" delay={360} />
            </div>
          </div>
        </div>
      );

    case "newvisit":
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <SkeletonForm fields={6} />
        </div>
      );

    default:
      return (
        <div className="space-y-6">
          <SkeletonHeader />
          <SkeletonTable rows={5} cols={4} />
        </div>
      );
  }
}
