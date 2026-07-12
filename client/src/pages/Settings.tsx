import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { clearToken } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import PageSkeleton from "../components/PageSkeleton";
import {
  Save, User, Shield, Upload, MessageCircle, RefreshCw, LogOut,
  Sun, Moon, Trash2, X, Building2, Globe, Store, Phone, Mail, MapPin,
  Smartphone, Key, AtSign, UserPlus, CheckCircle2, AlertCircle, Loader2,
  WifiOff, ArrowRight, Eye, EyeOff, Crown, Languages,
} from "lucide-react";
import SettingsHeader from "./settings/SettingsHeader";
import SectionNav from "./settings/SectionNav";
import type { Section } from "./settings/SectionNav";
import SectionCard from "./settings/SectionCard";
import { Input, Textarea, Select } from "./settings/FormField";
import ThemeToggle from "./settings/ThemeToggle";

interface Branch {
  _id: string;
  name: string;
  code: string;
  dbName: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  settings: {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    shopEmail: string;
    adminWhatsApp: string;
    logo: string;
  };
}

const ALL_SECTIONS: Section[] = [
  { id: "general", label: "Shop", icon: <Store size={15} /> },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={15} /> },
  { id: "branches", label: "Branches", icon: <Building2 size={15} /> },
  { id: "staff", label: "Staff", icon: <Shield size={15} /> },
  { id: "account", label: "Account", icon: <User size={15} /> },
];

