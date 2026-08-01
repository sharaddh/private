import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { useTranslate } from "../context/TranslateContext";
import { Eye, EyeOff, Store } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const { uiT } = useTranslate();
  const [form, setForm] = useState({
    name: "",
    code: "",
    dbName: "",
    address: "",
    phone: "",
    email: "",
    ownerName: "",
    ownerUsername: "",
    ownerPassword: "",
    ownerPhone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.code.trim() || !form.dbName.trim()) {
      setError("Branch name, code, and database name are required");
      return;
    }
    if (!form.ownerUsername.trim() || !form.ownerPassword.trim()) {
      setError("Owner username and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register-branch-owner", form);
      if (res.success) {
        navigate("/login", { state: { message: `Branch "${form.name}" and its owner created. Please sign in.` } });
      } else {
        setError(res.message || "Setup failed");
      }
    } catch { setError("An error occurred"); }
    finally { setLoading(false); }
  }

  const input = "w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all";
  const label = "block text-sm font-medium text-th-secondary mb-1.5";

  return (
    <div className="min-h-screen bg-th-base flex items-center justify-center p-4" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#1ed760] rounded-sm flex items-center justify-center mx-auto mb-4">
            <Store size={22} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold text-th-text tracking-tight">{uiT("Create Branch & Owner", "ब्रांच और मालिक बनाएं")}</h1>
          <p className="text-sm text-th-secondary mt-1 font-normal">{uiT("Temporary setup page - creates a branch with its owner", "अस्थायी सेटअप पेज")}</p>
        </div>

        <div className="bg-th-surface rounded-lg p-6 shadow-2xl">
          {error && (
            <div className="bg-[#3d1515] border border-[#b91c1c] text-[#f87171] px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs font-bold text-th-secondary uppercase tracking-wider mb-1">{uiT("Branch", "ब्रांच")}</p>
            <div>
              <label className={label}>{uiT("Branch Name", "ब्रांच का नाम")} *</label>
              <input className={input} placeholder="e.g. Govindpuri" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{uiT("Branch Code", "ब्रांच कोड")} *</label>
                <input className={input} placeholder="e.g. GVP" value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div>
                <label className={label}>{uiT("Database Name", "डेटाबेस नाम")} *</label>
                <input className={input} placeholder="e.g. kmj_govindpuri" value={form.dbName}
                  onChange={(e) => setForm({ ...form, dbName: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className={label}>{uiT("Address", "पता")}</label>
              <input className={input} placeholder="Optional" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{uiT("Phone", "फ़ोन")}</label>
                <input className={input} placeholder="Optional" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className={label}>Email</label>
                <input type="email" className={input} placeholder="Optional" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="border-t border-th-border-strong my-1" />
            <p className="text-xs font-bold text-th-secondary uppercase tracking-wider mb-1">{uiT("Branch Owner", "ब्रांच मालिक")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{uiT("Owner Name", "मालिक का नाम")}</label>
                <input className={input} placeholder="Optional" value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </div>
              <div>
                <label className={label}>{uiT("Owner Mobile", "मालिक मोबाइल")}</label>
                <input className={input} placeholder="Optional" value={form.ownerPhone}
                  onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{uiT("Owner Username", "मालिक उपयोगकर्ता नाम")} *</label>
                <input className={input} placeholder="e.g. hariom" value={form.ownerUsername}
                  onChange={(e) => setForm({ ...form, ownerUsername: e.target.value })} required />
              </div>
              <div>
                <label className={label}>{uiT("Owner Password", "मालिक पासवर्ड")} *</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"}
                    className={input + " pr-10"}
                    placeholder="Min 4 characters" value={form.ownerPassword}
                    onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} required minLength={4} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-th-secondary hover:text-th-text transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#1ed760] text-black rounded-[9999px] text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" /> : <Store size={18} />}
              {loading ? uiT("Creating...", "बना रहा है...") : uiT("Create Branch & Owner", "ब्रांच और मालिक बनाएं")}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-th-secondary">
              {uiT("Already have an account?", "पहले से खाता है?")}{" "}
              <Link to="/login" className="text-[#1ed760] hover:underline font-medium">{uiT("Sign in", "साइन इन")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
