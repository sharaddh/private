import { Skeleton, SkeletonCard, SkeletonTable, SkeletonStats, SkeletonStatCards, SkeletonList } from "./Skeleton";

export default function PageSkeleton({ page }: { page: string }) {
  switch (page) {
    case "dashboard":
      return (
        <div className="bg-th-base min-h-screen space-y-5 px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <SkeletonStats count={7} />
          <SkeletonStats count={8} />
          <SkeletonStats count={8} />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3"><Skeleton className="h-56 w-full rounded-[18px]" /></div>
            <div className="lg:col-span-2"><Skeleton className="h-56 w-full rounded-[18px]" /></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-th-surface rounded-[8px] p-4">
                <Skeleton className="h-4 w-28 mb-3" />
                <SkeletonList items={4} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-th-surface rounded-[8px] p-4">
                <Skeleton className="h-4 w-28 mb-3" />
                <SkeletonList items={4} />
              </div>
            ))}
          </div>
          <div className="bg-th-surface rounded-[8px] p-4">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-24 w-full rounded-[8px]" />
          </div>
        </div>
      );

    case "orders":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <SkeletonStats count={4} />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-sm" />
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
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-10 w-36 rounded-sm" />
          </div>
          <Skeleton className="h-10 w-full rounded-sm" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "customerdetail":
      return (
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="card p-6">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-6 w-12 mx-auto mb-1" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <SkeletonTable rows={4} cols={5} />
        </div>
      );

    case "bills":
    case "payments":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-36 rounded-sm" />
          </div>
          <SkeletonStats count={3} />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-lg" />
            ))}
          </div>
          <SkeletonTable rows={6} cols={5} />
        </div>
      );

    case "inventory":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-10 w-32 rounded-sm" />
          </div>
          <Skeleton className="h-10 w-full rounded-sm" />
          <SkeletonTable rows={8} cols={6} />
        </div>
      );

    case "delivery":
    case "pickup":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-36" />
          </div>
          <SkeletonStats count={3} />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      );

    case "reports":
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-36" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-6">
                <Skeleton className="h-5 w-32 mb-4" />
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "settings":
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-36" />
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-6">
                <Skeleton className="h-5 w-28 mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j}>
                      <Skeleton className="h-3 w-20 mb-1" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "announcement":
    case "workspace":
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-40" />
          <div className="card p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
          <SkeletonList items={5} />
        </div>
      );

    case "newvisit":
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-40" />
          <div className="card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20 mb-1" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
            <Skeleton className="h-12 w-32 mt-6 rounded-sm" />
          </div>
        </div>
      );

    case "login":
    case "register":
      return (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="card p-8 w-full max-w-sm">
            <Skeleton className="h-8 w-32 mx-auto mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16 mb-1" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
              <Skeleton className="h-11 w-full rounded-sm mt-2" />
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="page-container">
          <Skeleton className="h-8 w-48 mb-6" />
          <SkeletonTable rows={5} cols={4} />
        </div>
      );
  }
}
