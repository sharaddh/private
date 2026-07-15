import Spinner from "./Spinner";

interface Props {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
}

export default function LoadingOverlay({ loading, children, message }: Props) {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div className="absolute inset-0 bg-th-surface/80 backdrop-blur-sm flex items-center justify-center rounded-md z-10">
          <div className="flex items-center gap-3">
            <Spinner size={20} />
            {message && <span className="text-body text-th-secondary">{message}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
