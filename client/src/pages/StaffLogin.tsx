import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useTranslate } from "../context/TranslateContext";
import { LogIn, Eye, EyeOff, Shield } from "lucide-react";

export default function StaffLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, setCurrentBranch } = useAuth();
  const { uiT } = useTranslate();

  useEffect(() => {
    if (localStorage.getItem("accessToken")) navigate("/", { replace: true });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await api.post<{ access: string; refresh: string; branchId?: string }>("/api/auth/staff-login", { username, password });
      if (res.success) {
        login(res.data!.access, res.data!.refresh);
        if (res.data!.branchId) {
          localStorage.setItem("currentBranchId", res.data!.branchId);
          setCurrentBranch(res.data!.branchId);
        }
        navigate("/", { replace: true });
      } else { setError(res.message || "Login failed"); }
    } catch { setError("Connection error. Try again."); }
    finally { setIsLoading(false); }
  }

  return (
    <div className="min-h-screen bg-th-base flex items-center justify-center p-4" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#1ed760] rounded-sm flex items-center justify-center mx-auto mb-4">
            <Shield className="text-black" size={22} />
          </div>
          <h1 className="text-2xl font-bold text-th-text tracking-tight">KMJ Optical</h1>
          <p className="text-sm text-th-secondary mt-1 font-normal">{uiT("Staff Login", "स्टाफ लॉगिन")}</p>
        </div>

        <div className="bg-th-surface rounded-lg p-6 shadow-2xl">
          {error && (
            <div className="bg-[#3d1515] border border-[#b91c1c] text-[#f87171] px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Username", "उपयोगकर्ता नाम")}</label>
              <input type="text" placeholder={uiT("Enter username", "उपयोगकर्ता नाम दर्ज करें")} value={username}
                onChange={(e) => setUsername(e.target.value)} required
                className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Password", "पासवर्ड")}</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder={uiT("Enter password", "पासवर्ड दर्ज करें")} value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-th-secondary hover:text-th-text transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full py-3 bg-[#1ed760] text-black rounded-[9999px] text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? (
                <><div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" /> {uiT("Signing in...", "साइन इन हो रहा है...")}</>
              ) : <><LogIn size={18} /> {uiT("Sign in", "साइन इन")}</>}
            </button>
          </form>
          <p className="text-center text-sm text-th-secondary mt-5">
            {uiT("Admin?", "एडमिन?")} <Link to="/login" className="text-[#1ed760] hover:underline font-medium">{uiT("Login here", "यहाँ लॉगिन करें")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
