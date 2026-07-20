export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin w-8 h-8 border-2 border-th-hover border-t-[#1ed760] rounded-full" />
        <p className="text-[17px] text-th-secondary">Loading...</p>
      </div>
    </div>
  );
}
