import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { UserPlus, ShieldAlert } from "lucide-react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/auth/me").then((res) => {
      if (res.success) setIsFirstUser(false);
    }).catch(() => {
      api.post("/api/auth/login", { username: "___check___", password: "___check___" }).catch((e: any) => {
        if (e?.message?.includes("Invalid credentials")) setIsFirstUser(false);
        else setIsFirstUser(true);
      });
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setIsLoading(true);
    try {
      const res = await api.post("/api/auth/register", { username, password });
      if (res.success) {
        navigate("/login");
      } else {
        setError(res.message || "Registration failed");
        if (res.message?.includes("Admin access")) {
          setError("Admin access required. Please sign in with admin credentials first.");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Connection error. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Admin only — Register new users</p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
              <ShieldAlert size={16} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input type="text" placeholder="Choose username" value={username}
                onChange={(e) => setUsername(e.target.value)} required className="input-field" minLength={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input type="password" placeholder="Min 6 characters" value={password}
                onChange={(e) => setPassword(e.target.value)} required className="input-field" minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
              <input type="password" placeholder="Repeat password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required className="input-field" minLength={6} />
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {isLoading ? "Creating..." : <><UserPlus size={18} /> Create Account</>}
            </button>
          </form>
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-dark-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{" "}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
