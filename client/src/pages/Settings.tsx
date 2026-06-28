import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { clearToken } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import PageSkeleton from "../components/PageSkeleton";
import { Save, User, Shield, Upload, MessageCircle, Image, RefreshCw, LogOut, Sun, Moon, ChevronRight, Plus, Trash2, X } from "lucide-react";

export default function Settings() {
  const { user, isStaff, setUser } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [waStatus, setWaStatus] = useState<string>("checking");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waDisconnecting, setWaDisconnecting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ username: "", password: "", name: "", mobile: "" });
  const [staffSaving, setStaffSaving] = useState(false);
  const [editingAccount, setEditingAccount] = useState(true);
  const [editName, setEditName] = useState((user?.name as string) || "");
  const [editMobile, setEditMobile] = useState((user?.mobile as string) || "");
  const [editPassword, setEditPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileMsg, setSaveProfileMsg] = useState("");

  useEffect(() => {
    if (user?.role !== "staff") {
      api.get("/api/auth/users").then((d) => { if (d.success) setUsers(d.data || []); });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (!editName) setEditName((user.name as string) || (user.username as string) || "");
      if (!editMobile) setEditMobile((user.mobile as string) || "");
    }
  }, [user]);

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
    }).finally(() => setLoading(false));
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
    setSaving(true);
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
    } finally { setSaving(false); }
  }

  function handleEditAccount() {
    setEditName((user?.name as string) || (user?.username as string) || "");
    setEditMobile((user?.mobile as string) || "");
    setEditPassword("");
    setSaveProfileMsg("");
    setEditingAccount(true);
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    setSaveProfileMsg("");
    const res = await api.put("/api/auth/me", { name: editName, mobile: editMobile, password: editPassword });
    setSavingProfile(false);
    if (res.success) {
      setEditingAccount(false);
      setSaveProfileMsg("Profile updated");
      if (res.data) setUser(res.data);
    } else {
      setSaveProfileMsg("Error: " + (res.message || "Failed to update"));
    }
  }

  function handleLogout() {
    clearToken();
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  }

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!staffForm.username.trim() || !staffForm.password.trim()) {
      toast.error("Username and password required");
      return;
    }
    setStaffSaving(true);
    const res = await api.post("/api/auth/register", { ...staffForm, role: "staff" });
    setStaffSaving(false);
    if (res.success) {
      toast.success("Staff account created");
      setShowAddStaff(false);
      setStaffForm({ username: "", password: "", name: "", mobile: "" });
      const list = await api.get("/api/auth/users");
      if (list.success) setUsers(list.data || []);
    } else {
      toast.error(res.message || "Failed to create staff");
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    const res = await api.del(`/api/auth/users/${id}`);
    if (res.success) {
      toast.success("User deleted");
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      toast.error(res.message || "Failed to delete user");
    }
  }

  if (loading) return <PageSkeleton page="settings" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your ERP system preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {!isStaff && (
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
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saved ? "Saved!" : <><Save size={18} /> Save Settings</>}
            </button>
          </form>
        </div>
        )}

        {!isStaff && (
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
        )}

        {!isStaff && (
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
            {user?.role !== "staff" && (
              <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Staff Accounts</p>
                  <button onClick={() => setShowAddStaff(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    <Plus size={14} /> Add Staff
                  </button>
                </div>
                {users.length === 0 ? (
                  <p className="text-xs text-gray-400">No staff accounts yet</p>
                ) : (
                  <div className="space-y-2">
                    {users.filter((u) => u.role === "staff").map((u) => (
                      <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-600">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name || u.username}</p>
                          <p className="text-xs text-gray-400">@{u.username}{u.mobile ? ` · ${u.mobile}` : ""}</p>
                        </div>
                        <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

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
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Profile</p>
                <button onClick={() => editingAccount ? setEditingAccount(false) : handleEditAccount()} className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700">
                  {editingAccount ? "Cancel" : "Edit"}
                </button>
              </div>
              {editingAccount ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                    <input className="input-field text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Mobile</label>
                    <input className="input-field text-sm" value={editMobile} onChange={(e) => setEditMobile(e.target.value)} placeholder="Phone number" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">New Password (leave blank to keep)</label>
                    <input type="password" className="input-field text-sm" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <button onClick={handleSaveProfile} disabled={savingProfile}
                    className="btn-primary text-sm px-4 py-2">{savingProfile ? "Saving..." : "Save"}</button>
                  {saveProfileMsg && <p className={`text-xs ${saveProfileMsg.includes("Error") ? "text-red-500" : "text-emerald-600"}`}>{saveProfileMsg}</p>}
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{(user?.name as string) || (user?.username as string) || "User"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">@{user?.username as string}{user?.mobile ? ` · ${user?.mobile as string}` : ""}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{(user?.role as string) || "—"}</p>
                </>
              )}
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

      {showAddStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowAddStaff(false)}>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md mx-4 bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-dark-600">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-200 dark:border-dark-600">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Staff Account</h3>
              <button onClick={() => setShowAddStaff(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                <input className="input-field" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="Staff name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username *</label>
                <input className="input-field" value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} placeholder="Login username" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password *</label>
                <input type="password" className="input-field" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} placeholder="Password" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile</label>
                <input className="input-field" value={staffForm.mobile} onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })} placeholder="Phone number" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-600">
                <button type="button" onClick={() => setShowAddStaff(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={staffSaving} className="btn-primary">{staffSaving ? "Creating..." : "Create Staff"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
