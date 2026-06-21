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

const primary = [30, 64, 175] as const;
const primaryLight = [239, 242, 255] as const;
const gray = [107, 114, 128] as const;
const dark = [17, 24, 39] as const;
const border = [229, 231, 235] as const;

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const convertBelow1000 = (num: number): string => {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " and " + convertBelow1000(num % 100) : "");
  };
  const convert = (num: number): string => {
    if (num === 0) return "";
    if (num < 1000) return convertBelow1000(num);
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return convertBelow1000(thousands) + " Thousand" + (remainder ? " " + convert(remainder) : "");
  };
  const lakh = Math.floor(n / 100000);
  const remaining = n % 100000;
  let result = "";
  if (lakh > 0) result += convert(lakh) + " Lakh ";
  result += convert(remaining);
  return result.trim() + " Rupees Only";
}

export function generateBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ---- Top header bar ----
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageW, 6, "F");

  y += 10;

  // ---- Logo + Shop info row ----
  let logoX = margin;
  if (settings.logo) {
    let format = "JPEG";
    const logo = settings.logo;
    if (logo.startsWith("data:image/png")) format = "PNG";
    else if (logo.startsWith("data:image/gif")) format = "GIF";
    else if (logo.startsWith("data:image/webp")) format = "WEBP";
    try {
      doc.addImage(logo, format, margin, y, 24, 24);
    } catch {
      try { doc.addImage(logo, "PNG", margin, y, 24, 24); } catch {
        try { doc.addImage(logo, "JPEG", margin, y, 24, 24); } catch {}
      }
    }
    logoX = margin + 30;
  }

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(settings.shopName || "KMJ Optical", logoX, y + 9);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  const shopInfo: string[] = [];
  if (settings.shopAddress) shopInfo.push(settings.shopAddress);
  if (settings.shopPhone) shopInfo.push(`Ph: ${settings.shopPhone}`);
  if (settings.shopEmail) shopInfo.push(settings.shopEmail);
  shopInfo.forEach((line, i) => {
    doc.text(line, logoX, y + 17 + i * 4);
  });

  // ---- TAX INVOICE badge ----
  const badgeX = pageW - margin - 58;
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.roundedRect(badgeX, y, 58, 16, 3, 3, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TAX INVOICE", badgeX + 29, y + 11, { align: "center" });

  y += 32;

  // ---- Separator line ----
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ---- Invoice meta + Customer ----
  const leftColX = margin;
  const rightColX = pageW / 2 + 5;

  // Left: Bill info
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("INVOICE NO.", leftColX, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(bill.billNumber || "—", leftColX, y + 4);

  const yAfterBillNo = y + 9;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("DATE", leftColX, yAfterBillNo);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  const billDate = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  doc.text(billDate, leftColX, yAfterBillNo + 4);

  const yAfterDate = yAfterBillNo + 9;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("STATUS", leftColX, yAfterDate);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(bill.status === "Cancelled" ? 220 : dark[0], bill.status === "Cancelled" ? 38 : dark[1], bill.status === "Cancelled" ? 38 : dark[2]);
  doc.text(bill.status || "Active", leftColX, yAfterDate + 4);

  // Right: Customer info
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("BILL TO", rightColX, y);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(customer.name || "—", rightColX, y + 4);

  let custLineY = y + 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  if (customer.mobile) {
    doc.text(`Mobile: ${customer.mobile}`, rightColX, custLineY);
    custLineY += 4.5;
  }
  if (customer.customerId) {
    doc.text(`Customer ID: ${customer.customerId}`, rightColX, custLineY);
    custLineY += 4.5;
  }
  if (customer.address) {
    doc.text(customer.address, rightColX, custLineY);
    custLineY += 4.5;
  }

  y = Math.max(yAfterDate + 9, custLineY + 2);

  // ---- Items table ----
  const tableBody = (bill.items || []).map((it) => [
    it.description || "Item",
    String(it.quantity || 1),
    `₹${(it.unitPrice || 0).toFixed(2)}`,
    `₹${((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}`,
  ]);

  if (tableBody.length === 0) {
    tableBody.push(["No items", "—", "—", "—"]);
  }

  (doc as any).autoTable({
    startY: y,
    head: [["#", "Description", "Qty", "Unit Price", "Total"]],
    body: tableBody.map((row, i) => [`${i + 1}`, ...row]),
    theme: "grid",
    headStyles: {
      fillColor: primary as any,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: dark as any,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: contentW * 0.42 },
      2: { cellWidth: contentW * 0.12, halign: "center" },
      3: { cellWidth: contentW * 0.18, halign: "right" },
      4: { cellWidth: contentW * 0.18, halign: "right" },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] as any,
    },
    margin: { left: margin, right: margin },
    tableWidth: contentW,
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Totals section (right-aligned box) ----
  const totalX = contentW * 0.48 + margin;
  const totalW = contentW * 0.52;

  const totalItems: { label: string; value: string; bold?: boolean; color?: [number, number, number] }[] = [
    { label: "Subtotal", value: `₹${(bill.subtotal || 0).toFixed(2)}` },
  ];
  if (bill.discount) {
    totalItems.push({ label: "Discount", value: `-₹${bill.discount.toFixed(2)}`, color: [220, 38, 38] });
  }
  if (bill.tax) {
    totalItems.push({ label: "GST", value: `+₹${bill.tax.toFixed(2)}`, color: [5, 150, 105] });
  }
  totalItems.push({ label: "Total Amount", value: `₹${(bill.totalAmount || 0).toFixed(2)}`, bold: true });
  if (bill.advancePaid) {
    totalItems.push({ label: "Paid", value: `₹${bill.advancePaid.toFixed(2)}`, color: [5, 150, 105] });
  }
  if (bill.pendingAmount && bill.pendingAmount > 0) {
    totalItems.push({ label: "Balance Due", value: `₹${bill.pendingAmount.toFixed(2)}`, color: [217, 119, 6], bold: true });
  }

  const totalRowH = 7;
  const totalPad = 3;
  const boxH = totalItems.length * (totalRowH + totalPad) + totalPad + 2;

  doc.setFillColor(primaryLight[0], primaryLight[1], primaryLight[2]);
  doc.roundedRect(totalX, y, totalW, boxH, 4, 4, "F");
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.roundedRect(totalX, y, totalW, boxH, 4, 4, "S");

  let ty = y + totalPad + totalRowH / 2 + 2;
  totalItems.forEach((item, i) => {
    doc.setFont(item.bold ? "helvetica" : "helvetica", item.bold ? "bold" : "normal");
    doc.setFontSize(item.bold ? 10 : 9);
    const c = item.color || dark;
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(item.label, totalX + 8, ty);
    doc.text(item.value, totalX + totalW - 8, ty, { align: "right" });
    const lastHighlightIdx = bill.pendingAmount && bill.pendingAmount > 0 ? totalItems.length - 1 : totalItems.length - 2;
    if (i === lastHighlightIdx) {
      doc.setDrawColor(primary[0], primary[1], primary[2]);
      doc.setLineWidth(0.5);
      doc.line(totalX + 8, ty + 2, totalX + totalW - 8, ty + 2);
      doc.setLineWidth(0.1);
    }
    ty += totalRowH + totalPad;
  });

  y += boxH + 8;

  // ---- Amount in words ----
  if (bill.totalAmount) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text("Amount in Words:", margin, y);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(9);
    const amountWords = numberToWords(Math.round(bill.totalAmount));
    doc.text(amountWords, margin, y + 5);
    y += 12;
  }

  // ---- Divider ----
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ---- Terms & Conditions + Signature ----
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text("Terms & Conditions:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.setFontSize(7);
  const terms = [
    "1. All items are subject to a 7-day inspection period.",
    "2. Prescription accuracy should be verified within 3 days of delivery.",
    "3. Warranty covers manufacturing defects only.",
    "4. This is a computer-generated invoice.",
  ];
  terms.forEach((t, i) => {
    doc.text(t, margin, y + 5 + i * 4);
  });

  // Signature
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  const signY = y + 5 + terms.length * 4;
  doc.text("Authorised Signatory", pageW - margin - 50, signY);
  doc.line(pageW - margin - 50, signY + 1, pageW - margin, signY + 1);

  // ---- Footer ----
  const footerY = 278;
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(`Thank you for choosing ${settings.shopName || "KMJ Optical"}! 🙏`, pageW / 2, footerY + 7, { align: "center" });
  doc.setFontSize(6);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}  |  ${settings.shopName || "KMJ Optical"} ERP`, pageW / 2, footerY + 12, { align: "center" });

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
