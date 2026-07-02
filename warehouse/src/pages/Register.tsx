import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { UserPlus, Eye, EyeOff, ArrowLeft, Package } from "lucide-react";

export default function Register() {
  const [form, setForm] = useState({ username: "", password: "", name: "", mobile: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.username.trim() || !form.password.trim()) {
      setError("Username and password are required"); return;
    }
    if (form.password.length < 4) {
      setError("Password must be at least 4 characters"); return;
    }
    setIsLoading(true);
    try {
      const res = await api.post("/api/auth/warehouse-register", form);
      if (res.success) {
        setSuccess(`User "${form.username}" created successfully`);
        setForm({ username: "", password: "", name: "", mobile: "" });
      } else {
        setError(res.message || "Failed to create user");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="page-title">Register Warehouse User</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new account for warehouse staff</p>
      </div>

      <div className="card p-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Username *</label>
            <input type="text" placeholder="Unique username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} required className="input-field" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} placeholder="Min 4 characters" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required className="input-field pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input type="text" placeholder="Optional" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile</label>
            <input type="text" placeholder="Optional" value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="input-field" />
          </div>
          <button type="submit" disabled={isLoading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {isLoading ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Creating...</>
            ) : <><UserPlus size={18} /> Create Warehouse User</>}
          </button>
        </form>
      </div>
    </div>
  );
}