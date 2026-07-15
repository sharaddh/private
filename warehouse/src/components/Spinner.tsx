export default function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-primary-500 border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
