export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`bg-th-hover rounded animate-pulse ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-3 w-2/3" />
      <SkeletonLine className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card p-5 space-y-3">
          <SkeletonLine className="h-10 w-10 rounded-lg" />
          <SkeletonLine className="h-7 w-16" />
          <SkeletonLine className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 space-y-3">
        <SkeletonLine className="h-8 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
