import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { LogIn, Eye, EyeOff, Shield } from "lucide-react";

export default function StaffLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, setCurrentBranch } = useAuth();

  useEffect(() => {
    if (localStorage.getItem("accessToken")) navigate("/", { replace: true });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await api.post("/api/auth/staff-login", { username, password });
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
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-amber-500/20">
            <Shield className="text-white" size={22} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">KMJ Optical</h1>
          <p className="text-sm text-gray-500 mt-1">Staff Login</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
              <input type="text" placeholder="Enter username" value={username}
                onChange={(e) => setUsername(e.target.value)} required className="input-field" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder="Enter password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required className="input-field pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2 shadow-md hover:shadow-lg">
              {isLoading ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Signing in...</>
              ) : <><LogIn size={18} /> Sign in</>}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-5">
            Admin? <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
