import React from "react";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-[8px] bg-th-hover ${className || ""}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-th-surface rounded-[8px] overflow-hidden">
      <div className="p-5 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <Skeleton className="h-6 w-24 rounded-[8px]" />
          <Skeleton className="h-6 w-28 rounded-[8px]" />
          <Skeleton className="h-6 w-20 rounded-[8px]" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="px-5 pb-5 pt-0">
        <div className="pt-3 border-t border-th-hover">
          <Skeleton className="h-12 w-full rounded-[8px]" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 pb-2 border-b border-th-hover">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/3" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card text-center py-5 px-4">
          <Skeleton className="h-8 w-16 mx-auto mb-2" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <Skeleton className="h-4" style={{ width: width as string }} />;
}
