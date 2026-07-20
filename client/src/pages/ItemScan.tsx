import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { inventoryService } from "../services";
import { useTranslate } from "../context/TranslateContext";
import PageSkeleton from "../components/PageSkeleton";
import QRCode from "qrcode";
import { ArrowLeft, Package, Printer, QrCode, Tag, User, Building, Layers, Eye } from "lucide-react";
import type { InventoryItem } from "../types";

export default function ItemScan() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { uiT } = useTranslate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!code) return;
    api.get<InventoryItem>("/api/inventory/qr/" + code).then((res) => {
      if (res.success) setItem(res.data ?? null);
      else setError(res.message || "Item not found");
    }).catch(() => setError("Failed to load item")).finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (item && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, item.sku, {
        width: 180,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [item]);

  async function handlePrint() {
    if (!item) return;
    const qrUrl = await QRCode.toDataURL(item.sku, { width: 300, margin: 1 });
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const category = item.category || "Frame";
    const gender = item.gender ? ` / ${item.gender}` : "";
    const type = item.inventoryType ? `${item.inventoryType}${gender}` : category;
    printWindow.document.write(`
      <html><head><title>Print Label - ${item.sku}</title>
      <style>
        @page { size: 100mm 50mm; margin: 0; }
        body { margin: 0; padding: 4mm; width: 100mm; height: 50mm; box-sizing: border-box;
               font-family: Arial, sans-serif; display: flex; align-items: center; }
        .label { display: flex; align-items: center; gap: 4mm; width: 100%; }
        .qr img { width: 40mm; height: 40mm; }
        .info { flex: 1; font-size: 10pt; line-height: 1.3; }
        .info .sku { font-size: 12pt; font-weight: bold; }
        .info .brand { font-size: 11pt; }
        .info .detail { color: #555; }
      </style></head><body>
      <div class="label">
        <div class="qr"><img src="${qrUrl}" /></div>
        <div class="info">
          <div class="sku">${item.sku}</div>
          <div class="brand">${item.brand || ""} ${item.model || ""}</div>
          <div class="detail">${type}${item.color ? " / " + item.color : ""}</div>
          <div class="detail">${item.supplier ? item.supplier : ""} ${item.purchasePrice ? "₹" + item.purchasePrice : ""}</div>
          <div class="detail">₹${item.sellingPrice || 0}</div>
          <div class="detail" style="font-size:6pt;color:#999">${new Date().toLocaleDateString("en-IN")}</div>
        </div>
      </div>
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  if (loading) return <PageSkeleton page="inventory" />;

  if (error) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate(-1)} aria-label={uiT("Go back", "वापस जाएं")} className="inline-flex items-center gap-2 text-sm text-th-secondary hover:text-th-text">
           <ArrowLeft size={16} aria-hidden="true" /> {uiT("Back", "वापस")}
        </button>
        <div className="card bg-th-surface rounded-lg text-center py-12 shadow-lg">
          <Package size={48} className="mx-auto text-th-muted mb-3" aria-hidden="true" />
          <p className="text-th-secondary text-lg">{error}</p>
          <p className="text-sm text-th-muted mt-1">{uiT("Code:", "कोड:")} {code}</p>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const category = item.category || "Frame";
  const gender = item.gender || "";
  const type = item.inventoryType || category;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} aria-label={uiT("Go back", "वापस जाएं")} className="inline-flex items-center gap-2 text-sm text-th-secondary hover:text-th-text">
        <ArrowLeft size={16} aria-hidden="true" /> {uiT("Back", "वापस")}
      </button>

      <div className="card bg-th-surface rounded-lg p-6 shadow-lg">
        <div className="flex items-start gap-5">
          <div className="w-24 h-24 bg-th-elevated rounded-lg flex items-center justify-center flex-shrink-0 p-2">
            <canvas ref={canvasRef} className="w-full h-full" aria-label={uiT("QR code for item", "आइटम के लिए QR कोड")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-th-text">{item.brand || uiT("Item", "आइटम")} {item.model || ""}</h1>
                <p className="text-sm text-th-secondary font-mono mt-0.5">{item.sku}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrint} aria-label={uiT("Print item label", "आइटम लेबल प्रिंट करें")} className="bg-transparent border border-[#727272] text-th-text hover:border-th-text text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-1.5 flex items-center gap-1.5 transition-all">
                  <Printer size={15} aria-hidden="true" /> {uiT("Print Label", "लेबल प्रिंट")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
              <div className="bg-th-elevated rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                   <Tag size={12} aria-hidden="true" /> {uiT("Category", "श्रेणी")}
                </div>
                <p className="body font-semibold text-th-text capitalize">{category}</p>
              </div>
              {item.inventoryType && (
                <div className="bg-th-elevated rounded-sm p-3">
                  <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                     <Layers size={12} aria-hidden="true" /> {uiT("Type", "प्रकार")}
                  </div>
                  <p className="body font-semibold text-th-text capitalize">{item.inventoryType}</p>
                </div>
              )}
              {gender && (
                <div className="bg-th-elevated rounded-sm p-3">
                  <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                     <User size={12} aria-hidden="true" /> {uiT("Gender", "लिंग")}
                  </div>
                  <p className="body font-semibold text-th-text">{gender}</p>
                </div>
              )}
              {item.color && (
                <div className="bg-th-elevated rounded-sm p-3">
                  <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                     <Eye size={12} aria-hidden="true" /> {uiT("Color", "रंग")}
                  </div>
                  <p className="body font-semibold text-th-text">{item.color}</p>
                </div>
              )}
              {item.size && (
                <div className="bg-th-elevated rounded-sm p-3">
                  <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                     <Layers size={12} aria-hidden="true" /> {uiT("Size", "आकार")}
                  </div>
                  <p className="body font-semibold text-th-text">{item.size}</p>
                </div>
              )}
              {item.supplier && (
                <div className="bg-th-elevated rounded-sm p-3">
                  <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                     <Building size={12} aria-hidden="true" /> {uiT("Supplier", "आपूर्तिकर्ता")}
                  </div>
                  <p className="body font-semibold text-th-text">{item.supplier}</p>
                </div>
              )}
              <div className="bg-th-elevated rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                   <Package size={12} aria-hidden="true" /> {uiT("Stock", "स्टॉक")}
                </div>
                <p className={`body font-semibold ${(item.quantity || 0) > 5 ? "text-[#1ed760]" : (item.quantity || 0) > 0 ? "text-amber-400" : "text-[#e74c3c]"}`}>
                  {item.quantity || 0}
                </p>
              </div>
              <div className="bg-th-elevated rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                   <Tag size={12} aria-hidden="true" /> {uiT("Purchase Price", "खरीद मूल्य")}
                </div>
                <p className="body font-semibold text-th-text">₹{item.purchasePrice || 0}</p>
              </div>
              <div className="bg-th-elevated rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-xs text-th-secondary mb-1">
                   <Tag size={12} aria-hidden="true" /> {uiT("Selling Price", "बिक्री मूल्य")}
                </div>
                <p className="body font-semibold text-th-text">₹{item.sellingPrice || 0}</p>
              </div>
            </div>

            {item.description && (
              <div className="mt-4 p-3 bg-th-elevated rounded-sm">
                  <p className="text-xs text-th-secondary mb-1">{uiT("Description", "विवरण")}</p>
                <p className="body text-th-text">{item.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
