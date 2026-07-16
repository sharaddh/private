import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-full bg-th-hover flex items-center justify-center mb-6">
        <span className="text-4xl font-bold text-th-secondary">404</span>
      </div>
      <h1 className="text-2xl font-bold text-th-text mb-2">Page Not Found</h1>
      <p className="text-th-secondary mb-6 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1ed760] text-black font-semibold text-sm hover:brightness-110 transition-all active:scale-95"
      >
        <Home size={16} /> Back to Dashboard
      </Link>
    </div>
  );
}
