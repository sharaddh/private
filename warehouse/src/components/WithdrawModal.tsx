import { useState } from "react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import Spinner from "./Spinner";
import type { InventoryItem } from "../types/inventory";

interface Props {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function WithdrawModal({ item, onClose, onSaved }: Props) {
  const [qty, setQty] = useState(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const { toast } = useToast();

  async function handleWithdraw() {
    if (!item || qty <= 0) return;
    setWithdrawing(true);
    const res = await api.put("/api/inventory/" + item._id + "/stock", { quantity: -qty });
    if (res.success) { toast("Stock withdrawn successfully"); onSaved(); onClose(); }
    else { toast(res.message || "Failed to withdraw", "error"); }
    setWithdrawing(false);
  }

  if (!item) return null;

  return (
    <Modal open={!!item} onClose={onClose} title="Withdraw Stock" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-body text-th-secondary">
          <strong className="text-th-text">{item.brand} {item.model}</strong> — {item.sku}<br />
          Current stock: <strong className="text-th-text">{item.quantity}</strong>
        </p>
        <div>
          <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Quantity to withdraw</label>
          <input className="input-field" type="number" value={qty}
            onChange={(e) => setQty(Math.min(Math.max(0, Number(e.target.value)), item.quantity))}
            min="1" max={item.quantity} autoFocus />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleWithdraw} disabled={withdrawing || qty <= 0 || qty > (item.quantity || 0)}
            className="btn-danger flex-1 flex items-center justify-center gap-2">
            {withdrawing ? <><Spinner size={14} className="border-white border-t-transparent" /> Processing...</> : "Withdraw"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
