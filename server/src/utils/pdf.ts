import PDFKit from "pdfkit";
import fs from "fs";
import path from "path";

interface PdfBillItem {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

interface PdfBill {
  billNumber?: string;
  createdAt?: Date;
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

export function generateBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings): Buffer {
  const doc = new PDFKit({ size: "A4", margin: 20 });
  const buffers: Buffer[] = [];

  doc.on("data", (chunk) => buffers.push(chunk));
  doc.on("end", () => {});

  const pageWidth = doc.page.width;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header bar
  doc.rect(0, 0, pageWidth, 20).fillColor("#1e40af").fill();

  y += 25;

  // Logo + Shop info
  if (settings.logo) {
    const logoData = settings.logo;
    let format = "JPEG";
    if (logoData.startsWith("data:image/png")) format = "PNG";
    else if (logoData.startsWith("data:image/gif")) format = "GIF";
    else if (logoData.startsWith("data:image/webp")) format = "WEBP";
    try {
      doc.image(logoData, margin, y, { width: 28, height: 28 });
    } catch {
      try {
        doc.image(logoData, margin, y, { width: 28, height: 28 });
      } catch {
        try {
          doc.image(logoData, margin, y, { width: 28, height: 28 });
        } catch {}
      }
    }
  }

  const shopX = settings.logo ? margin + 36 : margin;
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#1e40af");
  doc.text(settings.shopName || "KMJ Optical", shopX, y + 10);

  doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
  const shopLines = [settings.shopAddress, settings.shopPhone, settings.shopEmail].filter(Boolean);
  shopLines.forEach((line, i) => {
    doc.text(line!, shopX, y + 18 + i * 5);
  });

  // Invoice badge
  doc.fillColor("#1e40af").roundedRect(pageWidth - margin - 55, y, 55, 22, 3).fill();
  doc.fontSize(14).font("Helvetica-Bold").fillColor("white");
  doc.text("INVOICE", pageWidth - margin - 27.5, y + 14, { align: "center" });

  y += 36;

  // Divider
  doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
  y += 8;

  // Bill meta + Customer info in two columns
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#6b7280");
  doc.text("BILL NUMBER", margin, y);
  doc.font("Helvetica").fillColor("#111827");
  doc.fontSize(11);
  doc.text(bill.billNumber || "—", margin, y + 5);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#6b7280");
  doc.text("DATE", margin + 75, y);
  doc.font("Helvetica").fillColor("#111827");
  doc.fontSize(11);
  doc.text(bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—", margin + 75, y + 5);

  // Customer details (right column)
  const rightX = pageWidth / 2 + 10;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#6b7280");
  doc.text("BILL TO", rightX, y);
  doc.font("Helvetica").fillColor("#111827");
  doc.fontSize(11);
  doc.text(customer.name || "—", rightX, y + 5);
  doc.fontSize(9).fillColor("#6b7280");
  const custLines = [customer.mobile && `Mobile: ${customer.mobile}`, customer.customerId && `ID: ${customer.customerId}`, customer.address].filter(Boolean);
  custLines.forEach((line, i) => {
    doc.text(line!, rightX, y + 12 + i * 5);
  });

  y += Math.max(30, 16 + custLines.length * 5);

  // Items table
  const tableBody = (bill.items || []).map((it) => [
    it.description || "Item",
    String(it.quantity || 1),
    `₹${(it.unitPrice || 0).toFixed(2)}`,
    `₹${((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}`,
  ]);

  // Table headers
  doc.fontSize(10).font("Helvetica-Bold").fillColor("white");
  const startX = margin;
  const colWidths = [contentWidth * 0.5, contentWidth * 0.12, contentWidth * 0.18, contentWidth * 0.2];
  const colXs = [startX, startX + colWidths[0], startX + colWidths[0] + colWidths[1], startX + colWidths[0] + colWidths[1] + colWidths[2]];
  const headers = ["Description", "Qty", "Unit Price", "Total"];
  headers.forEach((header, i) => {
    doc.rect(colXs[i], y, colWidths[i], 10).fillColor("#1e40af").fill();
    doc.text(header, colXs[i] + colWidths[i] / 2, y + 5, { align: "center", width: colWidths[i] });
  });
  y += 10;

  // Table rows
  doc.fontSize(10).font("Helvetica").fillColor("#111827");
  const rowHeight = 8;
  tableBody.forEach((row, rowIndex) => {
    const rowY = y + rowIndex * (rowHeight + 2);
    row.forEach((cell, colIndex) => {
      doc.text(cell, colXs[colIndex] + 2, rowY + 3, { width: colWidths[colIndex] - 4 });
    });
    doc.rect(colXs[0], rowY, contentWidth, rowHeight).strokeColor("#e5e7eb").stroke();
  });

  y += tableBody.length * (rowHeight + 2) + 10;

  // Totals section (right-aligned box)
  const totalX = pageWidth / 2;
  const totalW = contentWidth / 2;

  const totalItems: { label: string; value: string; bold?: boolean; color?: string }[] = [
    { label: "Subtotal", value: `₹${(bill.subtotal || 0).toFixed(2)}` },
  ];
  if (bill.discount) {
    totalItems.push({ label: "Discount", value: `-₹${bill.discount.toFixed(2)}`, color: "#dc2626" });
  }
  if (bill.tax) {
    totalItems.push({ label: "Tax (GST)", value: `+₹${bill.tax.toFixed(2)}`, color: "#059669" });
  }
  totalItems.push({ label: "Total", value: `₹${(bill.totalAmount || 0).toFixed(2)}`, bold: true });
  if (bill.advancePaid) {
    totalItems.push({ label: "Paid", value: `₹${bill.advancePaid.toFixed(2)}`, color: "#059669" });
  }
  if (bill.pendingAmount && bill.pendingAmount > 0) {
    totalItems.push({ label: "Pending", value: `₹${bill.pendingAmount.toFixed(2)}`, color: "#d97706", bold: true });
  }

  // Totals background
  const totalRowH = 7;
  const totalPadding = 4;
  const boxH = totalItems.length * (totalRowH + totalPadding) + totalPadding;

  doc.fillColor("#f9fafb").roundedRect(totalX, y, totalW, boxH, 4).fill();
  doc.strokeColor("#e5e7eb").roundedRect(totalX, y, totalW, boxH, 4).stroke();

  let ty = y + totalPadding + totalRowH / 2 + 1;
  totalItems.forEach((item, i) => {
    if (item.bold) {
      doc.font("Helvetica-Bold").fontSize(11);
    } else {
      doc.font("Helvetica").fontSize(10);
    }
    if (item.color) {
      doc.fillColor(item.color);
    } else {
      doc.fillColor("#111827");
    }

    doc.text(item.label, totalX + 10, ty);
    doc.text(item.value, totalX + totalW - 10, ty, { align: "right" });

    if (i === totalItems.length - 2 && item.bold) {
      doc.strokeColor("#1e40af").lineWidth(1).moveTo(totalX + 10, ty + 3).lineTo(totalX + totalW - 10, ty + 3).stroke();
    }

    ty += totalRowH + totalPadding;
  });

  y += boxH + 15;

  // Footer
  const footerY = 280;
  doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).stroke();
  doc.font("Helvetica").fontSize(9).fillColor("#9ca3af");
  doc.text("Thank you for your visit! 🙏", pageWidth / 2, footerY + 10, { align: "center" });
  doc.fontSize(8);
  doc.text(`Generated by KMJ Optical ERP`, pageWidth / 2, footerY + 17, { align: "center" });

  doc.end();

  return Buffer.concat(buffers);
}

export function downloadBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings): Buffer {
  return generateBillPdf(bill, customer, settings);
}

export function openBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings): Buffer {
  return generateBillPdf(bill, customer, settings);
}
