import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { LogIn, Eye, EyeOff, Package } from "lucide-react";
import Spinner from "../components/Spinner";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await api.post("/api/auth/warehouse-login", { username, password });
      if (res.success && res.data) {
        api.setRefreshToken(res.data.refresh);
        login(res.data.access, res.data.user);
        navigate("/", { replace: true });
      } else {
        setError(res.message || "Login failed");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-th-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-500 rounded-md flex items-center justify-center mx-auto mb-4">
            <Package className="text-surface-950" size={24} />
          </div>
          <h1 className="text-section text-th-text">Lens Warehouse</h1>
          <p className="text-caption text-th-secondary mt-1">KMJ Optical — Branch owners: use your same KMJ credentials</p>
        </div>

        <div className="glass-card p-6">
          {error && (
            <div className="bg-negative/10 border border-negative/30 text-negative px-4 py-3 rounded-pill text-sm mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Username</label>
              <input type="text" placeholder="Enter username" value={username}
                onChange={(e) => setUsername(e.target.value)} required className="input-field" autoFocus />
            </div>
            <div>
              <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder="Enter password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required className="input-field pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
              {isLoading ? (
                <><Spinner size={16} className="border-white border-t-transparent" /> Signing in...</>
              ) : <><LogIn size={18} /> Sign in</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
