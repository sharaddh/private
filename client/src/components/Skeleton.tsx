import React from "react";

export function Skeleton({ className, delay = 0, ...props }: React.HTMLAttributes<HTMLDivElement> & { delay?: number }) {
  return (
    <div
      className={`relative rounded-[8px] bg-th-hover overflow-hidden animate-skeleton-wave animate-skeleton-stagger ${className || ""}`}
      style={{ animationDelay: delay ? `${delay}ms` : undefined }}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} delay={i * 60} className={`h-3.5 ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-th-surface rounded-lg overflow-hidden animate-skeleton-stagger" style={{ animationDelay: "0ms" }}>
      <div className="p-5 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" delay={50} />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" delay={100} />
            <Skeleton className="h-3 w-20" delay={150} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <Skeleton className="h-6 w-24" delay={200} />
          <Skeleton className="h-6 w-28" delay={250} />
          <Skeleton className="h-6 w-20" delay={300} />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" delay={350} />
          <Skeleton className="h-4 w-16" delay={400} />
        </div>
      </div>
      <div className="px-5 pb-5 pt-0">
        <div className="pt-3 border-t border-th-hover">
          <Skeleton className="h-12 w-full" delay={450} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0 rounded-lg overflow-hidden bg-th-surface">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-th-hover">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" delay={i * 40} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex items-center gap-4 px-4 py-3 ${r < rows - 1 ? "border-b border-th-hover/50" : ""}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 0 ? "w-1/3" : "flex-1"}`} delay={(r * cols + c) * 30 + 100} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-3 ${count <= 4 ? "grid-cols-2 md:grid-cols-4" : count <= 6 ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-th-surface rounded-lg p-4 animate-skeleton-stagger" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" delay={i * 50} />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-16" delay={i * 50 + 30} />
              <Skeleton className="h-5 w-12" delay={i * 50 + 60} />
            </div>
          </div>
          <Skeleton className="h-3 w-20" delay={i * 50 + 90} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-th-surface rounded-lg p-4 animate-skeleton-stagger" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" delay={i * 60} />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-16" delay={i * 60 + 40} />
              <Skeleton className="h-5 w-12" delay={i * 60 + 80} />
            </div>
          </div>
          <Skeleton className="h-3 w-20" delay={i * 60 + 120} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg animate-skeleton-stagger" style={{ animationDelay: `${i * 40}ms` }}>
          <Skeleton className="w-8 h-8 rounded-full shrink-0" delay={i * 40} />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/5" delay={i * 40 + 20} />
            <Skeleton className="h-2.5 w-2/5" delay={i * 40 + 40} />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" delay={i * 40 + 60} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <Skeleton className="h-4" style={{ width: width as string }} />;
}

export function SkeletonChart({ height = "h-56" }: { height?: string }) {
  return (
    <div className={`bg-th-surface rounded-lg p-5 ${height} animate-skeleton-stagger`}>
      <Skeleton className="h-4 w-28 mb-4" delay={0} />
      <div className="flex items-end gap-2 h-[calc(100%-2rem)]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
            <Skeleton className="w-full" delay={i * 40 + 100} style={{ height: `${30 + Math.random() * 60}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDonut() {
  return (
    <div className="bg-th-surface rounded-lg p-5 h-56 flex items-center justify-center animate-skeleton-stagger">
      <Skeleton className="w-32 h-32 rounded-full" delay={0} />
    </div>
  );
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="bg-th-surface rounded-lg p-6 space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5 animate-skeleton-stagger" style={{ animationDelay: `${i * 60}ms` }}>
          <Skeleton className="h-3 w-20" delay={i * 60} />
          <Skeleton className="h-10 w-full" delay={i * 60 + 30} />
        </div>
      ))}
      <Skeleton className="h-10 w-28 mt-2" delay={fields * 60} />
    </div>
  );
}

export function SkeletonSearchBar() {
  return (
    <Skeleton className="h-12 w-full" delay={0} />
  );
}

export function SkeletonFilterPills({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-lg" delay={i * 40} />
      ))}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" delay={0} />
        <Skeleton className="h-4 w-64" delay={60} />
      </div>
      <Skeleton className="h-10 w-32 rounded-lg" delay={120} />
    </div>
  );
}

export function SkeletonProfileCard() {
  return (
    <div className="bg-th-surface rounded-lg p-6 animate-skeleton-stagger">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-16 h-16 rounded-full shrink-0" delay={0} />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" delay={60} />
          <Skeleton className="h-4 w-32" delay={120} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="text-center space-y-1">
            <Skeleton className="h-6 w-12 mx-auto" delay={180 + i * 40} />
            <Skeleton className="h-3 w-16 mx-auto" delay={200 + i * 40} />
          </div>
        ))}
      </div>
    </div>
  );
}
