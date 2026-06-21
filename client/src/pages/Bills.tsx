import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Toast from "../components/Toast";
import { Printer, MessageCircle, FileText as PdfIcon, FileText } from "lucide-react";
import { downloadBillPdf } from "../utils/pdf";

export default function Bills() {
  const [list, setList] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => { fetchBills(); fetchSettings(); }, []);

  function fetchBills() { api.get("/api/bills").then((d) => { if (d.success) setList(d.data || []); }); }
  function fetchSettings() { api.get("/api/settings").then((d) => { if (d.success) setSettings(d.data); }); }

  function resolveCustomer(bill: any) {
    if (typeof bill.customerId === "object" && bill.customerId) return bill.customerId;
    return null;
  }

  function handlePrint(bill: any) {
    const w = window.open("", "_blank");
    if (!w) return;
    const shop = settings?.shopName || "KMJ Optical";
    const address = settings?.shopAddress || "";
    const phone = settings?.shopPhone || "";
    const email = settings?.shopEmail || "";
    const logo = settings?.logo || "";
    const customer = resolveCustomer(bill);
    const items = (bill.items || []).map((it: any) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;color:#374151">${it.description || ""}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center;color:#374151">${it.quantity || 1}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:right;color:#374151">₹${(it.unitPrice || 0).toFixed(2)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:right;color:#374151;font-weight:500">₹${((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td>
      </tr>
    `).join("");
    w.document.write(`<!DOCTYPE html>
<html><head><title>Invoice ${bill.billNumber}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body{font-family:system-ui,sans-serif;margin:0;padding:0;color:#111827;background:#fff}
  .page{max-width:800px;margin:auto;padding:30px}
  .top-bar{background:#1e40af;height:6px;margin:-30px -30px 0;border-radius:0}
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
      <div class="value">${new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
      <div class="sub-label">Status</div>
      <div class="value" style="color:${bill.status === "Cancelled" ? "#dc2626" : "#111827"}">${bill.status || "Active"}</div>
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
    <div class="row"><span>Subtotal</span><span>₹${(bill.subtotal || 0).toFixed(2)}</span></div>
    ${bill.discount ? `<div class="row red"><span>Discount</span><span>-₹${bill.discount.toFixed(2)}</span></div>` : ""}
    ${bill.tax ? `<div class="row green"><span>GST</span><span>+₹${bill.tax.toFixed(2)}</span></div>` : ""}
    <div class="row bold divider"><span>Total Amount</span><span>₹${(bill.totalAmount || 0).toFixed(2)}</span></div>
    ${bill.advancePaid ? `<div class="row green"><span>Paid</span><span>₹${bill.advancePaid.toFixed(2)}</span></div>` : ""}
    ${bill.pendingAmount && bill.pendingAmount > 0 ? `<div class="row bold orange divider"><span>Balance Due</span><span>₹${bill.pendingAmount.toFixed(2)}</span></div>` : ""}
  </div>
  ${bill.totalAmount ? `<div class="words">Amount in Words: ${numberToWords(Math.round(bill.totalAmount))}</div>` : ""}
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

  function handleDownloadPdf(bill: any) {
    const customer = resolveCustomer(bill) || {};
    downloadBillPdf(bill, customer, settings || {});
  }

  async function sendWhatsApp(bill: any) {
    const customer = resolveCustomer(bill);
    const num = customer?.mobile?.replace(/\D/g, "");
    if (!num) { setToast({ message: "Customer has no mobile number", type: "error" }); return; }
    setToast({ message: "Sending WhatsApp...", type: "info" });
    const fullNum = num.length === 10 ? `91${num}` : num;
    const shop = settings?.shopName || "KMJ Optical";
    try {
      const { generateBillPdf } = await import("../utils/pdf");
      const doc = generateBillPdf(bill, customer || {}, settings || {});
      const base64 = doc.output("datauristring").split(",")[1];
      const caption = `*${shop}*\n\nHi ${customer?.name || ""},\nPlease find your bill attached.\n\nThank you!`;
      const mediaRes = await api.post("/api/whatsapp/send-media", { phone: fullNum, base64, filename: `Bill-${bill.billNumber || "invoice"}.pdf`, caption });
      if (mediaRes.success && mediaRes.sent) { setToast({ message: "Bill sent on WhatsApp", type: "success" }); return; }
      if (mediaRes.queued) { setToast({ message: "WhatsApp not ready — will send when connected", type: "info" }); return; }
    } catch (e) {
      console.warn("WhatsApp PDF send error:", e);
    }
    const items = (bill.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("\n");
    const msg = `*${shop}* 🕶\n\n*Bill:* ${bill.billNumber || ""}\n*Date:* ${new Date().toLocaleDateString("en-IN")}\n\n*Customer:* ${customer?.name || ""}\n*Mobile:* ${customer?.mobile || ""}\n\n*Items:*\n${items}\n\n*Subtotal:* ₹${(bill.subtotal || 0).toFixed(0)}${bill.discount ? `\n*Discount:* -₹${bill.discount.toFixed(0)}` : ""}${bill.tax ? `\n*Tax:* +₹${bill.tax.toFixed(0)}` : ""}\n*Total:* ₹${(bill.totalAmount || 0).toFixed(0)}\n*Paid:* ₹${(bill.advancePaid || 0).toFixed(0)}\n*Pending:* ₹${(bill.pendingAmount || 0).toFixed(0)}\n\nThank you! 🙏`;
    const textRes = await api.post("/api/whatsapp/send", { phone: fullNum, message: msg });
    if (textRes.queued) {
      setToast({ message: "WhatsApp not ready — will send when connected", type: "info" });
    } else if (textRes.success && textRes.sent) {
      setToast({ message: "Bill sent on WhatsApp", type: "success" });
    } else {
      setToast({ message: "WhatsApp send failed — connect in Settings", type: "error" });
    }
  }

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Bills</h1>
        <p className="page-subtitle">View and manage invoices created through visits and orders.</p>
      </div>

      <Table
        columns={[
          { key: "billNumber", label: "Bill #" },
          { key: "customerId", label: "Customer", render: (v: any, row: any) => {
            const c = resolveCustomer(row);
            return c ? c.name : typeof v === "string" ? v.slice(-6) : "—";
          }},
          { key: "subtotal", label: "Subtotal", render: (v) => `₹${(v || 0).toFixed(2)}` },
          { key: "totalAmount", label: "Total", render: (v) => <span className="font-semibold">₹{(v || 0).toFixed(2)}</span> },
          { key: "pendingAmount", label: "Pending", render: (v) => (
            <span className={v > 0 ? "text-amber-500 font-medium" : "text-emerald-600"}>{v > 0 ? `₹${v.toFixed(2)}` : "Paid"}</span>
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
