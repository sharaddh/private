import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface WithdrawalPdfItem {
  coating: string;
  lensType: string;
  powerKey: string;
  quantity: number;
  price?: number;
  fogMark?: string;
}

export interface WithdrawalPdfData {
  username: string;
  withdrawnAt?: string;
  items: WithdrawalPdfItem[];
  totalQuantity?: number;
  totalPrice?: number;
}

const LENS_TYPE_LABEL: Record<string, string> = {
  sph: "SPH",
  cyl: "CYL",
  compound: "Compound",
};

function formatPower(powerKey: string): string {
  if (!powerKey) return "—";
  if (powerKey.includes("|")) {
    const [sph, cyl] = powerKey.split("|");
    const norm = (v: string) => (v === "+0.00" || v === "-0.00" ? "0.00" : v);
    return `SPH ${norm(sph)} · CYL ${norm(cyl)}`;
  }
  return powerKey;
}

export function generateWithdrawalPdf(data: WithdrawalPdfData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const indigo: [number, number, number] = [30, 64, 175];
  const gray: [number, number, number] = [107, 114, 128];
  const dark: [number, number, number] = [17, 24, 39];
  const light: [number, number, number] = [249, 250, 251];

  // Header bar
  doc.setFillColor(...indigo);
  doc.rect(0, 0, pageWidth, 20, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...indigo);
  doc.setFontSize(20);
  doc.text("LENS LIST", margin, 35);

  // Meta block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  const metaLines = [
    `User: ${data.username || "—"}`,
    `Date: ${data.withdrawnAt ? new Date(data.withdrawnAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}`,
    `Items: ${data.totalQuantity ?? data.items.reduce((s, it) => s + it.quantity, 0)}`,
    ...(data.totalPrice != null ? [`Total: \u20B9${data.totalPrice.toFixed(2)}`] : []),
  ];
  let metaY = 26;
  for (const line of metaLines) {
    doc.text(line, pageWidth - margin, metaY, { align: "right" });
    metaY += 5;
  }

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, 46, pageWidth - margin, 46);

  const items = data.items || [];
  const rows = items.map((it) => [
    it.coating || "—",
    LENS_TYPE_LABEL[it.lensType] || it.lensType || "—",
    formatPower(it.powerKey),
    it.fogMark || "—",
    String(it.quantity),
    it.price != null ? `\u20B9${(it.price * it.quantity).toFixed(2)}` : "—",
  ]);

  // Table
  autoTable(doc, {
    startY: 50,
    margin: { left: margin, right: margin },
    head: [["Coating", "Type", "Power", "Fog Mark", "Qty", "Amount"]],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: indigo,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 2.5,
    },
    styles: {
      fontSize: 9,
      textColor: dark,
      cellPadding: 2.5,
      lineColor: [229, 231, 235],
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: light },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.18 },
      1: { cellWidth: contentWidth * 0.14 },
      2: { cellWidth: contentWidth * 0.22 },
      3: { cellWidth: contentWidth * 0.16 },
      4: { cellWidth: contentWidth * 0.08, halign: "center" },
      5: { cellWidth: contentWidth * 0.12, halign: "right" },
    },
    didDrawPage: () => {},
  });

  const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let y = tableEnd + 12;

  // Totals box
  const totalBoxW = contentWidth * 0.45;
  const totalBoxX = pageWidth - margin - totalBoxW;
  const totalRowH = 6;
  const pad = 4;
  const totalRows = [
    { label: "Total Items", value: String(data.totalQuantity ?? items.reduce((s, it) => s + it.quantity, 0)), bold: false },
  ];
  if (data.totalPrice != null) {
    totalRows.push({ label: "Total", value: `\u20B9${data.totalPrice.toFixed(2)}`, bold: true });
  }
  const boxH = totalRows.length * (totalRowH + pad) + pad + 2;

  doc.setFillColor(...light);
  doc.roundedRect(totalBoxX, y, totalBoxW, boxH, 2, 2, "F");
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(totalBoxX, y, totalBoxW, boxH, 2, 2, "S");

  let ty = y + pad + totalRowH / 2 + 1;
  for (const row of totalRows) {
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(row.bold ? 11 : 9);
    doc.setTextColor(...(row.bold ? indigo : dark));
    doc.text(row.label, totalBoxX + 8, ty);
    doc.text(row.value, totalBoxX + totalBoxW - 8, ty, { align: "right" });
    ty += totalRowH + pad;
  }

  // Footer
  const footerY = Math.max(y + boxH + 10, pageHeight - 25);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text("Generated by KMJ Optical Warehouse", pageWidth / 2, footerY + 7, { align: "center" });

  doc.save(`Lens_List_${data.username || "withdrawal"}.pdf`);
}
