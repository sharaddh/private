import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import QRCode from "qrcode";
import { ArrowLeft, Package, Printer, QrCode, Tag, DollarSign, User, Building, Layers, Eye } from "lucide-react";

export default function ItemScan() {
  const { code } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    api.get<any>(`/api/inventory/qr/${code}`).then((res) => {
      if (res.success) setItem(res.data);
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
        .info { flex: 1; font-size: 8pt; line-height: 1.3; }
        .info .sku { font-size: 10pt; font-weight: bold; }
        .info .brand { font-size: 9pt; }
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
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="card text-center py-12">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-lg">{error}</p>
          <p className="text-sm text-gray-400 mt-1">Code: {code}</p>
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
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card">
        <div className="flex items-start gap-5">
          <div className="w-24 h-24 bg-white dark:bg-dark-700 rounded-2xl border-2 border-gray-200 dark:border-dark-600 flex items-center justify-center flex-shrink-0 p-2">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{item.brand || "Item"} {item.model || ""}</h1>
                <p className="text-sm text-gray-500 font-mono mt-0.5">{item.sku}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrint} className="btn-secondary btn-sm flex items-center gap-1.5">
                  <Printer size={15} /> Print Label
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Tag size={12} /> Category
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{category}</p>
              </div>
              {item.inventoryType && (
                <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Layers size={12} /> Type
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{item.inventoryType}</p>
                </div>
              )}
              {gender && (
                <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <User size={12} /> Gender
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{gender}</p>
                </div>
              )}
              {item.color && (
                <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Eye size={12} /> Color
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.color}</p>
                </div>
              )}
              {item.size && (
                <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Layers size={12} /> Size
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.size}</p>
                </div>
              )}
              {item.supplier && (
                <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Building size={12} /> Supplier
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.supplier}</p>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Package size={12} /> Stock
                </div>
                <p className={`text-sm font-semibold ${(item.quantity || 0) > 5 ? "text-emerald-600" : (item.quantity || 0) > 0 ? "text-amber-600" : "text-red-600"}`}>
                  {item.quantity || 0}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <DollarSign size={12} /> Purchase Price
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">₹{item.purchasePrice || 0}</p>
              </div>
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <DollarSign size={12} /> Selling Price
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">₹{item.sellingPrice || 0}</p>
              </div>
            </div>

            {item.description && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-750 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-900 dark:text-white">{item.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
