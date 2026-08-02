import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface WithdrawalPdfItem {
  coating: string;
  lensType: string;
  powerKey: string;
  quantity: number;
  price?: number; // Kept in interface to prevent type errors from your data source, but ignored in UI
  fogMark?: string;
}

export interface WithdrawalPdfData {
  username: string;
  withdrawnAt?: string;
  items: WithdrawalPdfItem[];
  totalQuantity?: number;
  totalPrice?: number; // Kept in interface, but ignored in UI
}

const LENS_TYPE_LABEL: Record<string, string> = {
  sph: "SPH",
  cyl: "CYL",
  compound: "Compound",
};

// Helper to combine type and power nicely
function formatLensDetails(lensType: string, powerKey: string): string {
  const typeLabel = LENS_TYPE_LABEL[lensType] || lensType || "—";
  
  if (!powerKey) return typeLabel;
  
  if (powerKey.includes("|")) {
    const [sph, cyl] = powerKey.split("|");
    const norm = (v: string) => (v === "+0.00" || v === "-0.00" ? "0.00" : v);
    return `${typeLabel} · SPH ${norm(sph)} / CYL ${norm(cyl)}`;
  }
  
  return `${typeLabel} ${powerKey}`;
}

export function generateWithdrawalPdf(data: WithdrawalPdfData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Color Palette
  const indigo: [number, number, number] = [30, 64, 175];   // Brand primary
  const gray: [number, number, number] = [107, 114, 128];   // Muted text
  const dark: [number, number, number] = [17, 24, 39];      // Main text
  const light: [number, number, number] = [249, 250, 251];  // Backgrounds
  const border: [number, number, number] = [229, 231, 235]; // Lines

  // 1. Top Header Banner
  doc.setFillColor(...indigo);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("LENS WITHDRAWAL RECORD", margin, 18);

  // 2. Meta Information Block (Larger & better formatted)
  const totalQty = data.totalQuantity ?? data.items.reduce((s, it) => s + it.quantity, 0);
  const dateStr = data.withdrawnAt 
    ? new Date(data.withdrawnAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) 
    : "—";

  // Left Side: User Info
  doc.setTextColor(...gray);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Issued To:", margin, 40);
  
  doc.setTextColor(...dark);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.username || "Guest User", margin, 47);

  // Right Side: Date
  doc.setTextColor(...gray);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Date & Time:", pageWidth - margin, 40, { align: "right" });
  
  doc.setTextColor(...dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(dateStr, pageWidth - margin, 47, { align: "right" });

  // Divider Line
  doc.setDrawColor(...border);
  doc.setLineWidth(0.4);
  doc.line(margin, 56, pageWidth - margin, 56);

  // 3. Table Data Preparation
  const items = data.items || [];
  const rows = items.map((it) => [
    it.coating || "—",
    formatLensDetails(it.lensType, it.powerKey),
    it.fogMark || "—",
    String(it.quantity),
  ]);

  // 4. AutoTable Configuration
  autoTable(doc, {
    startY: 62,
    margin: { left: margin, right: margin },
    head: [["Coating", "Lens Details (Type & Power)", "Fog Mark", "Quantity"]],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: indigo,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: 4,
    },
    styles: {
      fontSize: 9.5,
      textColor: dark,
      cellPadding: 4,
      lineColor: border,
      lineWidth: 0.15,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: light },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.25 }, // Coating
      1: { cellWidth: contentWidth * 0.45 }, // Type & Power combined
      2: { cellWidth: contentWidth * 0.18 }, // Fog Mark
      3: { cellWidth: contentWidth * 0.12, halign: "center" }, // Qty
    },
  });

  const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let y = tableEnd + 15;

  // 5. Totals Summary Box (Qty Only)
  const totalBoxW = contentWidth * 0.40;
  const totalBoxX = pageWidth - margin - totalBoxW;
  const boxH = 14;

  // Box background & border
  doc.setFillColor(...light);
  doc.roundedRect(totalBoxX, y, totalBoxW, boxH, 2, 2, "F");
  doc.setDrawColor(...border);
  doc.roundedRect(totalBoxX, y, totalBoxW, boxH, 2, 2, "S");

  // Box Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...indigo);
  doc.text("Total Items Withdrawn:", totalBoxX + 6, y + 9);
  doc.setFontSize(12);
  doc.text(String(totalQty), totalBoxX + totalBoxW - 6, y + 9, { align: "right" });

  // 6. Footer
  const footerY = Math.max(y + boxH + 20, pageHeight - 20);
  doc.setDrawColor(...border);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text("Generated securely by KMJ Optical Warehouse", pageWidth / 2, footerY + 6, { align: "center" });

  // Save PDF
  const safeUsername = (data.username || "withdrawal").replace(/[^a-z0-9]/gi, '_');
  doc.save(`Lens_List_${safeUsername}.pdf`);
}