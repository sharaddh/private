import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import { Printer, MessageCircle, FileText as PdfIcon } from "lucide-react";
import { downloadBillPdf } from "../utils/pdf";

export default function Bills() {
  const [list, setList] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => { fetchBills(); fetchSettings(); }, []);

  function fetchBills() {
    api.get("/api/bills").then((d) => { if (d.success) setList(d.data || []); });
  }

  function fetchSettings() {
    api.get("/api/settings").then((d) => { if (d.success) setSettings(d.data); });
  }

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
    const logo = settings?.logo || "";
    const customer = resolveCustomer(bill);
    w.document.write(`
      <html><head><title>Bill ${bill.billNumber}</title>
      <style>
        body{font-family:system-ui;padding:40px;max-width:800px;margin:auto;color:#333}
        .header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #eee}
        .logo{max-width:120px;max-height:120px;margin-bottom:10px}
        h1{font-size:26px;margin:4px 0;color:#111}
        .shop-info{color:#666;font-size:13px;line-height:1.6}
        .bill-meta{display:flex;justify-content:space-between;margin:20px 0;font-size:14px;color:#555}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th,td{border:1px solid #ddd;padding:10px 14px;text-align:left}
        th{background:#f8f8f8;font-weight:600;font-size:13px}
        .right{text-align:right}
        .totals{text-align:right;font-size:15px;margin-top:20px}
        .totals p{margin:4px 0}
        .grand-total{font-size:20px;font-weight:bold;margin-top:8px;padding-top:8px;border-top:2px solid #333}
        .footer{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #eee;color:#999;font-size:12px}
      </style></head><body>
      <div class="header">
        ${logo ? `<img src="${logo}" class="logo" alt="Logo" />` : ""}
        <h1>${shop}</h1>
        ${address ? `<p class="shop-info">${address}</p>` : ""}
        ${phone ? `<p class="shop-info">${phone}</p>` : ""}
      </div>
      <div class="bill-meta">
        <div><strong>${bill.billNumber || ""}</strong></div>
        <div>Date: ${new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
      </div>
      ${customer ? `<p style="font-size:14px;color:#555;margin-bottom:16px"><strong>Customer:</strong> ${customer.name || ""} ${customer.mobile ? `(${customer.mobile})` : ""}</p>` : ""}
      <table>
        <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
        ${(bill.items || []).map((it: any) => `
          <tr><td>${it.description || ""}</td><td>${it.quantity || 1}</td>
          <td class="right">₹${(it.unitPrice || 0).toFixed(2)}</td>
          <td class="right">₹${((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td></tr>
        `).join("")}
      </table>
      <div class="totals">
        <p>Subtotal: ₹${(bill.subtotal || 0).toFixed(2)}</p>
        ${bill.discount ? `<p>Discount: -₹${bill.discount.toFixed(2)}</p>` : ""}
        ${bill.tax ? `<p>Tax: +₹${bill.tax.toFixed(2)}</p>` : ""}
        <p class="grand-total">Total: ₹${(bill.totalAmount || 0).toFixed(2)}</p>
        ${bill.advancePaid ? `<p style="color:#059669">Advance Paid: ₹${bill.advancePaid.toFixed(2)}</p>` : ""}
        ${bill.pendingAmount ? `<p style="color:#d97706">Pending: ₹${bill.pendingAmount.toFixed(2)}</p>` : ""}
      </div>
      <div class="footer">Thank you for your visit!</div>
      <script>window.print()</script></body></html>
    `);
    w.document.close();
  }

  function handleDownloadPdf(bill: any) {
    const customer = resolveCustomer(bill) || {};
    downloadBillPdf(bill, customer, settings || {});
  }

  function sendWhatsApp(bill: any) {
    const customer = resolveCustomer(bill);
    const num = customer?.mobile?.replace(/\D/g, "");
    if (!num) return;
    const adminNum = settings?.adminWhatsApp?.replace(/\D/g, "") || "91";
    const shop = settings?.shopName || "KMJ Optical";
    const items = (bill.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("%0a");
    const msg = `*${shop}* 🕶%0a%0a*Bill:* ${bill.billNumber || ""}%0a*Date:* ${new Date().toLocaleDateString("en-IN")}%0a%0a*Customer:* ${customer?.name || ""}%0a*Mobile:* ${customer?.mobile || ""}%0a%0a*Items:*%0a${items}%0a%0a*Subtotal:* ₹${(bill.subtotal || 0).toFixed(0)}%0a${bill.discount ? `*Discount:* -₹${bill.discount.toFixed(0)}%0a` : ""}${bill.tax ? `*Tax:* +₹${bill.tax.toFixed(0)}%0a` : ""}*Total:* ₹${(bill.totalAmount || 0).toFixed(0)}%0a*Paid:* ₹${(bill.advancePaid || 0).toFixed(0)}%0a*Pending:* ₹${(bill.pendingAmount || 0).toFixed(0)}%0a%0aThank you! 🙏`;
    window.open(`https://wa.me/${adminNum}?text=${msg}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Bills</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage invoices. Bills are created through customer visits and orders.</p>
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
            <span className={v > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400"}>{v > 0 ? `₹${v.toFixed(2)}` : "Paid"}</span>
          )},
        ]}
        data={list}
        searchPlaceholder="Search bills..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => sendWhatsApp(row)} className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400" title="Send WhatsApp">
              <MessageCircle size={15} />
            </button>
            <button onClick={() => handleDownloadPdf(row)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400" title="Download PDF">
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
