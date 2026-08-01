import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { clearToken } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import {
  Save, User, Shield, Upload, MessageCircle, RefreshCw, LogOut,
  Sun, Moon, Trash2, X, Building2, Globe, Phone, Mail, MapPin,
  Smartphone, Key, AtSign, UserPlus, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Eye, EyeOff, Crown, Languages,
} from "lucide-react";
import type { User as AppUser, BranchInfo } from "../types";
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
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
  };
}

const ALL_SECTIONS: Section[] = [
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
  const [waStatus, setWaStatus] = useState<string>("checking");

  const [users, setUsers] = useState<(AppUser & { id?: string })[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ username: "", password: "", name: "", mobile: "" });
  const [staffBranch, setStaffBranch] = useState("");
  const [staffSaving, setStaffSaving] = useState(false);
  const [editName, setEditName] = useState((user?.name as string) || "");
  const [editMobile, setEditMobile] = useState((user?.mobile as string) || "");
  const [editPassword, setEditPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileMsg, setSaveProfileMsg] = useState("");
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", code: "", dbName: "", address: "", phone: "", email: "", logo: "", ownerName: "", ownerPhone: "", ownerEmail: "", ownerUsername: "", ownerPassword: "" });
  const [branchLogoPreview, setBranchLogoPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branchSaving, setBranchSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const sectionLabelMap: Record<string, string> = {
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

  const getCurrentBranchStaff = useCallback(() => {
    return users.filter(
      (u: any) => u.role === "staff" && (u.branches || []).some((b: any) => ((b._id || b)?.toString()) === currentBranch?._id)
    );
  }, [users, currentBranch]);

  useEffect(() => {
    if (user?.role !== "staff") {
      api.get<(AppUser & { id?: string })[]>("/api/auth/users").then((d) => { if (d.success) setUsers(d.data || []); });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (!editName) setEditName((user.name as string) || (user.username as string) || "");
      if (!editMobile) setEditMobile((user.mobile as string) || "");
    }
  }, [user]);

  useEffect(() => {
    loadBranches();
  }, [currentBranch]);

  async function loadBranches() {
    try {
      const d = await api.get<Branch[]>("/api/branches");
      if (d.success) setAllBranches(d.data || []);
    } catch {}
  }

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const res = await api.get<{ status?: string; error?: string; connectedPhone?: string }>("/api/whatsapp/status");
          if (cancelled) return;
          if (res.success) {
            if (res.data?.status === "connected") {
              setWaStatus("connected");
            } else if (res.data?.status === "error") {
              setWaStatus("error");
            } else {
              setWaStatus("disconnected");
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 5000));
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
      setBranchLogoPreview(dataUrl);
      setBranchForm((f) => ({ ...f, logo: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBranchLogoPreview(dataUrl);
      setBranchForm((f) => ({ ...f, logo: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    setSaveProfileMsg("");
    const res = await api.put("/api/auth/me", { name: editName, mobile: editMobile, password: editPassword });
    setSavingProfile(false);
    if (res.success) {
      setSaveProfileMsg("Profile updated");
      if (res.data) setUser(res.data as AppUser);
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
      const list = await api.get<(AppUser & { id?: string })[]>("/api/auth/users");
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
    if (!branchForm.ownerUsername.trim() || !branchForm.ownerPassword.trim()) {
      toast.error("Owner username and password are required");
      return;
    }
    setBranchSaving(true);
    const res = await api.post("/api/branches", branchForm);
    setBranchSaving(false);
    if (res.success) {
      toast.success("Branch created");
      setShowAddBranch(false);
      setBranchForm({ name: "", code: "", dbName: "", address: "", phone: "", email: "", logo: "", ownerName: "", ownerPhone: "", ownerEmail: "", ownerUsername: "", ownerPassword: "" });
      loadBranches();
    } else {
      toast.error(res.message || "Failed to create branch");
    }
  }

  async function handleEditBranch(branch: Branch) {
    setEditingBranch(branch);
    const ownerUser = users.find(
      (u) => u.role === "owner" && (u.branches || []).some((b: any) => (b._id || b)?.toString() === branch._id)
    );
    setBranchForm({
      name: branch.name,
      code: branch.code,
      dbName: branch.dbName,
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      logo: branch.settings?.logo || "",
      ownerName: branch.settings?.ownerName || "",
      ownerPhone: branch.settings?.ownerPhone || "",
      ownerEmail: branch.settings?.ownerEmail || "",
      ownerUsername: ownerUser?.username || "",
      ownerPassword: "",
    });
    setBranchLogoPreview(branch.settings?.logo || "");
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
      setBranchForm({ name: "", code: "", dbName: "", address: "", phone: "", email: "", logo: "", ownerName: "", ownerPhone: "", ownerEmail: "", ownerUsername: "", ownerPassword: "" });
      loadBranches();
      api.get<(AppUser & { id?: string })[]>("/api/auth/users").then((d) => { if (d.success) setUsers(d.data || []); });
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

  async   function handleSwitchBranch(branchId: string) {
    setCurrentBranch(branchId);
    toast.success("Branch switched");
    window.location.reload();
  }

  const branchStaff = useMemo(() => getCurrentBranchStaff(), [getCurrentBranchStaff]);

  return (
    <div className="max-w-5xl mx-auto">
      <SettingsHeader
        user={user}
        currentBranch={currentBranch}
        branches={branches}
        isStaff={isStaff}
        onSwitchBranch={handleSwitchBranch}
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="shrink-0 lg:w-52">
          <SectionNav
            sections={visibleSections}
            activeSection={activeSection}
            onSectionClick={setActiveSection}
          />
        </aside>

        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
        {/* ──────────────── WHATSAPP ──────────────── */}
        {activeSection === "whatsapp" && !isStaff && (
          <div>
            <SectionCard icon={<MessageCircle size={16} />} title={uiT("WhatsApp Integration", "WhatsApp इंटीग्रेशन")} subtitle={uiT("Connect WhatsApp for automated messaging", "स्वचालित संदेशों के लिए WhatsApp कनेक्ट करें")}>
              <div className="space-y-5">
                <div className={`rounded-sm border p-5 transition-all duration-500 ${
                  waStatus === "connected"
                    ? "bg-[#1ed760]/5 border-[#1ed760]/20"
                    : waStatus === "error"
                    ? "bg-[#e74c3c]/5 border-[#e74c3c]/20"
                    : "bg-th-elevated border-th-border"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        waStatus === "connected" ? "bg-[#1ed760] animate-pulse" :
                        waStatus === "error" ? "bg-[#e74c3c]" :
                        "bg-th-muted"
                      }`} />
                       <span className="text-sm font-medium text-th-text">
                         {waStatus === "connected" ? uiT("Connected", "कनेक्टेड") :
                          waStatus === "disconnected" ? uiT("Not Configured", "कॉन्फ़िगर नहीं") :
                          waStatus === "error" ? uiT("Configuration Error", "कॉन्फ़िगरेशन त्रुटि") :
                          uiT("Checking...", "जांच रहे हैं...")}
                      </span>
                    </div>
                    {currentBranch?.settings?.ownerPhone && (
                      <span className="text-xs font-medium text-th-secondary">{uiT("Admin Number:", "एडमिन नंबर:")} {currentBranch?.settings?.ownerPhone}</span>
                    )}
                  </div>
                  {waStatus === "connected" && (
                    <div className="flex items-center gap-2 text-[#1ed760]">
                      <CheckCircle2 size={16} />
                      <span className="text-xs font-medium">{uiT("WhatsApp Cloud API is active", "WhatsApp क्लाउड API सक्रिय है")}</span>
                    </div>
                  )}
                  {waStatus === "disconnected" && (
                    <p className="text-xs text-th-secondary">{uiT("Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env", ".env में WHATSAPP_ACCESS_TOKEN और WHATSAPP_PHONE_NUMBER_ID सेट करें")}</p>
                  )}
                  {waStatus === "error" && (
                    <p className="text-xs text-red-500">{uiT("Configuration error. Check your environment variables.", "कॉन्फ़िगरेशन त्रुटि। अपने एनवायरनमेंट वेरिएबल जांचें।")}</p>
                  )}
                  {waStatus === "checking" && (
                    <p className="text-xs text-th-muted">{uiT("Checking configuration...", "कॉन्फ़िगरेशन जांच रहे हैं...")}</p>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ──────────────── BRANCHES ──────────────── */}
        {activeSection === "branches" && !isStaff && (
          <div>
            <SectionCard icon={<Globe size={16} />} title={uiT("Branch Management", "शाखा प्रबंधन")} subtitle={uiT("Manage all your business locations", "अपने सभी व्यापार स्थान प्रबंधित करें")}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-th-secondary">
                    {allBranches.length} {allBranches.length === 1 ? uiT("branch", "शाखा") : uiT("branches", "शाखाएँ")} {uiT("configured", "कॉन्फ़िगर किए गए")}
                  </p>
                  <motion.button
                    onClick={() => {
                      setEditingBranch(null);
                      setBranchForm({ name: "", code: "", dbName: "", address: "", phone: "", email: "", logo: "", ownerName: "", ownerPhone: "", ownerEmail: "", ownerUsername: "", ownerPassword: "" });
                      setShowAddBranch(true);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary btn-sm"
                  >
                    <UserPlus size={14} />
                    {uiT("Add Branch", "शाखा जोड़ें")}
                  </motion.button>
                </div>

                {allBranches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-th-elevated rounded-sm border border-dashed border-th-border text-center">
                    <Building2 size={40} className="text-[#1ed760] mb-3" />
                    <p className="text-base font-semibold text-th-text">{uiT("Get started with your first branch", "अपनी पहली शाखा से शुरुआत करें")}</p>
                    <p className="text-xs text-th-secondary mt-1 mb-6 max-w-sm">{uiT("Add a branch to create its database and owner login, then start selling", "शाखा जोड़ें — इसका डेटाबेस और मालिक लॉगिन बनेगा, फिर बिक्री शुरू करें")}</p>
                    <motion.button
                      onClick={() => {
                        setEditingBranch(null);
                        setBranchForm({ name: "", code: "", dbName: "", address: "", phone: "", email: "", logo: "", ownerName: "", ownerPhone: "", ownerEmail: "", ownerUsername: "", ownerPassword: "" });
                        setShowAddBranch(true);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary"
                    >
                      <UserPlus size={15} />
                      {uiT("Add your first branch", "अपनी पहली शाखा जोड़ें")}
                    </motion.button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {allBranches.map((b) => (
                      <motion.div
                        key={b._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-th-surface rounded-sm border border-th-border transition-all duration-200"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-sm flex items-center justify-center shrink-0 ${
                            b.isActive
                              ? "bg-[#1ed760]/10 text-[#1ed760]"
                              : "bg-th-elevated text-th-muted"
                          }`}>
                            <Building2 size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-th-text">{b.name}</p>
                              <span className={`text-[14px] px-2 py-0.5 rounded-lg font-medium ${
                                b.isActive ? "badge-green" : "badge-gray"
                              }`}>
                                {b.isActive ? uiT("Active", "सक्रिय") : uiT("Inactive", "निष्क्रिय")}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                              <span className="text-xs text-th-secondary">{b.code}</span>
                              {b.phone && (
                                <span className="text-xs text-th-secondary">· {b.phone}</span>
                              )}
                              {b.address && (
                                <span className="text-xs text-th-secondary truncate max-w-[200px]">· {b.address}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSwitchBranch(b._id)}
                            className="p-2 rounded-sm text-th-muted hover:text-[#1ed760] hover:bg-th-elevated hover:bg-[#1ed760]/10 transition-all"
                            title="Switch to this branch"
                          >
                            <ArrowRight size={14} />
                          </button>
                          <button
                            onClick={() => handleEditBranch(b)}
                            className="p-2 rounded-sm text-th-muted hover:text-blue-500 hover:bg-th-elevated hover:bg-[#1ed760]/10 transition-all"
                            title="Edit branch"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b._id)}
                            className="p-2 rounded-sm text-th-muted hover:text-[#e74c3c] hover:bg-th-elevated hover:bg-[#e74c3c]/10 transition-all"
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
        {activeSection === "staff" && !isStaff && (
          <div>
            <SectionCard icon={<Shield size={16} />} title={uiT("Staff & Security", "स्टाफ और सुरक्षा")} subtitle={uiT("Manage team members and access control", "टीम के सदस्यों और पहुँच नियंत्रण का प्रबंधन करें")}>
              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 bg-th-elevated rounded-sm border border-th-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-amber-500/10 flex items-center justify-center">
                      <Crown size={18} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-th-text">{uiT("Administrator", "प्रशासक")}</p>
                      <p className="text-xs text-th-secondary">{uiT("Full system access", "पूर्ण सिस्टम पहुँच")}</p>
                    </div>
                  </div>
                  <span className="badge-green">{uiT("Admin", "एडमिन")}</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-th-text">{uiT("Team Members", "टीम सदस्य")}</p>
                    <motion.button
                      onClick={() => setShowAddStaff(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary btn-sm"
                    >
                      <UserPlus size={14} />
                      {uiT("Add Staff", "स्टाफ जोड़ें")}
                    </motion.button>
                  </div>
                  {branchStaff.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 bg-th-elevated rounded-sm border border-dashed border-th-border">
                      <User size={28} className="text-th-muted mb-2" />
                      <p className="text-sm text-th-secondary">{uiT("No staff for this branch", "इस शाखा के लिए कोई स्टाफ नहीं")}</p>
                      <p className="text-xs text-th-secondary mt-0.5">{uiT("Add team members to manage this location", "इस स्थान के प्रबंधन के लिए टीम सदस्य जोड़ें")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branchStaff.map((u: any) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between gap-3 p-3 bg-th-surface/30 rounded-sm border border-th-border transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#1ed760] flex items-center justify-center text-th-text text-xs font-bold shrink-0">
                              {(u.name || u.username || "S").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-th-text truncate">
                                {u.name || u.username}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-th-secondary">@{u.username}</span>
                                {u.mobile && (
                                  <span className="text-xs text-th-secondary">· {u.mobile}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 rounded-sm text-th-muted hover:text-[#e74c3c] hover:bg-th-elevated hover:bg-[#e74c3c]/10 transition-all"
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
        {activeSection === "account" && (
        <div>
          <SectionCard icon={<User size={16} />} title={uiT("Login Credentials", "लॉगिन जानकारी")} subtitle={uiT("Your sign-in identity — used across all branches", "आपकी साइन-इन पहचान — सभी शाखाओं में उपयोग होती है")}>
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-4 p-5 bg-th-elevated bg-violet-900/10 rounded-sm border border-violet-500/20">
                <div className="w-14 h-14 rounded-sm bg-[#1ed760] flex items-center justify-center text-th-text text-xl font-bold shrink-0">
                  {(user?.username as string || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-semibold text-th-text">
                      @{user?.username as string}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[14px] font-medium bg-th-elevated bg-violet-900/20 text-violet-300 ring-1 ring-violet-500/20">
                      <Building2 size={10} />
                      {currentBranch?.name || "—"}
                    </span>
                    <span className={`text-[14px] px-2 py-0.5 rounded-lg font-medium ${
                      isStaff ? "badge-blue" : "badge-purple"
                    }`}>
                      {(user?.role as string) || "—"}
                    </span>
                  </div>
                  <p className="text-xs text-th-secondary">
                    Owner name, phone &amp; email are managed per branch in <strong>Branch Management</strong> above
                  </p>
                </div>
              </div>

              <div className="p-4 bg-th-elevated rounded-sm border border-th-border">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={14} className="text-th-secondary" />
                  <p className="text-sm font-medium text-th-text">{uiT("Change Password", "पासवर्ड बदलें")}</p>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      label={uiT("New Password", "नया पासवर्ड")}
                      icon={<Key size={15} />}
                      type={showPassword ? "text" : "password"}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder={uiT("Enter new password", "नया पासवर्ड दर्ज करें")}
                    />
                    {editPassword && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-[38px] text-th-muted hover:text-th-muted transition-colors"
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
                          {uiT("Saving...", "सहेज रहे हैं...")}
                        </span>
                      ) : uiT("Update Password", "पासवर्ड अपडेट करें")}
                    </motion.button>
                    <AnimatePresence mode="wait">
                      {saveProfileMsg && (
                        <motion.span
                          key={saveProfileMsg}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className={`text-xs ${
                            saveProfileMsg.includes("Error") ? "text-red-500" : "text-[#1ed760]"
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
                <p className="text-sm font-medium text-th-text mb-3">{uiT("Appearance", "थीम")}</p>
                <ThemeToggle dark={dark} onToggle={toggleTheme} />
              </div>

              <div>
                <p className="text-sm font-medium text-th-text mb-3">{uiLang === "hi" ? "ऐप भाषा" : "App Language"}</p>
                <button
                  onClick={toggleUiLang}
                  className="flex items-center justify-between w-full px-4 py-3 bg-th-elevated hover:bg-th-hover rounded-sm border border-th-border transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-th-elevated bg-[#1ed760]/10 flex items-center justify-center">
                      <Globe size={16} className="text-th-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-th-text">
                        {uiLang === "hi" ? "हिन्दी" : "English"}
                      </p>
                      <p className="text-xs text-th-secondary">
                        {uiLang === "hi" ? "पूरा ऐप हिन्दी में दिखेगा" : "Entire app UI will be in English"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${uiLang === "hi" ? "bg-[#1ed760]" : "bg-th-border"}`}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform" style={{ transform: uiLang === "hi" ? "translateX(18px)" : "translateX(2px)" }} />
                  </div>
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-th-text mb-3">{lang === "hi" ? "संदेश भाषा" : "Message Language"}</p>
                <button
                  onClick={toggleLang}
                  className="flex items-center justify-between w-full px-4 py-3 bg-th-elevated hover:bg-th-hover rounded-sm border border-th-border transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-th-elevated bg-[#1ed760]/10 flex items-center justify-center">
                      <Languages size={16} className="text-[#1ed760]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-th-text">
                        {lang === "hi" ? "हिन्दी" : "English"}
                      </p>
                      <p className="text-xs text-th-secondary">
                        {lang === "hi" ? "WhatsApp संदेश हिन्दी में जाएंगे" : "WhatsApp messages will be in English"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${lang === "hi" ? "bg-[#1ed760]" : "bg-th-border"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${lang === "hi" ? "translate-x-4.5 left-0.5" : "left-0.5"}`} style={{ transform: lang === "hi" ? "translateX(18px)" : "translateX(2px)" }} />
                  </div>
                </button>
              </div>

              <div className="pt-2 border-t border-th-border">
                <p className="text-sm font-medium text-th-text mb-3">{uiT("Danger Zone", "खतरनाक क्षेत्र")}</p>
                <motion.button
                  onClick={() => setShowLogoutConfirm(true)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between w-full px-4 py-3 bg-th-elevated hover:bg-[#e74c3c]/10 rounded-sm border border-[#e74c3c]/20 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-[#e74c3c]/20 flex items-center justify-center">
                      <LogOut size={16} className="text-[#e74c3c]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#e74c3c]">{uiT("Sign Out", "लॉग आउट")}</p>
                      <p className="text-xs text-th-muted">{uiT("End your current session", "अपना सत्र समाप्त करें")}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-[#e74c3c] group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              </div>
            </div>
          </SectionCard>
        </div>
        )}
          </motion.div>
        </AnimatePresence>
      </main>
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-th-surface rounded-t-lg border border-th-border max-h-[85vh] flex flex-col sm:max-w-lg sm:mx-auto sm:bottom-4 sm:rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-th-border" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-th-border shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-th-text">{uiT("Add Staff Account", "स्टाफ खाता जोड़ें")}</h3>
                  <p className="text-xs text-th-secondary mt-0.5">{uiT("Create a new team member account", "नया टीम सदस्य खाता बनाएं")}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAddStaff(false)}
                  className="p-2 hover:bg-th-hover rounded-sm text-th-muted hover:text-th-muted transition-colors"
                >
                  <X size={18} />
                </motion.button>
              </div>
              <div className="overflow-y-auto px-6 py-4">
                <form onSubmit={handleAddStaff} className="space-y-4">
                  <Input
                    label={uiT("Full Name", "पूरा नाम")}
                    icon={<User size={15} />}
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder={uiT("Staff full name", "स्टाफ का पूरा नाम")}
                  />
                  <Input
                    label={uiT("Username *", "उपयोगकर्ता नाम *")}
                    icon={<AtSign size={15} />}
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    placeholder={uiT("Login username", "लॉगिन उपयोगकर्ता नाम")}
                    required
                  />
                  <Input
                    label={uiT("Password *", "पासवर्ड *")}
                    icon={<Key size={15} />}
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder={uiT("Secure password", "सुरक्षित पासवर्ड")}
                    required
                  />
                  <Input
                    label={uiT("Mobile", "मोबाइल")}
                    icon={<Smartphone size={15} />}
                    value={staffForm.mobile}
                    onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                    placeholder={uiT("Phone number", "फ़ोन नंबर")}
                  />
                  <Select
                    label={uiT("Branch *", "शाखा *")}
                    icon={<Building2 size={15} />}
                    value={staffBranch}
                    onChange={(e) => setStaffBranch(e.target.value)}
                    required
                  >
                    <option value="">{uiT("Select a branch", "शाखा चुनें")}</option>
                    {allBranches.filter((b) => b.isActive).map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </Select>
                  <div className="flex justify-end gap-3 pt-4 border-t border-th-border">
                    <button type="button" onClick={() => setShowAddStaff(false)} className="btn-secondary">{uiT("Cancel", "रद्द करें")}</button>
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
                          {uiT("Creating...", "बना रहे हैं...")}
                        </span>
                      ) : uiT("Create Staff", "स्टाफ बनाएं")}
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-th-surface rounded-t-lg border border-th-border max-h-[85vh] flex flex-col sm:max-w-lg sm:mx-auto sm:bottom-4 sm:rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-th-border" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-th-border shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-th-text">
                    {editingBranch ? uiT("Edit Branch", "शाखा संपादित करें") : uiT("Add New Branch", "नई शाखा जोड़ें")}
                  </h3>
                  <p className="text-xs text-th-secondary mt-0.5">
                    {editingBranch ? uiT("Update branch information", "शाखा जानकारी अपडेट करें") : uiT("Create a new business location", "नया व्यापार स्थान बनाएं")}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowAddBranch(false); setEditingBranch(null); }}
                  className="p-2 hover:bg-th-hover rounded-sm text-th-muted hover:text-th-muted transition-colors"
                >
                  <X size={18} />
                </motion.button>
              </div>
              <div className="overflow-y-auto px-6 py-4">
                <form onSubmit={editingBranch ? handleUpdateBranch : handleAddBranch} className="space-y-4">
                  <Input
                    label={uiT("Branch Name *", "शाखा का नाम *")}
                    icon={<Building2 size={15} />}
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    placeholder="e.g. Govindpuri"
                    required
                  />
                  <div className="flex items-center gap-4">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className={`relative w-20 h-20 shrink-0 border-2 border-dashed rounded-sm flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-colors ${
                        branchLogoPreview ? "border-th-border bg-th-elevated" : "border-th-border bg-th-elevated hover:border-[#1ed760]"
                      }`}
                    >
                      {branchLogoPreview ? (
                        <img src={branchLogoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-th-muted">
                          <Upload size={16} />
                          <span className="text-[11px] font-medium">{uiT("Logo", "लोगो")}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-th-text">{uiT("Branch Logo", "शाखा लोगो")}</p>
                      <p className="text-xs text-th-secondary mt-0.5">{uiT("Appears on dashboard and bills", "डैशबोर्ड और बिल पर दिखाई देता है")}</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-xs font-medium text-[#1ed760] hover:underline"
                      >
                        {branchLogoPreview ? uiT("Change Logo", "लोगो बदलें") : uiT("Upload Logo", "लोगो अपलोड करें")}
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label={uiT("Branch Code *", "शाखा कोड *")}
                      icon={<AtSign size={15} />}
                      value={branchForm.code}
                      onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                      placeholder="e.g. GVP"
                      required
                      disabled={!!editingBranch}
                      helperText={uiT("Short identification code", "छोटा पहचान कोड")}
                    />
                    <Input
                      label={uiT("Database Name *", "डेटाबेस नाम *")}
                      icon={<Globe size={15} />}
                      value={branchForm.dbName}
                      onChange={(e) => setBranchForm({ ...branchForm, dbName: e.target.value })}
                      placeholder="e.g. kmj_govindpuri"
                      required
                      disabled={!!editingBranch}
                      helperText={uiT("MongoDB database name", "MongoDB डेटाबेस नाम")}
                    />
                  </div>
                  <Textarea
                    label={uiT("Address", "पता")}
                    icon={<MapPin size={15} />}
                    rows={2}
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    placeholder={uiT("Branch address", "शाखा का पता")}
                    className="pl-10"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label={uiT("Phone", "फ़ोन")}
                      icon={<Phone size={15} />}
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                      placeholder={uiT("Contact number", "संपर्क नंबर")}
                    />
                    <Input
                      label={uiT("Email", "ईमेल")}
                      icon={<Mail size={15} />}
                      type="email"
                      value={branchForm.email}
                      onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                      placeholder="branch@example.com"
                    />
                  </div>

                  <div className="pt-2 border-t border-th-border">
                    <p className="text-xs font-semibold text-th-secondary uppercase tracking-wider mb-3">{uiT("Owner Details", "मालिक विवरण")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label={uiT("Owner Name", "मालिक का नाम")}
                        icon={<User size={15} />}
                        value={branchForm.ownerName}
                        onChange={(e) => setBranchForm({ ...branchForm, ownerName: e.target.value })}
                        placeholder="e.g. Prakash Rathore"
                      />
                      <Input
                        label={uiT("Owner Phone", "मालिक का फ़ोन")}
                        icon={<Phone size={15} />}
                        value={branchForm.ownerPhone}
                        onChange={(e) => setBranchForm({ ...branchForm, ownerPhone: e.target.value })}
                        placeholder="Owner contact number"
                      />
                    </div>
                    <div className="mt-4">
                      <Input
                        label={uiT("Owner Email", "मालिक का ईमल")}
                        icon={<Mail size={15} />}
                        type="email"
                        value={branchForm.ownerEmail}
                        onChange={(e) => setBranchForm({ ...branchForm, ownerEmail: e.target.value })}
                        placeholder="owner@example.com"
                      />
                    </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <Input
                          label={editingBranch ? uiT("Owner Username", "मालिक यूज़रनेम") : uiT("Owner Username *", "मालिक यूज़रनेम *")}
                          icon={<User size={15} />}
                          value={branchForm.ownerUsername}
                          onChange={(e) => setBranchForm({ ...branchForm, ownerUsername: e.target.value })}
                          placeholder="Login username"
                        />
                        <Input
                          label={editingBranch ? uiT("Owner Password", "मालिक पासवर्ड") : uiT("Owner Password *", "मालिक पासवर्ड *")}
                          icon={<User size={15} />}
                          type="password"
                          value={branchForm.ownerPassword}
                          onChange={(e) => setBranchForm({ ...branchForm, ownerPassword: e.target.value })}
                          placeholder={editingBranch ? "Leave blank to keep current" : "Min 4 characters"}
                        />
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-th-border">
                    <button type="button" onClick={() => { setShowAddBranch(false); setEditingBranch(null); }} className="btn-secondary">{uiT("Cancel", "रद्द करें")}</button>
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
                          {uiT("Saving...", "सहेज रहे हैं...")}
                        </span>
                      ) : (editingBranch ? uiT("Update Branch", "शाखा अपडेट करें") : uiT("Create Branch", "शाखा बनाएं"))}
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-th-surface rounded-t-lg border border-th-border sm:max-w-sm sm:mx-auto sm:bottom-4 sm:rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-th-border" />
              </div>
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-sm bg-[#e74c3c]/20 flex items-center justify-center mx-auto mb-4">
                  <LogOut size={24} className="text-[#e74c3c]" />
                </div>
                <h3 className="text-lg font-bold text-th-text mb-2">{uiT("Sign Out", "साइन आउट")}</h3>
                <p className="text-sm text-th-secondary mb-6">{uiT("Are you sure you want to end your session?", "क्या आप अपना सत्र समाप्त करना चाहते हैं?")}</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowLogoutConfirm(false)} className="btn-secondary">{uiT("Cancel", "रद्द करें")}</button>
                  <motion.button
                    onClick={handleLogout}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-danger"
                  >
                    <LogOut size={15} />
                    {uiT("Sign Out", "साइन आउट")}
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
