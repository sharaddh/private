import { useState, useCallback, useEffect } from "react";
import api from "../api";
import Table from "../components/Table";
import PageSkeleton from "../components/PageSkeleton";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useTranslate } from "../context/TranslateContext";
import { Printer, MessageCircle, FileText as PdfIcon, Trash2 } from "lucide-react";
import { downloadBillPdf, generateBillPdf, generateThermalReceipt } from "../utils/pdf";
import DateRangePicker from "../components/DateRangePicker";
import { todayStr } from "../utils/date";
import { billService, settingsService, whatsappService } from "../services";
import { normalizeWhatsAppPhone } from "../utils/whatsapp";
import type { Bill, ShopSettings } from "../types";

type ResolvedCustomer = { name?: string; mobile?: string; address?: string } | null;

export default function Bills() {
  const [list, setList] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const toast = useToast();
  const { isStaff } = useAuth();
  const { t, uiT } = useTranslate();

  const fetchBills = useCallback(() => {
    setLoading(true);
    billService.listFiltered({ startDate, endDate })
      .then((d) => { if (d.success) setList(d.data?.data || []); })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const fetchSettings = useCallback(() => {
    settingsService.get()
      .then((d) => { if (d.success) setSettings(d.data || null); });
  }, []);

  useEffect(() => {
    fetchBills();
    fetchSettings();
  }, [fetchBills, fetchSettings]);

  function resolveCustomer(bill: Bill): ResolvedCustomer {
    if (typeof bill.customerId === "object" && bill.customerId) return bill.customerId;
    return null;
  }

  function handlePrint(bill: Bill) {
    const w = window.open("", "_blank");
    if (!w) return;

    const shop = settings?.shopName || "KMJ Optical";
    const address = settings?.shopAddress || "";
    const phone = settings?.shopPhone || "";
    const email = settings?.shopEmail || "";
    const logo = settings?.logo || "";
    const customer = resolveCustomer(bill);

    const subtotal = (bill.subtotal || 0).toFixed(2);
    const discount = bill.discount ? bill.discount.toFixed(2) : null;
    const tax = bill.tax ? bill.tax.toFixed(2) : null;
    const totalAmount = (bill.totalAmount || 0).toFixed(2);
    const advancePaid = bill.advancePaid ? bill.advancePaid.toFixed(2) : null;
    const pendingAmount = bill.pendingAmount || 0;
    const billDate = new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const isCancelled = bill.status === "Cancelled";

    const items = (bill.items || []).map((it, idx) => {
      const qty = it.quantity || 1;
      const unitPrice = it.unitPrice || 0;
      return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>${it.description || "—"}</td>
        <td class="center">${qty}</td>
        <td class="right">₹${unitPrice.toFixed(2)}</td>
        <td class="right bold">₹${(qty * unitPrice).toFixed(2)}</td>
      </tr>`;
    }).join("");

    w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${bill.billNumber || ""}</title>
<style>
  :root { --brand: #1e3a8a; --text: #1f2937; --muted: #6b7280; --border: #e5e7eb; --bg: #f9fafb; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-container { padding: 10px !important; }
  }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 0; color: var(--text); line-height: 1.5; }
  .invoice-container { max-width: 800px; margin: 0 auto; padding: 40px; }

  /* Header Section */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid var(--brand); padding-bottom: 20px; }
  .company-info { display: flex; gap: 20px; align-items: center; }
  .logo { max-width: 80px; max-height: 80px; object-fit: contain; }
  .company-details h1 { margin: 0 0 4px 0; font-size: 28px; color: var(--brand); font-weight: 700; }
  .company-details p { margin: 2px 0; font-size: 17px; color: var(--muted); }

  .invoice-meta { text-align: right; }
  .invoice-meta h2 { margin: 0 0 8px 0; font-size: 36px; color: ${isCancelled ? '#dc2626' : 'var(--brand)'}; text-transform: uppercase; letter-spacing: 1px; }
  .invoice-meta p { margin: 4px 0; font-size: 18px; }
  .invoice-meta .label { color: var(--muted); margin-right: 8px; }
  .invoice-meta .value { font-weight: 600; }

  /* Customer Details */
  .bill-to { background: var(--bg); padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid var(--border); }
  .bill-to h3 { margin: 0 0 10px 0; font-size: 16px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px; }
  .bill-to p { margin: 4px 0; font-size: 18px; }
  .bill-to .customer-name { font-size: 16px; font-weight: 600; color: var(--text); }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: var(--brand); color: white; padding: 12px; text-align: left; font-size: 16px; text-transform: uppercase; font-weight: 600; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 12px; border-bottom: 1px solid var(--border); font-size: 18px; }
  .bold { font-weight: 600; }

  /* Summary Section */
  .summary-container { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
  .amount-words { flex: 1; padding-right: 40px; font-size: 16px; color: var(--muted); font-style: italic; }
  .totals-box { width: 320px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 18px; color: var(--muted); }
  .totals-row .val { color: var(--text); font-weight: 500; }
  .totals-row.discount { color: #dc2626; }
  .totals-row.discount .val { color: #dc2626; }
  .totals-row.tax { color: #059669; }
  .totals-row.tax .val { color: #059669; }

  .grand-total { border-top: 2px solid var(--border); border-bottom: 2px solid var(--border); padding: 12px 0; margin-top: 8px; font-size: 22px; font-weight: 700; color: var(--brand); }
  .grand-total .val { color: var(--brand); }

  .balance-due { background: ${pendingAmount > 0 ? '#fffbeb' : '#ecfdf5'}; color: ${pendingAmount > 0 ? '#b45309' : '#047857'}; padding: 12px; border-radius: 6px; margin-top: 12px; font-weight: 700; font-size: 19px; }

  /* Footer */
  .footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 30px; font-size: 16px; color: var(--muted); }
  .terms h4 { margin: 0 0 6px 0; font-size: 16px; color: var(--text); text-transform: uppercase; }
  .terms p { margin: 2px 0; }
  .signature { text-align: center; }
  .sig-line { width: 160px; border-top: 1px solid var(--text); margin-bottom: 8px; }
</style>
</head>
<body>
<div class="invoice-container">

  <div class="header">
    <div class="company-info">
      ${logo ? `<img src="${logo}" class="logo" alt="Logo" />` : ""}
      <div class="company-details">
        <h1>${shop}</h1>
        ${address ? `<p>${address}</p>` : ""}
        ${phone || email ? `<p>${[phone, email].filter(Boolean).join(" | ")}</p>` : ""}
      </div>
    </div>
    <div class="invoice-meta">
      <h2>${isCancelled ? 'CANCELLED' : 'TAX INVOICE'}</h2>
      <p><span class="label">Invoice No:</span> <span class="value">${bill.billNumber || "—"}</span></p>
      <p><span class="label">Date:</span> <span class="value">${billDate}</span></p>
    </div>
  </div>

  <div class="bill-to">
    <h3>Billed To</h3>
    <p class="customer-name">${customer?.name || "Cash Customer"}</p>
    ${customer?.mobile ? `<p>Phone: ${customer.mobile}</p>` : ""}
    ${customer?.address ? `<p>${customer.address}</p>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:40px">#</th>
        <th>Description</th>
        <th class="center" style="width:80px">Qty</th>
        <th class="right" style="width:120px">Unit Price</th>
        <th class="right" style="width:120px">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items || '<tr><td colspan="5" class="center" style="padding: 30px; color: #9ca3af;">No items found</td></tr>'}
    </tbody>
  </table>

  <div class="summary-container">
    <div class="amount-words">
      ${bill.totalAmount ? `Amount in words:<br/><strong>${numberToWords(Math.round(bill.totalAmount))}</strong>` : ""}
    </div>

    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotal</span>
        <span class="val">₹{subtotal}</span>
      </div>
      ${discount ? `<div class="totals-row discount"><span>Discount</span><span class="val">-₹${discount}</span></div>` : ""}
      ${tax ? `<div class="totals-row tax"><span>Tax (GST)</span><span class="val">+₹${tax}</span></div>` : ""}

      <div class="totals-row grand-total">
        <span>Total Amount</span>
        <span class="val">₹{totalAmount}</span>
      </div>

      ${advancePaid ? `<div class="totals-row"><span>Amount Paid</span><span class="val">₹${advancePaid}</span></div>` : ""}

      <div class="totals-row balance-due">
        <span>Balance Due</span>
        <span class="val">₹${pendingAmount.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="terms">
      <h4>Terms & Conditions</h4>
      <p>1. All items are subject to a 7-day inspection period.</p>
      <p>2. Prescription accuracy should be verified within 3 days.</p>
      <p>3. This is a computer-generated invoice.</p>
    </div>
    <div class="signature">
      <div class="sig-line"></div>
      <p>Authorised Signatory</p>
    </div>
  </div>

</div>
<script>
  window.onload = function() { window.print(); }
</script>
</body>
</html>`);
    w.document.close();
  }

  function handleThermalPrint(bill: Bill) {
    const customer = resolveCustomer(bill) || {};
    const receipt = generateThermalReceipt(bill, customer, settings || {});
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><title>Thermal Receipt - ${bill.billNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.3;
         margin: 0; padding: 4mm; width: 72mm; color: #000; background: #fff;
         white-space: pre-wrap; }
  @media print { body { margin: 0; padding: 2mm; } }
</style></head><body>${receipt.replace(/\n/g, "<br>")}
<script>window.onload = function() { window.print(); }</script>
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

  function handleDownloadPdf(bill: Bill) {
    const customer = resolveCustomer(bill) || {};
    downloadBillPdf(bill, customer, settings || {});
  }

  async function handleDelete(bill: Bill) {
    if (!confirm("Delete this bill permanently?")) return;
    const res = await billService.remove(bill._id);
    if (res.success) {
      setList((prev) => prev.filter((b) => b._id !== bill._id));
      toast.success("Bill deleted");
    } else {
      toast.error(res.message || "Failed to delete");
    }
  }

  async function sendWhatsApp(bill: Bill) {
    const customer = resolveCustomer(bill);
    const num = customer?.mobile?.toString();
    const fullNum = normalizeWhatsAppPhone(num || "");
    if (!fullNum) { toast.error("Customer has no mobile number"); return; }
    toast.info("Sending WhatsApp...");
    const shop = settings?.shopName || "KMJ Optical";

    try {
      const doc = generateBillPdf(bill, customer || {}, settings || {});
      const base64 = doc.output("datauristring").split(",")[1];
      const caption = t(
        `*${shop}*\n\nHi ${customer?.name || ""},\nPlease find your bill attached.\n\nThank you!`,
        `*${shop}*\n\nनमस्ते ${customer?.name || ""},\nकृपया अपना बिल संलग्न देखें।\n\nधन्यवाद!`
      );
      const mediaRes = await whatsappService.sendMedia({ phone: fullNum, base64, filename: `Bill-${bill.billNumber || "invoice"}.pdf`, caption, mimetype: "application/pdf" });
      if (mediaRes.success && mediaRes.data?.sent) { toast.success("Bill sent on WhatsApp"); return; }
      if (mediaRes.data?.queued) { toast.info("WhatsApp not ready — will send when connected"); return; }
    } catch {
      // fallback to text
    }

    const items = (bill.items || []).map((i) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("\n");

    const billLabel = t("Bill", "बिल");
    const dateLabel = t("Date", "तारीख");
    const customerLabel = t("Customer", "ग्राहक");
    const mobileLabel = t("Mobile", "मोबाइल");
    const itemsLabel = t("Items", "आइटम");
    const subtotalLabel = t("Subtotal", "उप-कुल");
    const discountLabel = t("Discount", "छूट");
    const taxLabel = t("Tax", "कर");
    const totalLabel = t("Total", "कुल");
    const paidLabel = t("Paid", "भुगतान");
    const pendingLabel = t("Pending", "बाकी");
    const thankYou = t("Thank you!", "धन्यवाद!");
    const msg = `*${shop}* 🕶\n\n*${billLabel}:* ${bill.billNumber || ""}\n*${dateLabel}:* ${new Date().toLocaleDateString("en-IN")}\n\n*${customerLabel}:* ${customer?.name || ""}\n*${mobileLabel}:* ${customer?.mobile || ""}\n\n*${itemsLabel}:*\n${items}\n\n*${subtotalLabel}:* ₹${(bill.subtotal || 0).toFixed(0)}${bill.discount ? `\n*${discountLabel}:* -₹${bill.discount.toFixed(0)}` : ""}${bill.tax ? `\n*${taxLabel}:* +₹${bill.tax.toFixed(0)}` : ""}\n*${totalLabel}:* ₹${(bill.totalAmount || 0).toFixed(0)}\n*${paidLabel}:* ₹${(bill.advancePaid || 0).toFixed(0)}\n*${pendingLabel}:* ₹${(bill.pendingAmount || 0).toFixed(0)}\n\n${thankYou} 🙏`;
    const textRes = await whatsappService.sendMessage({ phone: fullNum, message: msg });
    if (textRes.data?.queued) toast.info("WhatsApp not ready — will send when connected");
    else if (textRes.success && textRes.data?.sent) toast.success("Bill sent on WhatsApp");
    else toast.error(textRes.message || "WhatsApp send failed — check Settings > WhatsApp");
  }

  if (loading) return <PageSkeleton page="bills" />;

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">{uiT("Bills", "बिल")}</h1>
        <p className="page-subtitle">View and manage invoices created through visits and orders.</p>
      </div>

      <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} count={list.length} label="bill" />

      <Table
        columns={[
          { key: "billNumber", label: uiT("Bill #", "बिल #") },
          { key: "customerId", label: uiT("Customer", "ग्राहक"), render: (v: unknown, row: Bill) => {
            const c = resolveCustomer(row);
            return c ? c.name : typeof v === "string" ? v.slice(-6) : "—";
          }},
          { key: "subtotal", label: uiT("Subtotal", "उप-कुल"), render: (v) => `₹${((v as number) || 0).toFixed(2)}` },
          { key: "totalAmount", label: uiT("Total", "कुल"), render: (v) => <span className="font-semibold">₹{((v as number) || 0).toFixed(2)}</span> },
          { key: "pendingAmount", label: uiT("Pending", "बाकी"), render: (v) => (
            <span className={(v as number) > 0 ? "text-[#e8115b] font-medium" : "text-[#1ed760]"}>{(v as number) > 0 ? `₹${(v as number).toFixed(2)}` : uiT("Paid", "भुगतान")}</span>
          )},
        ]}
        data={list}
        searchPlaceholder={uiT("Search bills...", "बिल खोजें...")}
        actions={(row: Bill) => (
          <div className="flex items-center gap-1">
            <button onClick={() => sendWhatsApp(row)} className="p-1.5 hover:bg-[#1ed760]/10 rounded-lg text-[#1ed760] active:scale-95 transition-transform duration-100" title={uiT("WhatsApp", "WhatsApp")} aria-label="Send WhatsApp">
              <MessageCircle size={15} />
            </button>
            <button onClick={() => handleDownloadPdf(row)} className="p-1.5 hover:bg-[#e8115b]/10 rounded-lg text-[#e8115b] active:scale-95 transition-transform duration-100" title={uiT("Download PDF", "PDF डाउनलोड करें")} aria-label="Download PDF">
              <PdfIcon size={15} />
            </button>
            <button onClick={() => handleThermalPrint(row)} className="p-1.5 hover:bg-th-elevated rounded-lg text-th-secondary active:scale-95 transition-transform duration-100" title={uiT("Thermal Receipt (80mm)", "थर्मल रसीद (80mm)")} aria-label="Thermal print">
              <Printer size={15} />
            </button>
            {!isStaff && (
              <button onClick={() => handleDelete(row)} className="p-1.5 hover:bg-[#e8115b]/10 rounded-lg text-[#e8115b] active:scale-95 transition-transform duration-100" title={uiT("Delete", "हटाएं")} aria-label="Delete bill">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      />
    </div>
  );
}
