import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message?: string;
}

export default function DeleteConfirmModal({ open, onClose, onConfirm, message = "Delete this item permanently?" }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete" size="sm">
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-negative/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={20} className="text-negative" />
          </div>
          <p className="text-body text-th-secondary">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={onConfirm} className="btn-danger flex-1">Delete</button>
        </div>
      </div>
    </Modal>
  );
}
