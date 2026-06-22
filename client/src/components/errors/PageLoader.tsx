export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin w-10 h-10 border-[3px] border-primary-500 border-t-transparent rounded-full" />
        <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}
