import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { clearToken } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { Save, User, Shield, Upload, MessageCircle, Image, RefreshCw, LogOut, Sun, Moon, ChevronRight } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [shopName, setShopName] = useState("KMJ Optical");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [adminWhatsApp, setAdminWhatsApp] = useState("");
  const [logo, setLogo] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [waStatus, setWaStatus] = useState<string>("checking");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waDisconnecting, setWaDisconnecting] = useState(false);

  useEffect(() => {
    api.get("/api/settings").then((d) => {
      if (d.success && d.data) {
        setShopName(d.data.shopName || "KMJ Optical");
        setShopAddress(d.data.shopAddress || "");
        setShopPhone(d.data.shopPhone || "");
        setShopEmail(d.data.shopEmail || "");
        setAdminWhatsApp(d.data.adminWhatsApp || "");
        setLogo(d.data.logo || "");
        setLogoPreview(d.data.logo || "");
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const res = await api.get("/api/whatsapp/qr");
          if (cancelled) return;
          if (res.success) {
            if (res.data?.qr) {
              setWaQr(res.data.qr);
              setWaStatus("qr");
            } else if (res.data?.status === "connected") {
              setWaQr(null);
              setWaStatus("connected");
            } else if (res.data?.status === "error") {
              setWaQr(null);
              setWaStatus("error");
            } else {
              setWaQr(null);
              setWaStatus("initializing");
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLogoPreview(dataUrl);
      setLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      setError("");
      const res = await api.put("/api/settings", {
        shopName, shopAddress, shopPhone, shopEmail, adminWhatsApp, logo,
      });
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.message || "Failed to save settings");
      }
    } catch (e: any) {
      setError(e?.message || "An error occurred");
    } finally { setLoading(false); }
  }

  function handleLogout() {
    clearToken();
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your ERP system preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Shop Profile</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Update shop information & logo</p>
            </div>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shop Logo</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
              >
                {logoPreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={logoPreview} alt="Logo" className="max-h-24 max-w-48 object-contain" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">Click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                    <Image size={32} />
                    <p className="text-sm">Upload Logo</p>
                    <p className="text-xs">PNG, JPG (max 2MB)</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shop Name</label>
              <input className="input-field" value={shopName} onChange={(e) => setShopName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Address</label>
              <textarea className="input-field" rows={2} value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
              <input className="input-field" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input type="email" className="input-field" value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {saved ? "Saved!" : <><Save size={18} /> Save Settings</>}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">WhatsApp Integration</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure automated messaging</p>
            </div>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Admin WhatsApp Number</label>
              <input className="input-field" placeholder="e.g. 919XXXXXXXXX" value={adminWhatsApp}
                onChange={(e) => setAdminWhatsApp(e.target.value)} />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Bills will be sent from this number. Include country code (e.g., 91 for India).
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">WhatsApp Connection</h4>
              {waStatus === "connected" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                  <button
                    onClick={async () => {
                      setWaDisconnecting(true);
                      await api.post("/api/whatsapp/disconnect", {});
                      setWaDisconnecting(false);
                      setWaStatus("disconnected");
                    }}
                    disabled={waDisconnecting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    {waDisconnecting ? "Disconnecting..." : "Logout & Reset WhatsApp"}
                  </button>
                </div>
              )}
              {waStatus === "qr" && waQr && (
                <div className="text-center space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Scan this QR code with WhatsApp to connect</p>
                  <img src={waQr} alt="WhatsApp QR" className="mx-auto w-48 h-48" />
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Open WhatsApp → Menu → Linked Devices → Link a Device
                  </p>
                  <button
                    onClick={async () => {
                      setWaDisconnecting(true);
                      await api.post("/api/whatsapp/disconnect", {});
                      setWaDisconnecting(false);
                      setWaStatus("disconnected");
                    }}
                    disabled={waDisconnecting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    {waDisconnecting ? "Disconnecting..." : "Cancel & Reset"}
                  </button>
                </div>
              )}
              {waStatus === "disconnected" && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">WhatsApp session cleared. A new QR code will appear shortly for re-linking.</p>
                </div>
              )}
              {waStatus === "initializing" && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">Connecting...</span>
                </div>
              )}
              {waStatus === "error" && (
                <p className="text-sm text-red-500">Connection error. Restart the server.</p>
              )}
              {waStatus === "checking" && (
                <p className="text-sm text-gray-400">Checking status...</p>
              )}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Security</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage access and security</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Admin Role</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Owner / Operator</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">✓ All API routes secured</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">JWT authentication required for all endpoints</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">✓ Registration Protected</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Only admin can create new users (no open registration)</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">✓ Rate Limiting Active</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">200 requests per minute per IP</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Multi-role Support</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Coming in a future update</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Account</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Profile, theme & session</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {(user?.username as string) || "User"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                {(user?.role as string) || "—"}
              </p>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <div className="flex items-center gap-3">
                {dark ? <Moon size={18} className="text-gray-600 dark:text-gray-300" /> : <Sun size={18} className="text-gray-600 dark:text-gray-300" />}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Theme</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{dark ? "Dark" : "Light"}</p>
                </div>
              </div>
              <button onClick={toggleTheme}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${dark ? "bg-primary-600" : "bg-gray-300"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${dark ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>
            <button onClick={handleLogout}
              className="flex items-center justify-between w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group">
              <div className="flex items-center gap-3">
                <LogOut size={18} className="text-red-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Logout</p>
                  <p className="text-xs text-red-500/70 dark:text-red-400/70">End current session</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-red-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
