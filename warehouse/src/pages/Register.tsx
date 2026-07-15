import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { UserPlus, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Spinner from "../components/Spinner";

export default function Register() {
  const [form, setForm] = useState({ username: "", password: "", name: "", mobile: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
        toast(`User "${form.username}" created successfully`);
        navigate("/users");
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
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-caption text-th-secondary hover:text-th-text mb-4 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="page-title">Register Warehouse User</h1>
        <p className="page-subtitle">Create a new account for warehouse staff</p>
      </div>

      <div className="glass-card p-6">
        {error && <div className="bg-negative/10 border border-negative/30 text-negative px-4 py-3 rounded-pill text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Username *</label>
            <input type="text" placeholder="Unique username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} required className="input-field" autoFocus />
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Password *</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} placeholder="Min 4 characters" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required className="input-field pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Full Name</label>
            <input type="text" placeholder="Optional" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Mobile</label>
            <input type="text" placeholder="Optional" value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="input-field" />
          </div>
          <button type="submit" disabled={isLoading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {isLoading ? (
              <><Spinner size={14} className="border-surface-950 border-t-transparent" /> Creating...</>
            ) : <><UserPlus size={18} /> Create Warehouse User</>}
          </button>
        </form>
      </div>
    </div>
  );
}
