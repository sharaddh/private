import { useState, useCallback } from "react";
import api from "../api";
import { useApiGet } from "../hooks/useApi";
import Table from "../components/Table";
import { useToast } from "../context/ToastContext";
import { Printer, MessageCircle, FileText as PdfIcon } from "lucide-react";
import { downloadBillPdf, generateBillPdf } from "../utils/pdf";
import DateRangePicker from "../components/DateRangePicker";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Bills() {
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const toast = useToast();

  const fetchBills = useCallback(() => {
    const params = new URLSearchParams({ startDate, endDate });
    api.get<Record<string, unknown>[]>(`/api/bills?${params.toString()}`).then((d) => { if (d.success) setList(d.data || []); });
  }, [startDate, endDate]);

  const fetchSettings = useCallback(() => {
    api.get<Record<string, unknown>>("/api/settings").then((d) => { if (d.success) setSettings(d.data || null); });
  }, []);

  useState(() => { fetchBills(); fetchSettings(); });

  function resolveCustomer(bill: Record<string, unknown>): Record<string, unknown> | null {
    if (typeof bill.customerId === "object" && bill.customerId) return bill.customerId as Record<string, unknown>;
    return null;
  }

  function handlePrint(bill: Record<string, unknown>) {
    const w = window.open("", "_blank");
    if (!w) return;
    const shop = (settings?.shopName as string) || "KMJ Optical";
    const address = (settings?.shopAddress as string) || "";
    const phone = (settings?.shopPhone as string) || "";
    const email = (settings?.shopEmail as string) || "";
    const logo = (settings?.logo as string) || "";
    const customer = resolveCustomer(bill);
    const items = ((bill.items as Record<string, unknown>[]) || []).map((it) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;color:#374151">${it.description || ""}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center;color:#374151">${it.quantity || 1}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:right;color:#374151">₹${((it.unitPrice as number) || 0).toFixed(2)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:right;color:#374151;font-weight:500">₹${(((it.quantity as number) || 1) * ((it.unitPrice as number) || 0)).toFixed(2)}</td>
      </tr>`).join("");
    w.document.write(`<!DOCTYPE html>
<html><head><title>Invoice ${bill.billNumber}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body{font-family:system-ui,sans-serif;margin:0;padding:0;color:#111827;background:#fff}
  .page{max-width:800px;margin:auto;padding:30px}
  .top-bar{background:#1e40af;height:6px;margin:-30px -30px 0}
  .header-row{display:flex;align-items:center;gap:16px;margin:28px 0 20px}
  .header-row img{width:60px;height:60px;object-fit:contain}
  .shop-details h1{margin:0;font-size:24px;color:#111827}
  .shop-details p{margin:2px 0 0;font-size:11px;color:#6b7280}
  .invoice-badge{background:#1e40af;color:#fff;padding:6px 18px;border-radius:6px;font-size:13px;font-weight:bold;margin-left:auto;letter-spacing:0.5px}
  hr{border:none;border-top:1px solid #e5e7eb;margin:16px 0}
  .info-grid{display:flex;gap:40px;margin:16px 0}
  .info-col{flex:1}
  .info-col .label{font-size:9px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
  .info-col .value{font-size:13px;color:#111827;margin-bottom:10px}
  .info-col .sub-label{font-size:9px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th{background:#1e40af;color:#fff;padding:8px 10px;font-size:11px;font-weight:600;text-align:left}
  th.center{text-align:center}
  th.right{text-align:right}
  tr:nth-child(even){background:#f9fafb}
  .totals-box{margin-left:auto;width:55%;background:#eff2ff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px}
  .totals-box .row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#374151}
  .totals-box .bold{font-weight:bold;font-size:15px;color:#111827}
  .totals-box .green{color:#059669}
  .totals-box .orange{color:#d97706}
  .totals-box .red{color:#dc2626}
  .totals-box .divider{border-top:2px solid #1e40af;margin:4px 0;padding-top:4px}
  .words{font-size:11px;color:#6b7280;margin-top:12px;font-style:italic}
  .footer-row{display:flex;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af}
  .terms{font-size:10px;color:#6b7280;margin-top:16px}
  .terms strong{color:#111827}
  .terms p{margin:2px 0}
</style></head><body>
<div class="page">
  <div class="top-bar"></div>
  <div class="header-row">
    ${logo ? `<img src="${logo}" alt="Logo" />` : ""}
    <div class="shop-details">
      <h1>${shop}</h1>
      ${address ? `<p>${address}</p>` : ""}
      ${phone || email ? `<p>${[phone, email].filter(Boolean).join("  |  ")}</p>` : ""}
    </div>
    <div class="invoice-badge">TAX INVOICE</div>
  </div>
  <hr />
  <div class="info-grid">
    <div class="info-col">
      <div class="label">Invoice No.</div>
      <div class="value" style="font-weight:600">${bill.billNumber || "—"}</div>
      <div class="sub-label">Date</div>
      <div class="value">${new Date(bill.createdAt as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
      <div class="sub-label">Status</div>
      <div class="value" style="color:${bill.status === "Cancelled" ? "#dc2626" : "#111827"}">${String(bill.status || "Active")}</div>
    </div>
    <div class="info-col">
      <div class="label">Bill To</div>
      <div class="value" style="font-weight:600;font-size:15px">${customer?.name || "—"}</div>
      ${customer?.mobile ? `<div class="value" style="font-weight:400;font-size:12px">Mobile: ${customer.mobile}</div>` : ""}
      ${customer?.address ? `<div class="value" style="font-weight:400;font-size:12px">${customer.address}</div>` : ""}
    </div>
  </div>
  <table>
    <tr><th style="width:36px">#</th><th>Description</th><th class="center" style="width:60px">Qty</th><th class="right" style="width:100px">Unit Price</th><th class="right" style="width:100px">Total</th></tr>
    ${items || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af">No items</td></tr>'}
  </table>
  <div class="totals-box">
    <div class="row"><span>Subtotal</span><span>₹${((bill.subtotal as number) || 0).toFixed(2)}</span></div>
    ${bill.discount ? `<div class="row red"><span>Discount</span><span>-₹${(bill.discount as number).toFixed(2)}</span></div>` : ""}
    ${bill.tax ? `<div class="row green"><span>GST</span><span>+₹${(bill.tax as number).toFixed(2)}</span></div>` : ""}
    <div class="row bold divider"><span>Total Amount</span><span>₹${((bill.totalAmount as number) || 0).toFixed(2)}</span></div>
    ${bill.advancePaid ? `<div class="row green"><span>Paid</span><span>₹${(bill.advancePaid as number).toFixed(2)}</span></div>` : ""}
    ${bill.pendingAmount && (bill.pendingAmount as number) > 0 ? `<div class="row bold orange divider"><span>Balance Due</span><span>₹${(bill.pendingAmount as number).toFixed(2)}</span></div>` : ""}
  </div>
  ${bill.totalAmount ? `<div class="words">Amount in Words: ${numberToWords(Math.round(bill.totalAmount as number))}</div>` : ""}
  <div class="terms">
    <strong>Terms &amp; Conditions:</strong>
    <p>1. All items are subject to a 7-day inspection period.</p>
    <p>2. Prescription accuracy should be verified within 3 days of delivery.</p>
    <p>3. This is a computer-generated invoice.</p>
  </div>
  <div class="footer-row">
    <span>Authorised Signatory</span>
    <span>Thank you for choosing ${shop}! 🙏</span>
  </div>
</div>
<script>window.print()</script>
</body></html>`);
    w.document.close();
  }

  function numberToWords(n: number): string {
    if (n === 0) return "Zero";
    const ones = ["", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens = ["", "", "Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    const c = (num: number): string => {
      if (num === 0) return "";
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
      return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " and " + c(num % 100) : "");
    };
    const lakh = Math.floor(n / 100000);
    const rem = n % 100000;
    let r = "";
    if (lakh > 0) r += c(lakh) + " Lakh ";
    const th = Math.floor(rem / 1000);
    const rest = rem % 1000;
    if (th > 0) r += c(th) + " Thousand ";
    if (rest > 0) r += c(rest);
    return r.trim() + " Rupees Only";
  }

  function handleDownloadPdf(bill: Record<string, unknown>) {
    const customer = resolveCustomer(bill) || {};
    downloadBillPdf(bill, customer, settings || {});
  }

  async function sendWhatsApp(bill: Record<string, unknown>) {
    const customer = resolveCustomer(bill);
    const num = customer?.mobile?.toString().replace(/\D/g, "").replace(/^0+/, "");
    if (!num) { toast.error("Customer has no mobile number"); return; }
    toast.info("Sending WhatsApp...");
    const fullNum = num.length === 10 ? `91${num}` : num;
    const shop = (settings?.shopName as string) || "KMJ Optical";
    try {
      const doc = generateBillPdf(bill, customer || {}, settings || {});
      const base64 = doc.output("datauristring").split(",")[1];
      const caption = `*${shop}*\n\nHi ${customer?.name || ""},\nPlease find your bill attached.\n\nThank you!`;
      const mediaRes = await api.post("/api/whatsapp/send-media", { phone: fullNum, base64, filename: `Bill-${bill.billNumber || "invoice"}.pdf`, caption });
      if (mediaRes.success && mediaRes.sent) { toast.success("Bill sent on WhatsApp"); return; }
      if (mediaRes.queued) { toast.info("WhatsApp not ready — will send when connected"); return; }
    } catch {
      // fallback to text
    }
    const items = ((bill.items as Record<string, unknown>[]) || []).map((i) =>
      `${i.description} x${i.quantity || 1} = ₹${(((i.quantity as number) || 1) * ((i.unitPrice as number) || 0)).toFixed(0)}`
    ).join("\n");
    const msg = `*${shop}* 🕶\n\n*Bill:* ${bill.billNumber || ""}\n*Date:* ${new Date().toLocaleDateString("en-IN")}\n\n*Customer:* ${customer?.name || ""}\n*Mobile:* ${customer?.mobile || ""}\n\n*Items:*\n${items}\n\n*Subtotal:* ₹${((bill.subtotal as number) || 0).toFixed(0)}${bill.discount ? `\n*Discount:* -₹${(bill.discount as number).toFixed(0)}` : ""}${bill.tax ? `\n*Tax:* +₹${(bill.tax as number).toFixed(0)}` : ""}\n*Total:* ₹${((bill.totalAmount as number) || 0).toFixed(0)}\n*Paid:* ₹${((bill.advancePaid as number) || 0).toFixed(0)}\n*Pending:* ₹${((bill.pendingAmount as number) || 0).toFixed(0)}\n\nThank you! 🙏`;
    const textRes = await api.post("/api/whatsapp/send", { phone: fullNum, message: msg });
    if (textRes.queued) toast.info("WhatsApp not ready — will send when connected");
    else if (textRes.success && textRes.sent) toast.success("Bill sent on WhatsApp");
    else toast.error("WhatsApp send failed — connect in Settings");
  }

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Bills</h1>
        <p className="page-subtitle">View and manage invoices created through visits and orders.</p>
      </div>

      <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} count={list.length} label="bill" />

      <Table
        columns={[
          { key: "billNumber", label: "Bill #" },
          { key: "customerId", label: "Customer", render: (v: unknown, row: Record<string, unknown>) => {
            const c = resolveCustomer(row);
            return c ? c.name : typeof v === "string" ? (v as string).slice(-6) : "—";
          }},
          { key: "subtotal", label: "Subtotal", render: (v) => `₹${((v as number) || 0).toFixed(2)}` },
          { key: "totalAmount", label: "Total", render: (v) => <span className="font-semibold">₹${((v as number) || 0).toFixed(2)}</span> },
          { key: "pendingAmount", label: "Pending", render: (v) => (
            <span className={(v as number) > 0 ? "text-amber-500 font-medium" : "text-emerald-600"}>{(v as number) > 0 ? `₹${(v as number).toFixed(2)}` : "Paid"}</span>
          )},
        ]}
        data={list}
        searchPlaceholder="Search bills..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => sendWhatsApp(row)} className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400" title="WhatsApp">
              <MessageCircle size={15} />
            </button>
            <button onClick={() => handleDownloadPdf(row)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500" title="Download PDF">
              <PdfIcon size={15} />
            </button>
            <button onClick={() => handlePrint(row)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-600 dark:text-gray-400" title="Print">
              <Printer size={15} />
            </button>
          </div>
        )}
      />
    </div>
  );
}
