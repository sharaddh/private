import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";
applyPlugin(jsPDF);

interface PdfBillItem {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

interface PdfBill {
  billNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: PdfBillItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  advancePaid?: number;
  pendingAmount?: number;
  totalAmount?: number;
  status?: string;
}

interface PdfCustomer {
  name?: string;
  mobile?: string;
  address?: string;
  customerId?: string;
}

interface PdfSettings {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  logo?: string;
}

type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const primary: RGB = [30, 64, 175];
const primaryLight: RGB = [239, 242, 255];
const slate50: RGB = [248, 250, 252];
const gray: RGB = [107, 114, 128];
const dark: RGB = [17, 24, 39];
const border: RGB = [229, 231, 235];
const success: RGB = [5, 150, 105];
const danger: RGB = [220, 38, 38];
const warning: RGB = [217, 119, 6];

const CURRENCY = "Rs.";
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_RESERVE = 24; // mm kept clear at the bottom of every page

function fmt(n?: number): string {
  return `${CURRENCY}${(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function numberToWords(n: number): string {
  const value = Math.round(n || 0);
  if (value <= 0) return "Zero Rupees Only";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const belowThousand = (num: number): string => {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + belowThousand(num % 100) : "");
  };

  const parts: string[] = [];
  let remainder = value;

  const crore = Math.floor(remainder / 1e7);
  remainder %= 1e7;
  const lakh = Math.floor(remainder / 1e5);
  remainder %= 1e5;
  const thousand = Math.floor(remainder / 1e3);
  remainder %= 1e3;

  if (crore) parts.push(belowThousand(crore) + " Crore");
  if (lakh) parts.push(belowThousand(lakh) + " Lakh");
  if (thousand) parts.push(belowThousand(thousand) + " Thousand");
  if (remainder) parts.push(belowThousand(remainder));

  return parts.join(" ").trim() + " Rupees Only";
}

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------
function setText(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function setFill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function setDraw(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

/** Lighten a color toward white — used for status-pill backgrounds. */
function tint(c: RGB, amount = 0.88): RGB {
  return [
    Math.round(c[0] + (255 - c[0]) * amount),
    Math.round(c[1] + (255 - c[1]) * amount),
    Math.round(c[2] + (255 - c[2]) * amount),
  ];
}

/** Lightweight header repeated on page 2+ so continuation pages stay identifiable. */
function drawContinuationHeader(doc: jsPDF, billNumber?: string) {
  setFill(doc, primary);
  doc.rect(0, 0, PAGE_W, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, gray);
  doc.text(`Invoice ${billNumber ? `#${billNumber}` : ""}`.trim(), MARGIN, 13);

  setDraw(doc, border);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 17, PAGE_W - MARGIN, 17);
  doc.setLineWidth(0.1);
}

/** Ensures `needed` mm of vertical space remain on the page; starts a new page (with continuation header) otherwise. */
function ensureSpace(doc: jsPDF, y: number, needed: number, billNumber?: string): number {
  if (y + needed > PAGE_H - FOOTER_RESERVE) {
    doc.addPage();
    drawContinuationHeader(doc, billNumber);
    return MARGIN + 18;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/** Shop branding band: logo (aspect-ratio preserved) + shop name/contact, right-aligned. */
function drawHeader(doc: jsPDF, settings: PdfSettings): number {
  const accentH = 4;
  const headerTop = accentH;
  const headerH = 38;
  const headerCenterY = headerTop + headerH / 2;

  setFill(doc, primary);
  doc.rect(0, 0, PAGE_W, accentH, "F");

  setFill(doc, slate50);
  doc.rect(0, headerTop, PAGE_W, headerH, "F");

  // --- Logo: fit inside a box, preserving aspect ratio (no stretching/overflow) ---
  if (settings.logo) {
    const maxLogoW = 64;
    const maxLogoH = 50;
    let logoW = maxLogoW;
    let logoH = maxLogoH;

    let format: "PNG" | "JPEG" | "GIF" | "WEBP" = "PNG";
    if (settings.logo.startsWith("data:image/jpeg") || settings.logo.startsWith("data:image/jpg")) format = "JPEG";
    else if (settings.logo.startsWith("data:image/gif")) format = "GIF";
    else if (settings.logo.startsWith("data:image/webp")) format = "WEBP";

    try {
      const props = doc.getImageProperties(settings.logo);
      const aspect = props.width / props.height;
      logoW = maxLogoW;
      logoH = logoW / aspect;
      if (logoH > maxLogoH) {
        logoH = maxLogoH;
        logoW = logoH * aspect;
      }
    } catch {
      // Couldn't read dimensions — fall back to the default box above.
    }

    const logoX = MARGIN;
    const logoY = headerCenterY - logoH / 2;
    try {
      doc.addImage(settings.logo, format, logoX, logoY, logoW, logoH);
    } catch {
      try {
        doc.addImage(settings.logo, "PNG", logoX, logoY, logoW, logoH);
      } catch {
        try {
          doc.addImage(settings.logo, "JPEG", logoX, logoY, logoW, logoH);
        } catch {
          /* give up silently — a missing logo shouldn't break the invoice */
        }
      }
    }
  }

  // --- Shop name + contact lines, right-aligned, centered on the header band ---
  const rightX = PAGE_W - MARGIN;

  const scale = doc.internal.scaleFactor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const titleLH = doc.getLineHeight() / scale;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const infoLH = doc.getLineHeight() / scale;

  const infoLines: string[] = [];
  if (settings.shopAddress) infoLines.push(settings.shopAddress);
  if (settings.shopPhone) infoLines.push(`Phone: ${settings.shopPhone}`);
  if (settings.shopEmail) infoLines.push(`Email: ${settings.shopEmail}`);

  const titleGap = 1.6;
  const lineGap = 0.8;
  let blockHeight = titleLH;
  if (infoLines.length) {
    blockHeight += titleGap + infoLines.length * infoLH + (infoLines.length - 1) * lineGap;
  }

  let cy = headerCenterY - blockHeight / 2 + titleLH * 0.78;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, dark);
  doc.text(settings.shopName || "Optical Shop", rightX, cy, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, gray);
  infoLines.forEach((line, i) => {
    cy += i === 0 ? titleGap + infoLH : lineGap + infoLH;
    doc.text(line, rightX, cy, { align: "right" });
  });

  // Divider
  const lineY = headerTop + headerH;
  setDraw(doc, border);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, lineY, PAGE_W - MARGIN, lineY);
  doc.setLineWidth(0.1);

  return lineY + 8;
}

function resolveStatus(bill: PdfBill): { label: string; color: RGB } {
  const raw = (bill.status || "").toLowerCase();
  if (raw.includes("cancel")) return { label: "CANCELLED", color: danger };
  if (raw.includes("partial")) return { label: "PARTIALLY PAID", color: warning };
  if (raw.includes("pending") || raw.includes("due")) return { label: "PENDING", color: warning };
  if (raw.includes("paid")) return { label: "PAID", color: success };
  if (bill.pendingAmount && bill.pendingAmount > 0) return { label: "PENDING", color: warning };
  return { label: "PAID", color: success };
}

function drawStatusPill(doc: jsPDF, label: string, color: RGB, x: number, baselineY: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const textW = doc.getTextWidth(label);
  const padX = 2.6;
  const pillW = textW + padX * 2;
  const pillH = 4.6;

  setFill(doc, tint(color));
  doc.roundedRect(x, baselineY - pillH + 1.1, pillW, pillH, pillH / 2, pillH / 2, "F");
  setText(doc, color);
  doc.text(label, x + padX, baselineY);
}

/** Left: big "INVOICE" mark + invoice no./date/status. Right: "Billed To" customer block. */
function drawMetaSection(doc: jsPDF, bill: PdfBill, customer: PdfCustomer, startY: number): number {
  const leftX = MARGIN;
  const rightColX = PAGE_W / 2 + 6;
  const labelColW = 26;

  // --- Left column ---
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setText(doc, primary);
  doc.text("INVOICE", leftX, y);
  y += 8;

  const rowGap = 5.4;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setText(doc, gray);
  doc.text("INVOICE NO.", leftX, y);
  doc.setFontSize(10);
  setText(doc, dark);
  doc.text(bill.billNumber || "—", leftX + labelColW, y);
  y += rowGap;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setText(doc, gray);
  doc.text("DATE", leftX, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setText(doc, dark);
  const billDate = bill.createdAt
    ? new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  doc.text(billDate, leftX + labelColW, y);
  y += rowGap;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setText(doc, gray);
  doc.text("STATUS", leftX, y);
  const status = resolveStatus(bill);
  drawStatusPill(doc, status.label, status.color, leftX + labelColW, y);

  const leftBottom = y + 3;

  // --- Right column: Billed To ---
  let ry = startY;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setText(doc, gray);
  doc.text("BILLED TO", rightColX, ry);
  ry += 6;

  doc.setFontSize(11.5);
  doc.setFont("helvetica", "bold");
  setText(doc, dark);
  doc.text(customer.name || "—", rightColX, ry);
  ry += 5.5;

  doc.setFontSize(8.5);
  setText(doc, gray);

  const custDetails: { label: string; value: string }[] = [];
  if (customer.mobile) custDetails.push({ label: "Mobile", value: customer.mobile });
  if (customer.customerId) custDetails.push({ label: "Customer ID", value: customer.customerId });
  if (customer.address) custDetails.push({ label: "Address", value: customer.address });

  custDetails.forEach((d) => {
    doc.setFont("helvetica", "bold");
    setText(doc, gray);
    doc.text(`${d.label}: `, rightColX, ry);
    const labelW = doc.getTextWidth(`${d.label}: `);

    doc.setFont("helvetica", "normal");
    setText(doc, dark);
    const maxW = PAGE_W - MARGIN - rightColX - labelW;
    const wrapped = doc.splitTextToSize(d.value, Math.max(maxW, 20));
    doc.text(wrapped, rightColX + labelW, ry);
    ry += 4.6 * wrapped.length;
  });

  return Math.max(leftBottom, ry) + 6;
}

function drawItemsTable(doc: jsPDF, bill: PdfBill, startY: number): number {
  const tableBody = (bill.items || []).map((it, i) => [
    `${i + 1}`,
    it.description || "Item",
    String(it.quantity || 1),
    fmt(it.unitPrice || 0),
    fmt((it.quantity || 1) * (it.unitPrice || 0)),
  ]);
  if (tableBody.length === 0) {
    tableBody.push(["1", "No items", "—", "—", "—"]);
  }

  // Exact-sum column widths so the table always fills CONTENT_W precisely.
  const col0W = 10;
  const remaining = CONTENT_W - col0W;
  const colQtyW = remaining * 0.12;
  const colPriceW = remaining * 0.24;
  const colTotalW = remaining * 0.24;
  const colDescW = remaining - colQtyW - colPriceW - colTotalW;

  (doc as any).autoTable({
    startY,
    head: [["#", "Description", "Qty", "Unit Price", "Total"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: dark,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: col0W, halign: "center" },
      1: { cellWidth: colDescW },
      2: { cellWidth: colQtyW, halign: "center" },
      3: { cellWidth: colPriceW, halign: "right" },
      4: { cellWidth: colTotalW, halign: "right" },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: MARGIN, right: MARGIN, top: 18, bottom: FOOTER_RESERVE },
    tableWidth: CONTENT_W,
    tableLineColor: border,
    tableLineWidth: 0.2,
    didDrawPage: (data: any) => {
      // If the table itself spans multiple pages, keep continuation pages identifiable.
      if (data.pageNumber > 1) drawContinuationHeader(doc, bill.billNumber);
    },
  });

  return (doc as any).lastAutoTable.finalY + 8;
}

function drawTotalsBox(doc: jsPDF, bill: PdfBill, startY: number): number {
  const totalW = 85;
  const totalX = PAGE_W - MARGIN - totalW;

  const rows: { label: string; value: string; bold?: boolean; color?: RGB }[] = [
    { label: "Subtotal", value: fmt(bill.subtotal || 0) },
  ];
  rows.push({ label: "Discount", value: `- ${fmt(bill.discount || 0)}`, color: danger });
  rows.push({ label: "GST", value: `+ ${fmt(bill.tax || 0)}`, color: success });
  rows.push({ label: "Total Amount", value: fmt(bill.totalAmount || 0), bold: true });
  rows.push({ label: "Paid", value: fmt(bill.advancePaid || 0), color: success });
  rows.push({ label: "Balance Due", value: fmt(bill.pendingAmount || 0), color: warning, bold: true });

  const rowH = 7;
  const padTop = 4;
  const boxH = rows.length * rowH + padTop * 2;

  const y = ensureSpace(doc, startY, boxH + 4, bill.billNumber);

  setFill(doc, primaryLight);
  doc.roundedRect(totalX, y, totalW, boxH, 3, 3, "F");
  setDraw(doc, border);
  doc.setLineWidth(0.4);
  doc.roundedRect(totalX, y, totalW, boxH, 3, 3, "S");
  doc.setLineWidth(0.1);

  // Divide the running calculation (subtotal → total) from the payment status rows that follow it.
  const totalIdx = rows.findIndex((r) => r.label === "Total Amount");

  let ty = y + padTop + rowH * 0.68;
  rows.forEach((row, i) => {
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(row.bold ? 10 : 9);
    setText(doc, row.color || dark);
    doc.text(row.label, totalX + 7, ty);
    doc.text(row.value, totalX + totalW - 7, ty, { align: "right" });

    if (i === totalIdx && i < rows.length - 1) {
      setDraw(doc, primary);
      doc.setLineWidth(0.5);
      doc.line(totalX + 7, ty + rowH * 0.5, totalX + totalW - 7, ty + rowH * 0.5);
      doc.setLineWidth(0.1);
    }
    ty += rowH;
  });

  return y + boxH + 8;
}

function drawAmountInWords(doc: jsPDF, bill: PdfBill, startY: number): number {
  if (!bill.totalAmount || bill.totalAmount <= 0) return startY;

  const words = numberToWords(bill.totalAmount);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  const wrapped = doc.splitTextToSize(words, CONTENT_W);
  const needed = 5 + wrapped.length * 4.2 + 6;

  const y = ensureSpace(doc, startY, needed, bill.billNumber);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, gray);
  doc.text("AMOUNT IN WORDS", MARGIN, y);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  setText(doc, dark);
  doc.text(wrapped, MARGIN, y + 5);

  return y + 5 + wrapped.length * 4.2 + 6;
}

function drawTermsAndThanks(doc: jsPDF, bill: PdfBill, settings: PdfSettings, startY: number): void {
  const terms = [
    "1. Goods once sold will not be taken back or exchanged.",
    "2. Prescription accuracy must be verified within 3 days of delivery.",
    "3. Warranty covers manufacturing defects only; does not cover scratches or breakage.",
    "4. This is a computer-generated invoice and does not require a physical signature.",
  ];
  const blockH = 6 + 5 + terms.length * 4 + 12;
  let y = ensureSpace(doc, startY, blockH, bill.billNumber);

  setDraw(doc, border);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setLineWidth(0.1);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setText(doc, dark);
  doc.text("Terms & Conditions", MARGIN, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  setText(doc, gray);
  terms.forEach((t, i) => doc.text(t, MARGIN, y + 5 + i * 4));

  y += 5 + terms.length * 4 + 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  setText(doc, primary);
  doc.text(`Thank you for choosing ${settings.shopName || "us"}!`, PAGE_W / 2, y, { align: "center" });
}

function stampFooters(doc: jsPDF, settings: PdfSettings) {
  const totalPages = doc.getNumberOfPages();
  const footerY = PAGE_H - 17;
  const footerParts = [settings.shopAddress, settings.shopPhone, settings.shopEmail].filter(Boolean);

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    setDraw(doc, border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, footerY, PAGE_W - MARGIN, footerY);
    doc.setLineWidth(0.1);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setText(doc, gray);
    if (footerParts.length) {
      doc.text(footerParts.join("   |   "), PAGE_W / 2, footerY + 5, { align: "center" });
    }

    doc.setFontSize(6);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, footerY + 9.5, { align: "right" });

    if (i === totalPages) {
      doc.text(`Invoice generated on ${new Date().toLocaleString("en-IN")}`, MARGIN, footerY + 9.5);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API (unchanged signatures — drop-in replacement)
// ---------------------------------------------------------------------------

export function generateBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings) {
  const doc = new jsPDF("p", "mm", "a4");

  let y = drawHeader(doc, settings);
  y = drawMetaSection(doc, bill, customer, y);
  y = drawItemsTable(doc, bill, y);
  y = drawTotalsBox(doc, bill, y);
  y = drawAmountInWords(doc, bill, y);
  drawTermsAndThanks(doc, bill, settings, y);
  stampFooters(doc, settings);

  return doc;
}

export function downloadBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings) {
  const doc = generateBillPdf(bill, customer, settings);
  doc.save(`Bill-${bill.billNumber || "invoice"}.pdf`);
}

export function openBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings) {
  const doc = generateBillPdf(bill, customer, settings);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

// ---------------------------------------------------------------------------
// Thermal (40-column) receipt — plain text, for receipt printers
// ---------------------------------------------------------------------------

function padCenter(str: string, width: number): string {
  if (str.length >= width) return str;
  const left = Math.floor((width - str.length) / 2);
  return " ".repeat(left) + str;
}

/** Right-aligns a currency amount against a label within a fixed character width. */
function moneyLine(label: string, amount: number, width: number, sign: "" | "+" | "-" = ""): string {
  const value = `${sign}${CURRENCY}${Math.abs(amount || 0).toFixed(2)}`;
  const used = label.length + value.length + 2; // 2 leading spaces
  const padding = Math.max(width - used, 1);
  return `  ${label}${" ".repeat(padding)}${value}`;
}

export function generateThermalReceipt(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings): string {
  const WIDTH = 40;
  const L = "-".repeat(WIDTH);
  const shopName = settings.shopName || "OPTICAL SHOP";
  const address = settings.shopAddress || "";
  const phone = settings.shopPhone || "";
  const email = settings.shopEmail || "";
  const billDate = bill.createdAt
    ? new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const lines: string[] = [];

  lines.push("");
  lines.push(padCenter("TAX INVOICE", WIDTH));
  lines.push(padCenter(shopName, WIDTH));
  if (address) lines.push(padCenter(address, WIDTH));
  if (phone) lines.push(padCenter(`Ph: ${phone}`, WIDTH));
  if (email) lines.push(padCenter(email, WIDTH));
  lines.push(L);
  lines.push(`  Bill #: ${bill.billNumber || "—"}`);
  lines.push(`  Date:   ${billDate}`);
  lines.push(`  Customer: ${customer.name || "—"}`);
  if (customer.mobile) lines.push(`  Mobile:   ${customer.mobile}`);
  if (customer.address) lines.push(`  Address:  ${customer.address}`);
  lines.push(L);
  lines.push("  Items");
  lines.push(L);

  const items = bill.items || [];
  if (items.length === 0) {
    lines.push("  No items");
  } else {
    items.forEach((it, i) => {
      const desc = it.description || "Item";
      const qty = it.quantity || 1;
      const price = it.unitPrice || 0;
      const total = qty * price;
      lines.push(`  ${i + 1}. ${desc}`);
      lines.push(`     Qty: ${qty}  x  ${CURRENCY}${price.toFixed(2)}  =  ${CURRENCY}${total.toFixed(2)}`);
    });
  }

  lines.push(L);
  lines.push(moneyLine("Subtotal:", bill.subtotal || 0, WIDTH));
  if (bill.discount) lines.push(moneyLine("Discount:", bill.discount, WIDTH, "-"));
  if (bill.tax) lines.push(moneyLine("GST:", bill.tax, WIDTH, "+"));
  lines.push(moneyLine("TOTAL:", bill.totalAmount || 0, WIDTH));
  if (bill.advancePaid) lines.push(moneyLine("Paid:", bill.advancePaid, WIDTH));
  if (bill.pendingAmount && bill.pendingAmount > 0) {
    lines.push(moneyLine("Balance Due:", bill.pendingAmount, WIDTH));
  }

  lines.push(L);
  lines.push(padCenter("Thank you for choosing us!", WIDTH));
  lines.push("");
  lines.push(padCenter(`Generated on ${new Date().toLocaleString("en-IN")}`, WIDTH));
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Prescription PDF
// ---------------------------------------------------------------------------

interface PdfRxEye {
  dv?: { sph?: number; cyl?: number; axis?: number; va?: string };
  nv?: { sph?: number; cyl?: number; axis?: number; va?: string };
  pc?: { sph?: number; cyl?: number; axis?: number; va?: string };
}

interface PdfPrescription {
  rightEye?: PdfRxEye;
  leftEye?: PdfRxEye;
  pd?: string;
  notes?: string;
  createdAt?: string;
}

function fmtRxVal(v?: number): string {
  if (v == null) return "—";
  return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
}

function drawRxRow(doc: jsPDF, label: string, data: { sph?: number; cyl?: number; axis?: number; va?: string } | undefined, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, primary);
  doc.text(label, x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, dark);

  if (!data || (data.sph == null && data.cyl == null && data.axis == null)) {
    doc.setFont("helvetica", "italic");
    setText(doc, gray);
    doc.text("Plain", x + 14, y);
    return y + 5.5;
  }

  const parts: string[] = [];
  if (data.sph != null) parts.push(`SPH ${fmtRxVal(data.sph)}`);
  if (data.cyl != null) parts.push(`CYL ${fmtRxVal(data.cyl)}`);
  if (data.axis != null) parts.push(`AXIS ${data.axis}`);
  if (data.va) parts.push(`VA ${data.va}`);
  doc.text(parts.join("   "), x + 14, y);
  return y + 5.5;
}

function drawRxEyeSection(doc: jsPDF, title: string, color: RGB, eye: PdfRxEye | undefined, x: number, y: number): number {
  setFill(doc, tint(color, 0.92));
  doc.roundedRect(x, y - 4, CONTENT_W / 2 - 2, 8, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, color);
  doc.text(title, x + 3, y + 1.5);
  y += 8;

  y = drawRxRow(doc, "DV", eye?.dv, x + 2, y);
  y = drawRxRow(doc, "NV", eye?.nv, x + 2, y);
  y = drawRxRow(doc, "PC", eye?.pc, x + 2, y);
  return y;
}

export function generatePrescriptionPdf(
  rx: PdfPrescription,
  customer: PdfCustomer,
  settings: PdfSettings,
): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");

