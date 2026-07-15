import { AlertTriangle } from "lucide-react";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = "Confirm", danger = false }: Props) {
  return (
    <div className="flex items-start gap-3 p-4 bg-th-elevated rounded-md">
      <AlertTriangle size={18} className={danger ? "text-negative mt-0.5" : "text-warning mt-0.5"} />
      <div className="flex-1">
        <p className="text-body text-th-text mb-3">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost btn-sm">Cancel</button>
          <button onClick={onConfirm} className={danger ? "btn-danger btn-sm" : "btn-primary btn-sm"}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
