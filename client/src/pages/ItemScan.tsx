import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import QRCode from "qrcode";
import { ArrowLeft, Package } from "lucide-react";

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
        </div>
      </div>
    </div>
  );
}