  // Header
  setFill(doc, primary);
  doc.rect(0, 0, PAGE_W, 4, "F");

  setFill(doc, slate50);
  doc.rect(0, 4, PAGE_W, 30, "F");

  const rightX = PAGE_W - MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, dark);
  doc.text(settings.shopName || "Optical Shop", rightX, 17, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, gray);
  let infoY = 22;
  if (settings.shopAddress) { doc.text(settings.shopAddress, rightX, infoY, { align: "right" }); infoY += 4; }
  if (settings.shopPhone) { doc.text(`Phone: ${settings.shopPhone}`, rightX, infoY, { align: "right" }); infoY += 4; }

  const lineY = 38;
  setDraw(doc, border);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, lineY, PAGE_W - MARGIN, lineY);
  doc.setLineWidth(0.1);

  // Title
  let y = lineY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setText(doc, primary);
  doc.text("PRESCRIPTION", MARGIN, y);
  y += 4;

  const rxDate = rx.createdAt
    ? new Date(rx.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, gray);
  doc.text(`Date: ${rxDate}`, MARGIN, y);
  y += 8;

  // Customer info
  setFill(doc, slate50);
  doc.roundedRect(MARGIN, y - 4, CONTENT_W, customer.name || customer.mobile ? 14 : 0, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, dark);
  doc.text(`Patient: ${customer.name || "—"}`, MARGIN + 3, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, gray);
  const custDetails = [customer.mobile, customer.address].filter(Boolean).join("  |  ");
  if (custDetails) doc.text(custDetails, MARGIN + 3, y + 6);
  y += 14;

  // Eye sections side by side
  const colGap = 4;
  const colW = (CONTENT_W - colGap) / 2;
  const leftColX = MARGIN;
  const rightColX = MARGIN + colW + colGap;

  const leftEndY = drawRxEyeSection(doc, "RIGHT EYE", [110, 168, 254], rx.rightEye, leftColX, y);
  const rightEndY = drawRxEyeSection(doc, "LEFT EYE", [232, 164, 39], rx.leftEye, rightColX, y);
  y = Math.max(leftEndY, rightEndY) + 4;

  // PD & Notes
  if (rx.pd || rx.notes) {
    setDraw(doc, border);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;

    if (rx.pd) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(doc, dark);
      doc.text(`PD: ${rx.pd}`, MARGIN, y);
      y += 5;
    }
    if (rx.notes) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(doc, gray);
      const noteLines = doc.splitTextToSize(`Notes: ${rx.notes}`, CONTENT_W);
      doc.text(noteLines, MARGIN, y);
      y += noteLines.length * 4;
    }
  }

  // Footer
  y = Math.max(y + 10, PAGE_H - 30);
  setDraw(doc, border);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  setText(doc, gray);
  doc.text("This is a computer-generated prescription.", PAGE_W / 2, y, { align: "center" });
  y += 5;
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, PAGE_W / 2, y, { align: "center" });

  return doc;
}