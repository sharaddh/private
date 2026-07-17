import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { useTranslate } from "../context/TranslateContext";
import { Eye, EyeOff, UserPlus } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const { uiT } = useTranslate();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ access: string; refresh: string }>("/api/auth/register", form);
      if (res.success) {
        navigate("/login", { state: { message: "Account created. Please sign in." } });
      } else {
        setError(res.message || "Registration failed");
      }
    } catch { setError("An error occurred"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-th-base flex items-center justify-center p-4" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#1ed760] rounded-sm flex items-center justify-center mx-auto mb-4">
            <span className="text-black font-bold text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold text-th-text tracking-tight">{uiT("Create Account", "खाता बनाएं")}</h1>
          <p className="text-sm text-th-secondary mt-1 font-normal">{uiT("Sign up for KMJ Optical ERP", "KMJ Optical ERP के लिए साइन अप करें")}</p>
        </div>

        <div className="bg-th-surface rounded-lg p-6 shadow-2xl">
          {error && (
            <div className="bg-[#3d1515] border border-[#b91c1c] text-[#f87171] px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Full Name", "पूरा नाम")}</label>
              <input className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                placeholder={uiT("Your name", "आपका नाम")} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Email</label>
              <input type="email" className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                placeholder="you@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Mobile", "मोबाइल")}</label>
              <input className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                inputMode="numeric" placeholder="+91 98765 43210" value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })} required minLength={10} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Password", "पासवर्ड")}</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"}
                  className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all pr-10"
                  placeholder={uiT("Min 6 characters", "कम से कम 6 अक्षर")} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-th-secondary hover:text-th-text transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#1ed760] text-black rounded-[9999px] text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" /> : <UserPlus size={18} />}
              {loading ? uiT("Creating account...", "खाता बन रहा है...") : uiT("Create Account", "खाता बनाएं")}
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
