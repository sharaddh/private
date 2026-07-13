import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useTranslate } from "../context/TranslateContext";
import { LogIn, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const navigate = useNavigate();
  const { login, setCurrentBranch } = useAuth();
  const { uiT } = useTranslate();

  useEffect(() => {
    if (localStorage.getItem("accessToken")) navigate("/", { replace: true });
    api.get("/api/branches/active").then((res) => {
      if (res.success) setBranches(res.data);
    }).catch(() => {});
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await api.post("/api/auth/login", { username, password, branchId: selectedBranchId || undefined });
      if (res.success) {
        login(res.data.access, res.data.refresh);
        if (res.data.branchId) {
          localStorage.setItem("currentBranchId", res.data.branchId);
          setCurrentBranch(res.data.branchId);
        }
        navigate("/", { replace: true });
      } else { setError(res.message || "Login failed"); }
    } catch { setError("Connection error. Try again."); }
    finally { setIsLoading(false); }
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-primary-500/20">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">KMJ Optical</h1>
          <p className="text-sm text-gray-500 mt-1">{uiT("Admin Login")}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-slate-600 p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Username")}</label>
              <input type="text" placeholder={uiT("Enter username")} value={username}
                onChange={(e) => setUsername(e.target.value)} required className="input-field" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Password")}</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder={uiT("Enter password")} value={password}
                  onChange={(e) => setPassword(e.target.value)} required className="input-field pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Branch")}</label>
              <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} className="input-field">
                <option value="">{uiT("Select branch (optional)")}</option>
                {branches.map((b: any) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={isLoading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2 shadow-md hover:shadow-lg">
              {isLoading ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {uiT("Signing in...")}</>
              ) : <><LogIn size={18} /> {uiT("Sign in")}</>}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-5">
            {uiT("Staff?")} <Link to="/staff-login" className="text-primary-600 hover:text-primary-700 font-medium">{uiT("Login here")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
