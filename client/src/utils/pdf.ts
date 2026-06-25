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

const primary: [number, number, number] = [30, 64, 175];
const primaryLight: [number, number, number] = [239, 242, 255];
const gray: [number, number, number] = [107, 114, 128];
const dark: [number, number, number] = [17, 24, 39];
const border: [number, number, number] = [229, 231, 235];
const success: [number, number, number] = [5, 150, 105];
const danger: [number, number, number] = [220, 38, 38];
const warning: [number, number, number] = [217, 119, 6];

const C = "Rs.";

function fmt(n: number): string {
  return `${C} ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
// --- Configuration ---
const logoSize = 50; 
const headerHeight = 50; 
const cursorY = 7; // Start below top bar

// --- Background ---
doc.setFillColor(primary[0], primary[1], primary[2]);
doc.rect(0, 0, pageW, 7, "F");

doc.setFillColor(247, 248, 252);
doc.rect(0, 7, pageW, headerHeight, "F");

// --- 1. Draw Logo (Left) ---
const logoX = margin;
const logoY = cursorY + 2; // Fixed top padding for logo

if (settings.logo) {
  let format = "JPEG";
  if (settings.logo.startsWith("data:image/png")) format = "PNG";
  else if (settings.logo.startsWith("data:image/gif")) format = "GIF";
  else if (settings.logo.startsWith("data:image/webp")) format = "WEBP";

  try {
    doc.addImage(settings.logo, format, logoX, logoY, logoSize, logoSize);
  } catch (e) {
    try { doc.addImage(settings.logo, "PNG", logoX, logoY, logoSize, logoSize); } 
    catch { try { doc.addImage(settings.logo, "JPEG", logoX, logoY, logoSize, logoSize); } catch {} }
  }
}

// --- 2. Calculate Text Vertical Center (Right) ---
const rightMargin = 15; 
const rightX = pageW - rightMargin;

// Get font heights to measure accurately
doc.setFont("helvetica", "bold");
doc.setFontSize(12);
const titleHeight = doc.getLineHeight();

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
const infoHeight = doc.getLineHeight();

// Gather active info lines 
const infoLines = [];
if (settings.shopAddress) infoLines.push(settings.shopAddress);
if (settings.shopPhone) infoLines.push(`Phone: ${settings.shopPhone}`);
if (settings.shopEmail) infoLines.push(`Email: ${settings.shopEmail}`);

// --- ZERO VERTICAL GAP SETTINGS ---
const titleGap = -6; // Tiny spacing below the shop name for readability
const lineGap = -6;  // Zero spacing between the contact lines

// Calculate the EXACT total height of the text block dynamically
let textBlockHeight = titleHeight;
if (infoLines.length > 0) {
  textBlockHeight += titleGap;
  textBlockHeight += (infoLines.length * infoHeight);
  textBlockHeight += ((infoLines.length - 1) * lineGap);
}

// Find the vertical center of the logo
const logoCenterY = logoY + (logoSize / 2);

// Calculate the starting Y position for the Title
let currentTextY = logoCenterY - (textBlockHeight / 2) + (titleHeight * 0.8);

// --- 3. Draw Text (Right Aligned on Same Axis) ---

// Draw the Shop Name (Title)
doc.setFont("helvetica", "bold");
doc.setFontSize(12);
doc.setTextColor(dark[0], dark[1], dark[2]);
doc.text(settings.shopName || "Optical Shop", rightX, currentTextY, { align: "right" });

// Draw the Info Lines
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.setTextColor(gray[0], gray[1], gray[2]);

if (infoLines.length > 0) {
  // Move down to the first info line
  currentTextY += titleGap + infoHeight; 
  doc.text(infoLines[0], rightX, currentTextY, { align: "right" });

  // Move down for any remaining lines (Since lineGap is 0, this is tightly stacked)
  for (let i = 1; i < infoLines.length; i++) {
    currentTextY += lineGap + infoHeight;
    doc.text(infoLines[i], rightX, currentTextY, { align: "right" });
  }
}

// --- Divider Line ---
const lineY = cursorY + headerHeight; 
doc.setDrawColor(border[0], border[1], border[2]);
doc.setLineWidth(0.5);
doc.line(margin, lineY, pageW - margin, lineY);
doc.setLineWidth(0.1);

y = lineY + 6;
  const leftColX = margin;
  const rightColX = pageW / 2 + 5;

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("INVOICE NO.", leftColX, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(bill.billNumber || "—", leftColX, y + 4);
  const yAfterBillNo = y + 9;

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("INVOICE DATE", leftColX, yAfterBillNo);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  const billDate = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  doc.text(billDate, leftColX, yAfterBillNo + 4);
  const yAfterDate = yAfterBillNo + 9;

  doc.setFontSize(6.5);
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

  const custDetails: { label: string; value?: string }[] = [];
  if (customer.mobile) custDetails.push({ label: "Mobile", value: customer.mobile });
  if (customer.customerId) custDetails.push({ label: "Customer ID", value: customer.customerId });
  if (customer.address) custDetails.push({ label: "Address", value: customer.address });
  custDetails.forEach((d, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${d.label}: `, rightColX, custLineY + i * 4.5);
    const labelW = doc.getTextWidth(`${d.label}: `);
    doc.setFont("helvetica", "normal");
    doc.text(d.value || "", rightColX + labelW, custLineY + i * 4.5);
  });
  custLineY += custDetails.length * 4.5;

  y = Math.max(yAfterDate + 9, custLineY + 2);

  const tableBody = (bill.items || []).map((it) => [
    it.description || "Item",
    String(it.quantity || 1),
    fmt(it.unitPrice || 0),
    fmt((it.quantity || 1) * (it.unitPrice || 0)),
  ]);

  if (tableBody.length === 0) {
    tableBody.push(["No items", "—", "—", "—"]);
  }

  const tableStartY = y + 2;
  (doc as any).autoTable({
    startY: tableStartY,
    head: [["#", "Description", "Qty", "Unit Price", "Total"]],
    body: tableBody.map((row, i) => [`${i + 1}`, ...row]),
    theme: "grid",
    headStyles: {
      fillColor: primary as any,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: dark as any,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: contentW * 0.38 },
      2: { cellWidth: contentW * 0.11, halign: "center" },
      3: { cellWidth: contentW * 0.21, halign: "right" },
      4: { cellWidth: contentW * 0.21, halign: "right" },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] as any,
    },
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    tableLineColor: border as any,
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  const totalX = contentW * 0.45 + margin;
  const totalW = contentW * 0.55;

  const totalItems: { label: string; value: string; bold?: boolean; color?: [number, number, number] }[] = [
    { label: "Subtotal", value: fmt(bill.subtotal || 0) },
  ];
  if (bill.discount) {
    totalItems.push({ label: "Discount", value: `- ${fmt(bill.discount)}`, color: danger });
  }
  if (bill.tax) {
    totalItems.push({ label: "GST", value: `+ ${fmt(bill.tax)}`, color: success });
  }
  totalItems.push({ label: "Total Amount", value: fmt(bill.totalAmount || 0), bold: true });
  if (bill.advancePaid) {
    totalItems.push({ label: "Paid", value: fmt(bill.advancePaid), color: success });
  }
  if (bill.pendingAmount && bill.pendingAmount > 0) {
    totalItems.push({ label: "Balance Due", value: fmt(bill.pendingAmount), color: warning, bold: true });
  }

  const totalRowH = 7.5;
  const totalPad = 3;
  const boxH = totalItems.length * (totalRowH + totalPad) + totalPad + 2;

  doc.setFillColor(primaryLight[0], primaryLight[1], primaryLight[2]);
  doc.roundedRect(totalX, y, totalW, boxH, 4, 4, "F");
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.roundedRect(totalX, y, totalW, boxH, 4, 4, "S");

  let ty = y + totalPad + totalRowH / 2 + 2;
  totalItems.forEach((item, i) => {
    doc.setFont("helvetica", item.bold ? "bold" : "normal");
    doc.setFontSize(item.bold ? 10 : 9);
    const c = item.color || dark;
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(item.label, totalX + 8, ty);
    doc.text(item.value, totalX + totalW - 8, ty, { align: "right" });
    const lastHighlightIdx = bill.pendingAmount && bill.pendingAmount > 0 ? totalItems.length - 1 : totalItems.length - 2;
    if (i === lastHighlightIdx) {
      doc.setDrawColor(primary[0], primary[1], primary[2]);
      doc.setLineWidth(0.6);
      doc.line(totalX + 8, ty + 3, totalX + totalW - 8, ty + 3);
      doc.setLineWidth(0.1);
    }
    ty += totalRowH + totalPad;
  });

  y += boxH + 8;

  if (bill.totalAmount && bill.totalAmount > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text("AMOUNT IN WORDS", margin, y);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(9);
    const amountWords = numberToWords(Math.round(bill.totalAmount));
    doc.text(amountWords, margin, y + 5);
    y += 14;
  }

  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineWidth(0.1);
  y += 5;

  const termsY = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text("Terms & Conditions", margin, termsY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.setFontSize(7);
  const terms = [
    "1. Goods once sold will not be taken back or exchanged.",
    "2. Prescription accuracy must be verified within 3 days of delivery.",
    "3. Warranty covers manufacturing defects only; does not cover scratches or breakage.",
    "4. This is a computer-generated invoice and does not require a physical signature.",
  ];
  terms.forEach((t, i) => {
    doc.text(t, margin, termsY + 5 + i * 4);
  });

  y = termsY + 5 + terms.length * 4 + 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(`Thank you for choosing ${settings.shopName || "us"}!`, pageW / 2, y, { align: "center" });

  const footerY = 280;
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setLineWidth(0.1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(gray[0], gray[1], gray[2]);
  const footerParts = [settings.shopAddress, settings.shopPhone, settings.shopEmail].filter(Boolean);
  doc.text(footerParts.join("  |  "), pageW / 2, footerY + 6, { align: "center" });
  doc.setFontSize(6);
  doc.text(`Invoice generated on ${new Date().toLocaleString("en-IN")}`, pageW / 2, footerY + 11, { align: "center" });

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

function padCenter(str: string, width: number): string {
  if (str.length >= width) return str;
  const left = Math.floor((width - str.length) / 2);
  return " ".repeat(left) + str;
}
