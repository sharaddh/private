export default function PageLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-th-elevated" />
        <div className="space-y-1.5">
          <div className="h-4 w-32 rounded bg-th-elevated" />
          <div className="h-2.5 w-20 rounded bg-th-elevated" />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="hidden lg:block w-56 shrink-0 card p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-th-elevated" />
          ))}
        </div>
        <div className="flex-1 card p-4 space-y-3">
          <div className="h-4 w-24 rounded-full bg-th-elevated" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-th-elevated" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
