import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${sizeMap[size]} bg-th-surface rounded-md shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in`}
      >
        {title && (
          <div className="sticky top-0 bg-th-surface z-10 flex items-center justify-between px-6 pt-5 pb-3 border-b border-th-border">
            <h3 className="text-feature text-th-text">{title}</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
