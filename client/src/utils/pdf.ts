import jsPDF from "jspdf";
import "jspdf-autotable";

interface PdfBillItem {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

interface PdfBill {
  billNumber?: string;
  createdAt?: string;
  items?: PdfBillItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  advancePaid?: number;
  pendingAmount?: number;
  totalAmount?: number;
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

export function generateBillPdf(bill: PdfBill, customer: PdfCustomer, settings: PdfSettings) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;

  const primary = "#1e40af";
  const gray = "#6b7280";
  const dark = "#111827";

  // Header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 8, "F");

  y += 10;

  // Logo + Shop info
  if (settings.logo) {
    const logoData = settings.logo;
    let format = "JPEG";
    if (logoData.startsWith("data:image/png")) format = "PNG";
    else if (logoData.startsWith("data:image/gif")) format = "GIF";
    else if (logoData.startsWith("data:image/webp")) format = "WEBP";
    try {
      doc.addImage(logoData, format, margin, y, 28, 28);
    } catch {
      try {
        doc.addImage(logoData, "PNG", margin, y, 28, 28);
      } catch {
        try {
          doc.addImage(logoData, "JPEG", margin, y, 28, 28);
        } catch {}
      }
    }
  }

  const shopX = settings.logo ? margin + 36 : margin;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(settings.shopName || "KMJ Optical", shopX, y + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  const shopLines = [settings.shopAddress, settings.shopPhone, settings.shopEmail].filter(Boolean);
  shopLines.forEach((line, i) => {
    doc.text(line!, shopX, y + 18 + i * 5);
  });

  // Invoice badge
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(pageW - margin - 55, y, 55, 22, 3, 3, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", pageW - margin - 27.5, y + 14, { align: "center" });

  y += 36;

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Bill meta + Customer info in two columns
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text("BILL NUMBER", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(bill.billNumber || "—", margin, y + 5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text("DATE", margin + 75, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—", margin + 75, y + 5);

  // Customer details (right column)
  const rightX = pageW / 2 + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text("BILL TO", rightX, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(customer.name || "—", rightX, y + 5);
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
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

  (doc as any).autoTable({
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: contentW * 0.5 },
      1: { cellWidth: contentW * 0.12, halign: "center" },
      2: { cellWidth: contentW * 0.18, halign: "right" },
      3: { cellWidth: contentW * 0.2, halign: "right" },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    margin: { left: margin, right: margin },
    tableWidth: contentW,
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Totals section (right-aligned box)
  const totalX = pageW / 2;
  const totalW = contentW / 2;

  const totalItems: { label: string; value: string; bold?: boolean; color?: [number, number, number] }[] = [
    { label: "Subtotal", value: `₹${(bill.subtotal || 0).toFixed(2)}` },
  ];
  if (bill.discount) {
    totalItems.push({ label: "Discount", value: `-₹${bill.discount.toFixed(2)}`, color: [220, 38, 38] });
  }
  if (bill.tax) {
    totalItems.push({ label: "Tax (GST)", value: `+₹${bill.tax.toFixed(2)}`, color: [5, 150, 105] });
  }
  totalItems.push({ label: "Total", value: `₹${(bill.totalAmount || 0).toFixed(2)}`, bold: true });
  if (bill.advancePaid) {
    totalItems.push({ label: "Paid", value: `₹${bill.advancePaid.toFixed(2)}`, color: [5, 150, 105] });
  }
  if (bill.pendingAmount && bill.pendingAmount > 0) {
    totalItems.push({ label: "Pending", value: `₹${bill.pendingAmount.toFixed(2)}`, color: [217, 119, 6], bold: true });
  }

  // Totals background
  const totalRowH = 7;
  const totalPadding = 4;
  const boxH = totalItems.length * (totalRowH + totalPadding) + totalPadding;

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(totalX, y, totalW, boxH, 4, 4, "F");
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(totalX, y, totalW, boxH, 4, 4, "S");

  let ty = y + totalPadding + totalRowH / 2 + 1;
  totalItems.forEach((item, i) => {
    if (item.bold) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    }
    if (item.color) {
      doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    } else {
      doc.setTextColor(15, 23, 42);
    }

    doc.text(item.label, totalX + 10, ty);
    doc.text(item.value, totalX + totalW - 10, ty, { align: "right" });

    if (i === totalItems.length - 2 && item.bold) {
      doc.setDrawColor(30, 64, 175);
      doc.line(totalX + 10, ty + 3, totalX + totalW - 10, ty + 3);
    }

    ty += totalRowH + totalPadding;
  });

  y += boxH + 15;

  // Footer
  const footerY = 280;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text("Thank you for your visit! 🙏", pageW / 2, footerY + 10, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Generated by KMJ Optical ERP`, pageW / 2, footerY + 17, { align: "center" });

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
