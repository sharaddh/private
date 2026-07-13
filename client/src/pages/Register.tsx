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
      const res = await api.post("/api/auth/register", form);
      if (res.success) {
        navigate("/login", { state: { message: "Account created. Please sign in." } });
      } else {
        setError(res.message || "Registration failed");
      }
    } catch { setError("An error occurred"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-primary-500/20">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{uiT("Create Account")}</h1>
          <p className="text-sm text-gray-500 mt-1">{uiT("Sign up for KMJ Optical ERP")}</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Full Name")}</label>
              <input className="input-field" placeholder={uiT("Your name")} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input type="email" className="input-field" placeholder="you@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Mobile")}</label>
              <input className="input-field" inputMode="numeric" placeholder="+91 98765 43210" value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })} required minLength={10} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Password")}</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className="input-field pr-10" placeholder={uiT("Min 6 characters")} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mt-2 shadow-md hover:shadow-lg">
              {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <UserPlus size={18} />}
              {loading ? uiT("Creating account...") : uiT("Create Account")}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-gray-500">
              {uiT("Already have an account?")}{" "}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">{uiT("Sign in")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
