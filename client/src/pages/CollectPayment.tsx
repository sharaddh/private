import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import ShineCard from "../components/ShineCard";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import { ArrowLeft, IndianRupee, Receipt, CheckCircle2, Loader2 } from "lucide-react";
import type { Bill } from "../types";

const COLLECT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Insurance"];

export default function CollectPayment() {
  const { uiT } = useTranslate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const billId = searchParams.get("billId");

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState("Cash");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const loadBill = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Bill>(`/api/bills/${id}`);
      if (res.success && res.data) {
        setBill(res.data);
        setAmount(res.data.pendingAmount > 0 ? res.data.pendingAmount : 0);
      } else {
        setError(res.message || "Bill not found");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (billId) loadBill(billId);
    else setLoading(false);
  }, [billId, loadBill]);

  const custName = (() => {
    if (!bill) return "—";
    return typeof bill.customerId === "object" ? bill.customerId?.name || "—" : "—";
  })();
  const custMobile = (() => {
    if (!bill) return "";
    return typeof bill.customerId === "object" ? bill.customerId?.mobile || "" : "";
  })();

  async function handleCollect() {
    if (!bill || !billId) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error(uiT("Enter a valid amount", "मान्य राशि दर्ज करें"));
      return;
    }
    if (amt > bill.pendingAmount) {
      toast.error(uiT("Amount exceeds pending balance", "राशि बकाया राशि से अधिक है"));
      return;
    }
    setCollecting(true);
    setError("");
    try {
      const res = await api.post<{ bill: Bill }>(`/api/bills/${billId}/collect-payment`, { amount: amt, paymentMode: mode });
      if (res.success && res.data?.bill) {
        setBill(res.data.bill);
        setSuccess(true);
        toast.success(uiT("Payment collected", "भुगतान एकत्रित हुआ"));
      } else {
        setError(res.message || "Failed to collect payment");
        toast.error(res.message || "Failed");
      }
    } finally {
      setCollecting(false);
    }
  }

  if (loading) return <PageSkeleton page="bills" />;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-20">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-th-secondary hover:text-th-text transition-colors"
      >
        <ArrowLeft size={16} />
        {uiT("Back", "वापस")}
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#1ed760] rounded-full flex items-center justify-center text-black">
          <IndianRupee size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-th-text">{uiT("Collect Payment", "भुगतान एकत्र करें")}</h1>
          <p className="text-sm text-th-secondary">{uiT("Collect pending amount for this bill", "इस बिल के लिए बकाया राशि एकत्र करें")}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm bg-[#e74c3c]/10 text-[#e74c3c]">{error}</div>
      )}

      {!bill ? (
        <div className="text-center py-10 bg-th-surface rounded-lg">
          <Receipt size={32} className="mx-auto text-th-muted" />
          <p className="mt-2 text-sm text-th-secondary">{uiT("No bill selected", "कोई बिल चयनित नहीं")}</p>
        </div>
      ) : (
        <>
          <ShineCard className="bg-th-surface rounded-lg overflow-hidden shadow-lg">
            <div className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#1ed760]/10 flex items-center justify-center text-[#1ed760] font-bold text-sm shrink-0">
                {custName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-th-text truncate">{custName}</p>
                {custMobile && <p className="text-sm text-th-secondary">{custMobile}</p>}
              </div>
              <span className="text-xs font-medium text-[#1ed760] bg-[#1ed760]/10 px-2.5 py-0.5 rounded-lg">{bill.billNumber}</span>
            </div>
            <div className="px-4 py-3 bg-th-elevated border-t border-th-border space-y-1.5 text-sm">
              <div className="flex justify-between text-th-secondary">
                <span>{uiT("Bill Date", "बिल तिथि")}</span>
                <span>{new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
              <div className="flex justify-between text-th-secondary">
                <span>{uiT("Total", "कुल")}</span>
                <span className="font-medium text-th-text">₹{(bill.totalAmount || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-th-secondary">
                <span>{uiT("Paid", "भुगतान किया")}</span>
                <span className="font-medium text-[#1ed760]">₹{(bill.advancePaid || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span className="text-[#e74c3c]">{uiT("Pending", "बाकी")}</span>
                <span className="text-[#e74c3c]">₹{(bill.pendingAmount || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </ShineCard>

          {success || bill.pendingAmount <= 0 ? (
            <div className="rounded-lg p-6 text-center bg-[#1ed760]/10 border border-[#1ed760]/20">
              <CheckCircle2 size={40} className="mx-auto text-[#1ed760]" />
              <p className="mt-3 text-base font-bold text-th-text">{uiT("Payment collected successfully!", "भुगतान सफलतापूर्वक एकत्रित हुआ!")}</p>
              <p className="mt-1 text-sm text-th-secondary">{uiT("This bill is fully paid.", "यह बिल पूरी तरह भुगतान हो गया।")}</p>
              <button onClick={() => navigate("/")} className="btn-primary mt-5">{uiT("Go to Dashboard", "डैशबोर्ड पर जाएं")}</button>
            </div>
          ) : (
            <ShineCard className="bg-th-surface rounded-lg p-5 space-y-4 shadow-lg">
              <div>
                <label className="block text-xs font-medium text-th-secondary mb-1">{uiT("Amount", "राशि")}</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field text-2xl font-bold"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  max={bill.pendingAmount}
                  min={0}
                />
                <button
                  onClick={() => setAmount(bill.pendingAmount)}
                  className="mt-2 text-xs font-medium text-[#1ed760] hover:underline"
                >
                  {uiT("Collect full amount", "पूरी राशि एकत्र करें")} ₹{bill.pendingAmount.toLocaleString("en-IN")}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-th-secondary mb-2">{uiT("Mode", "मोड")}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {COLLECT_MODES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                        mode === m ? "bg-[#1ed760] text-black border-[#1ed760]" : "bg-th-elevated text-th-secondary border-th-border"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCollect}
                disabled={collecting}
                className="w-full bg-[#1ed760] hover:bg-[#1db954] text-black font-bold uppercase tracking-wider text-sm rounded-lg flex items-center justify-center gap-2 py-4 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-[0_8px_24px_rgb(30,215,96,0.3)]"
              >
                {collecting ? <Loader2 size={18} className="animate-spin" /> : <IndianRupee size={18} />}
                {collecting ? uiT("Collecting...", "एकत्र हो रहा है...") : `${uiT("Collect", "एकत्र करें")} ₹${(Number(amount) || 0).toLocaleString("en-IN")}`}
              </button>
            </ShineCard>
          )}
        </>
      )}
    </div>
  );
}