export default function Settings() {
  const { user, isStaff, setUser, setCurrentBranch, currentBranch, branches } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const { lang, toggleLang, uiLang, toggleUiLang, uiT } = useTranslate();
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
  const [staffBranch, setStaffBranch] = useState("");
  const [staffSaving, setStaffSaving] = useState(false);
  const [editingAccount, setEditingAccount] = useState(true);
  const [editName, setEditName] = useState((user?.name as string) || "");
  const [editMobile, setEditMobile] = useState((user?.mobile as string) || "");
  const [editPassword, setEditPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileMsg, setSaveProfileMsg] = useState("");
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", code: "", dbName: "", address: "", phone: "", email: "", ownerName: "", ownerPhone: "", ownerEmail: "" });
  const [branchSaving, setBranchSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const sectionLabelMap: Record<string, string> = {
    general: uiT("Shop", "दुकान"),
    whatsapp: "WhatsApp",
    branches: uiT("Branches", "शाखाएँ"),
    staff: uiT("Staff", "स्टाफ"),
    account: uiT("Account", "खाता"),
  };
  const visibleSections = useMemo(() =>
    ALL_SECTIONS.filter((s) => isStaff ? s.id === "account" : true).map((s) => ({
      ...s,
      label: sectionLabelMap[s.id] || s.label,
    })),
    [isStaff, uiT]
  );
  const [activeSection, setActiveSection] = useState(visibleSections[0]?.id || "account");
  const [dragOver, setDragOver] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const getCurrentBranchStaff = useCallback(() => {
    return users.filter(
      (u: any) => u.role === "staff" && (u.branches || []).some((b: any) => ((b._id || b)?.toString()) === currentBranch?._id)
    );
  }, [users, currentBranch]);

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
    loadSettings();
    loadBranches();
  }, [currentBranch]);

  async function loadSettings() {
    setLoading(true);
    setShopName("");
    setShopAddress("");
    setShopPhone("");
    setShopEmail("");
    setAdminWhatsApp("");
    setLogo("");
    setLogoPreview("");
    setError("");
    try {
      const d = await api.get("/api/settings");
      if (d.success && d.data) {
        setShopName(d.data.shopName || "KMJ Optical");
        setShopAddress(d.data.shopAddress || "");
        setShopPhone(d.data.shopPhone || "");
        setShopEmail(d.data.shopEmail || "");
        setAdminWhatsApp(d.data.adminWhatsApp || "");
        setLogo(d.data.logo || "");
        setLogoPreview(d.data.logo || "");
      } else {
        setShopName("KMJ Optical");
      }
    } catch {
      setShopName("KMJ Optical");
    } finally {
      setLoading(false);
    }
  }

  async function loadBranches() {
    try {
      const d = await api.get("/api/branches");
      if (d.success) setAllBranches(d.data || []);
    } catch {}
  }

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

  useEffect(() => {
    if (showAddStaff || showAddBranch || showLogoutConfirm) {
      document.body.style.overflow = "hidden";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showAddStaff, showAddBranch, showLogoutConfirm]);

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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLogoPreview(dataUrl);
      setLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
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
    if (!staffBranch) {
      toast.error("Please select a branch for this staff member");
      return;
    }
    setStaffSaving(true);
    const res = await api.post("/api/auth/register", { ...staffForm, role: "staff", branchId: staffBranch });
    setStaffSaving(false);
    if (res.success) {
      toast.success("Staff account created");
      setShowAddStaff(false);
      setStaffForm({ username: "", password: "", name: "", mobile: "" });
      setStaffBranch("");
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

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.code.trim() || !branchForm.dbName.trim()) {
      toast.error("Name, code, and database name are required");
      return;
    }
    setBranchSaving(true);
    const res = await api.post("/api/branches", branchForm);
    setBranchSaving(false);
    if (res.success) {
      toast.success("Branch created");
      setShowAddBranch(false);
      setBranchForm({ name: "", code: "", dbName: "", address: "", phone: "", email: "", ownerName: "", ownerPhone: "", ownerEmail: "" });
      loadBranches();
    } else {
      toast.error(res.message || "Failed to create branch");
    }
  }

  async function handleEditBranch(branch: Branch) {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      code: branch.code,
      dbName: branch.dbName,
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      ownerName: branch.settings?.shopName || "",
      ownerPhone: branch.settings?.shopPhone || "",
      ownerEmail: branch.settings?.shopEmail || "",
    });
    setShowAddBranch(true);
  }

  async function handleUpdateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBranch || !branchForm.name.trim()) return;
    setBranchSaving(true);
    const res = await api.put(`/api/branches/${editingBranch._id}`, branchForm);
    setBranchSaving(false);
    if (res.success) {
      toast.success("Branch updated");
      setShowAddBranch(false);
      setEditingBranch(null);
      setBranchForm({ name: "", code: "", dbName: "", address: "", phone: "", email: "", ownerName: "", ownerPhone: "", ownerEmail: "" });
      loadBranches();
    } else {
      toast.error(res.message || "Failed to update branch");
    }
  }

  async function handleDeleteBranch(id: string) {
    if (!confirm("Deactivate this branch?")) return;
    const res = await api.del(`/api/branches/${id}`);
    if (res.success) {
      toast.success("Branch deactivated");
      loadBranches();
    } else {
      toast.error(res.message || "Failed to deactivate branch");
    }
  }

  async function handleSwitchBranch(branchId: string) {
    setCurrentBranch(branchId);
    toast.success("Branch switched");
    window.location.reload();
  }

  function scrollToSection(id: string) {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const branchStaff = useMemo(() => getCurrentBranchStaff(), [getCurrentBranchStaff]);

  if (loading) return <PageSkeleton page="settings" />;

  return (
    <div className="max-w-4xl mx-auto">
      <SettingsHeader
        user={user}
        currentBranch={currentBranch}
        branches={branches}
        isStaff={isStaff}
        onSwitchBranch={handleSwitchBranch}
        saved={saved}
        saving={saving}
      />

      <SectionNav
        sections={visibleSections}
        activeSection={activeSection}
        onSectionClick={scrollToSection}
      />

      <div className="space-y-8">
        {/* ──────────────── GENERAL / SHOP ──────────────── */}
        {!isStaff && (
          <div ref={(el) => { sectionRefs.current["general"] = el; }}>
            <SectionCard icon={<Store size={16} />} title={uiT("Shop Profile", "दुकान प्रोफ़ाइल")} subtitle={uiT("Manage your store information and branding", "अपनी दुकान की जानकारी प्रबंधित करें")}>
              <form onSubmit={handleSave} className="space-y-5">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-300 text-sm"
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col sm:flex-row gap-5">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden ${
                      dragOver
                        ? "border-primary-400 bg-primary-50 dark:bg-primary-500/10"
                        : "border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500 bg-slate-50 dark:bg-slate-700/30"
                    }`}
                  >
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload size={20} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <Upload size={22} />
                        <span className="text-[10px] font-medium">Upload Logo</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Shop Name"
                      icon={<Store size={15} />}
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Your shop name"
                    />
                    <Input
                      label="Phone"
                      icon={<Phone size={15} />}
                      value={shopPhone}
                      onChange={(e) => setShopPhone(e.target.value)}
                      placeholder="Contact number"
                    />
                  </div>
                </div>

                <Textarea
                  label="Address"
                  icon={<MapPin size={15} />}
                  rows={2}
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder="Shop address"
                  className="pl-10"
                />

                <Input
                  label="Email"
                  icon={<Mail size={15} />}
                  type="email"
                  value={shopEmail}
                  onChange={(e) => setShopEmail(e.target.value)}
                  placeholder="shop@example.com"
                />

                <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-700/30">
                  <motion.button
                    type="submit"
                    disabled={saving}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={15} className="animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save size={15} />
                        Save Changes
                      </span>
                    )}
                  </motion.button>
                </div>
              </form>
            </SectionCard>
          </div>
        )}

        {/* ──────────────── WHATSAPP ──────────────── */}
        {!isStaff && (
          <div ref={(el) => { sectionRefs.current["whatsapp"] = el; }}>
            <SectionCard icon={<MessageCircle size={16} />} title={uiT("WhatsApp Integration", "WhatsApp इंटीग्रेशन")} subtitle={uiT("Connect WhatsApp for automated messaging", "स्वचालित संदेशों के लिए WhatsApp कनेक्ट करें")}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <Input
                      label="Admin WhatsApp Number"
                      icon={<Smartphone size={15} />}
                      value={adminWhatsApp}
                      onChange={(e) => setAdminWhatsApp(e.target.value)}
                      placeholder="e.g. 919XXXXXXXXX"
                      helperText="Include country code without +"
                    />
                    <div className={`rounded-2xl border p-5 transition-all duration-500 ${
                      waStatus === "connected"
                        ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20"
                        : waStatus === "error"
                        ? "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"
                        : waStatus === "qr"
                        ? "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20"
                        : "bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700/50"
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            waStatus === "connected" ? "bg-emerald-500 animate-pulse" :
                            waStatus === "qr" ? "bg-blue-500 animate-pulse" :
                            waStatus === "error" ? "bg-red-500" :
                            waStatus === "initializing" ? "bg-amber-500 animate-pulse" :
                            "bg-slate-400"
                          }`} />
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {waStatus === "connected" ? "Connected" :
                             waStatus === "qr" ? "Scan QR Code" :
                             waStatus === "disconnected" ? "Disconnected" :
                             waStatus === "initializing" ? "Initializing..." :
                             waStatus === "error" ? "Connection Error" :
                             "Checking..."}
                          </span>
                        </div>
                        {(waStatus === "connected" || waStatus === "qr") && (
                          <button
                            onClick={async () => {
                              setWaDisconnecting(true);
                              await api.post("/api/whatsapp/disconnect", {});
                              setWaDisconnecting(false);
                              setWaStatus("disconnected");
                            }}
                            disabled={waDisconnecting}
                            className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            {waDisconnecting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <WifiOff size={12} />
                            )}
                            {waDisconnecting ? "Disconnecting..." : "Disconnect"}
                          </button>
                        )}
                      </div>
                      {waStatus === "qr" && waQr && (
                        <div className="flex justify-center py-4">
                          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                            <img src={waQr} alt="WhatsApp QR" className="w-48 h-48" />
                          </div>
                        </div>
                      )}
                      {waStatus === "connected" && (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={16} />
                          <span className="text-xs font-medium">WhatsApp is connected and ready</span>
                        </div>
                      )}
                      {waStatus === "disconnected" && (
                        <p className="text-xs text-slate-500">Disconnected. QR will appear shortly.</p>
                      )}
                      {waStatus === "initializing" && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Loader2 size={14} className="animate-spin" />
                          Connecting to WhatsApp...
                        </div>
                      )}
                      {waStatus === "error" && (
                        <p className="text-xs text-red-500">Connection error. Please restart the server.</p>
                      )}
                      {waStatus === "checking" && (
                        <p className="text-xs text-slate-400">Checking connection status...</p>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-center justify-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-2xl border border-green-200 dark:border-green-500/20">
                    <MessageCircle size={40} className="text-emerald-500 dark:text-emerald-400 mb-3" />
                    <p className="text-sm font-medium text-slate-900 dark:text-white text-center">WhatsApp Messaging</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">Send automated order updates and notifications to customers</p>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-700/30">
                  <motion.button
                    onClick={handleSave}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary"
                  >
                    <span className="flex items-center gap-2">
                      <Save size={15} />
                      Save WhatsApp Settings
                    </span>
                  </motion.button>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ──────────────── BRANCHES ──────────────── */}
        {!isStaff && (
          <div ref={(el) => { sectionRefs.current["branches"] = el; }}>
            <SectionCard icon={<Globe size={16} />} title={uiT("Branch Management", "शाखा प्रबंधन")} subtitle={uiT("Manage all your business locations", "अपने सभी व्यापार स्थान प्रबंधित करें")}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {allBranches.length} {allBranches.length === 1 ? "branch" : "branches"} configured
                  </p>
                  <motion.button
                    onClick={() => {
                      setEditingBranch(null);
                      setBranchForm({ name: "", code: "", dbName: "", address: "", phone: "", email: "", ownerName: "", ownerPhone: "", ownerEmail: "" });
                      setShowAddBranch(true);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary btn-sm"
                  >
                    <UserPlus size={14} />
                    Add Branch
                  </motion.button>
                </div>

                {allBranches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 bg-slate-50 dark:bg-slate-700/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <Building2 size={36} className="text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No branches yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add your first branch to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {allBranches.map((b) => (
                      <motion.div
                        key={b._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            b.isActive
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-100 dark:bg-slate-700/50 text-slate-400"
                          }`}>
                            <Building2 size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">{b.name}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                b.isActive ? "badge-green" : "badge-gray"
                              }`}>
                                {b.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                              <span className="text-xs text-slate-500 dark:text-slate-400">{b.code}</span>
                              {b.phone && (
                                <span className="text-xs text-slate-400 dark:text-slate-500">· {b.phone}</span>
                              )}
                              {b.address && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">· {b.address}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSwitchBranch(b._id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all"
                            title="Switch to this branch"
                          >
                            <ArrowRight size={14} />
                          </button>
                          <button
                            onClick={() => handleEditBranch(b)}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                            title="Edit branch"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b._id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            title="Deactivate branch"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ──────────────── STAFF & SECURITY ──────────────── */}
        {!isStaff && (
          <div ref={(el) => { sectionRefs.current["staff"] = el; }}>
            <SectionCard icon={<Shield size={16} />} title={uiT("Staff & Security", "स्टाफ और सुरक्षा")} subtitle={uiT("Manage team members and access control", "टीम के सदस्यों और पहुँच नियंत्रण का प्रबंधन करें")}>
              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/20 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                      <Crown size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Administrator</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Full system access</p>
                    </div>
                  </div>
                  <span className="badge-green">Admin</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Team Members</p>
                    <motion.button
                      onClick={() => setShowAddStaff(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary btn-sm"
                    >
                      <UserPlus size={14} />
                      Add Staff
                    </motion.button>
                  </div>
                  {branchStaff.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 bg-slate-50 dark:bg-slate-700/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      <User size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">No staff for this branch</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Add team members to manage this location</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branchStaff.map((u: any) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {(u.name || u.username || "S").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {u.name || u.username}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-slate-500 dark:text-slate-400">@{u.username}</span>
                                {u.mobile && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">· {u.mobile}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            title="Delete user"
                          >
                            <Trash2 size={14} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ──────────────── ACCOUNT ──────────────── */}
        <div ref={(el) => { sectionRefs.current["account"] = el; }}>
          <SectionCard icon={<User size={16} />} title={uiT("Login Credentials", "लॉगिन जानकारी")} subtitle={uiT("Your sign-in identity — used across all branches", "आपकी साइन-इन पहचान — सभी शाखाओं में उपयोग होती है")}>
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-4 p-5 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 rounded-2xl border border-violet-200 dark:border-violet-500/20">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0">
                  {(user?.username as string || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">
                      @{user?.username as string}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-500/20">
                      <Building2 size={10} />
                      {currentBranch?.name || "—"}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isStaff ? "badge-blue" : "badge-purple"
                    }`}>
                      {(user?.role as string) || "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Owner name, phone &amp; email are managed per branch in <strong>Shop Profile</strong> above
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-700/20 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={14} className="text-slate-500" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{uiT("Change Password", "पासवर्ड बदलें")}</p>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      label="New Password"
                      icon={<Key size={15} />}
                      type={showPassword ? "text" : "password"}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                    {editPassword && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-[38px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary btn-sm"
                    >
                      {savingProfile ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          Saving...
                        </span>
                      ) : "Update Password"}
                    </motion.button>
                    <AnimatePresence mode="wait">
                      {saveProfileMsg && (
                        <motion.span
                          key={saveProfileMsg}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className={`text-xs ${
                            saveProfileMsg.includes("Error") ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {saveProfileMsg.includes("Error") ? (
                            <span className="flex items-center gap-1">
                              <AlertCircle size={12} />
                              {saveProfileMsg}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              {saveProfileMsg}
                            </span>
                          )}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">{uiT("Appearance", "थीम")}</p>
                <ThemeToggle dark={dark} onToggle={toggleTheme} />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">{uiLang === "hi" ? "ऐप भाषा" : "App Language"}</p>
                <button
                  onClick={toggleUiLang}
                  className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/20 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                      <Globe size={16} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {uiLang === "hi" ? "हिन्दी" : "English"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {uiLang === "hi" ? "पूरा ऐप हिन्दी में दिखेगा" : "Entire app UI will be in English"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${uiLang === "hi" ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: uiLang === "hi" ? "translateX(18px)" : "translateX(2px)" }} />
                  </div>
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">{lang === "hi" ? "संदेश भाषा" : "Message Language"}</p>
                <button
                  onClick={toggleLang}
                  className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/20 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <Languages size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {lang === "hi" ? "हिन्दी" : "English"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {lang === "hi" ? "WhatsApp संदेश हिन्दी में जाएंगे" : "WhatsApp messages will be in English"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${lang === "hi" ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${lang === "hi" ? "translate-x-4.5 left-0.5" : "left-0.5"}`} style={{ transform: lang === "hi" ? "translateX(18px)" : "translateX(2px)" }} />
                  </div>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/30">
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">{uiT("Danger Zone", "खतरनाक क्षेत्र")}</p>
                <motion.button
                  onClick={() => setShowLogoutConfirm(true)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-500/20 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                      <LogOut size={16} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">{uiT("Sign Out", "लॉग आउट")}</p>
                      <p className="text-xs text-red-500/70 dark:text-red-400/70">End your current session</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-red-400 group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ──────────────── ADD STAFF DRAWER ──────────────── */}
      <AnimatePresence>
        {showAddStaff && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowAddStaff(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 max-h-[85vh] flex flex-col sm:max-w-lg sm:mx-auto sm:bottom-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Staff Account</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Create a new team member account</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAddStaff(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={18} />
                </motion.button>
              </div>
              <div className="overflow-y-auto px-6 py-4">
                <form onSubmit={handleAddStaff} className="space-y-4">
                  <Input
                    label="Full Name"
                    icon={<User size={15} />}
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="Staff full name"
                  />
                  <Input
                    label="Username *"
                    icon={<AtSign size={15} />}
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    placeholder="Login username"
                    required
                  />
                  <Input
                    label="Password *"
                    icon={<Key size={15} />}
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder="Secure password"
                    required
                  />
                  <Input
                    label="Mobile"
                    icon={<Smartphone size={15} />}
                    value={staffForm.mobile}
                    onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                    placeholder="Phone number"
                  />
                  <Select
                    label="Branch *"
                    icon={<Building2 size={15} />}
                    value={staffBranch}
                    onChange={(e) => setStaffBranch(e.target.value)}
                    required
                  >
                    <option value="">Select a branch</option>
                    {allBranches.filter((b) => b.isActive).map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </Select>
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <button type="button" onClick={() => setShowAddStaff(false)} className="btn-secondary">Cancel</button>
                    <motion.button
                      type="submit"
                      disabled={staffSaving}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary"
                    >
                      {staffSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={15} className="animate-spin" />
                          Creating...
                        </span>
                      ) : "Create Staff"}
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ──────────────── ADD / EDIT BRANCH DRAWER ──────────────── */}
      <AnimatePresence>
        {showAddBranch && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => { setShowAddBranch(false); setEditingBranch(null); }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 max-h-[85vh] flex flex-col sm:max-w-lg sm:mx-auto sm:bottom-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingBranch ? "Edit Branch" : "Add New Branch"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {editingBranch ? "Update branch information" : "Create a new business location"}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowAddBranch(false); setEditingBranch(null); }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={18} />
                </motion.button>
              </div>
              <div className="overflow-y-auto px-6 py-4">
                <form onSubmit={editingBranch ? handleUpdateBranch : handleAddBranch} className="space-y-4">
                  <Input
                    label="Branch Name *"
                    icon={<Building2 size={15} />}
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    placeholder="e.g. Govindpuri"
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Branch Code *"
                      icon={<AtSign size={15} />}
                      value={branchForm.code}
                      onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                      placeholder="e.g. GVP"
                      required
                      disabled={!!editingBranch}
                      helperText="Short identification code"
                    />
                    <Input
                      label="Database Name *"
                      icon={<Globe size={15} />}
                      value={branchForm.dbName}
                      onChange={(e) => setBranchForm({ ...branchForm, dbName: e.target.value })}
                      placeholder="e.g. kmj_govindpuri"
                      required
                      disabled={!!editingBranch}
                      helperText="MongoDB database name"
                    />
                  </div>
                  <Textarea
                    label="Address"
                    icon={<MapPin size={15} />}
                    rows={2}
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    placeholder="Branch address"
                    className="pl-10"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Phone"
                      icon={<Phone size={15} />}
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                      placeholder="Contact number"
                    />
                    <Input
                      label="Email"
                      icon={<Mail size={15} />}
                      type="email"
                      value={branchForm.email}
                      onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                      placeholder="branch@example.com"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/30">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Owner Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Owner Name"
                        icon={<User size={15} />}
                        value={branchForm.ownerName}
                        onChange={(e) => setBranchForm({ ...branchForm, ownerName: e.target.value })}
                        placeholder="e.g. Prakash Rathore"
                      />
                      <Input
                        label="Owner Phone"
                        icon={<Phone size={15} />}
                        value={branchForm.ownerPhone}
                        onChange={(e) => setBranchForm({ ...branchForm, ownerPhone: e.target.value })}
                        placeholder="Owner contact number"
                      />
                    </div>
                    <div className="mt-4">
                      <Input
                        label="Owner Email"
                        icon={<Mail size={15} />}
                        type="email"
                        value={branchForm.ownerEmail}
                        onChange={(e) => setBranchForm({ ...branchForm, ownerEmail: e.target.value })}
                        placeholder="owner@example.com"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <button type="button" onClick={() => { setShowAddBranch(false); setEditingBranch(null); }} className="btn-secondary">Cancel</button>
                    <motion.button
                      type="submit"
                      disabled={branchSaving}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary"
                    >
                      {branchSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={15} className="animate-spin" />
                          Saving...
                        </span>
                      ) : (editingBranch ? "Update Branch" : "Create Branch")}
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ──────────────── LOGOUT CONFIRM DRAWER ──────────────── */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 sm:max-w-sm sm:mx-auto sm:bottom-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <LogOut size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sign Out</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to end your session?</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowLogoutConfirm(false)} className="btn-secondary">Cancel</button>
                  <motion.button
                    onClick={handleLogout}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-danger"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
