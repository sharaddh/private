import { useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const styles = {
  success: "bg-[#1ed760] text-black font-semibold",
  error: "bg-[#e91429] text-th-text",
  info: "bg-th-elevated text-th-text",
};

export default function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const Icon = icons[type];

  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-[8px] text-[14px] font-medium animate-slide-up ${styles[type]}`} style={{ boxShadow: "var(--shadow-elevated)" }}>
      <Icon size={18} />
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss notification" className="ml-2 hover:opacity-70">
        <X size={16} />
      </button>
    </div>
  );
}
