import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="fixed inset-0 bg-black/60" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-th-surface border border-th-border p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? "bg-red-500/15" : "bg-amber-500/15"}`}>
            <AlertTriangle size={20} className={danger ? "text-red-500" : "text-amber-500"} />
          </div>
          <h3 className="text-base font-semibold text-th-text">{title}</h3>
        </div>
        <p className="text-sm text-th-secondary mb-5 ml-[52px]">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-th-secondary hover:bg-th-hover transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${danger ? "bg-red-500 hover:bg-red-600" : "bg-[#1ed760] text-black hover:brightness-110"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
