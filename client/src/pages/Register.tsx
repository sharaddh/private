import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Input } from "../components/Form";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post("/api/auth/register", { username, password });
      if (res.success) {
        navigate("/login");
      } else {
        setError(res.message || "Registration failed");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">👓</div>
          <h1 className="text-4xl font-bold text-white mb-2">KMJ Optical</h1>
          <p className="text-blue-100">ERP Management System</p>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors mt-6"
            >
              {isLoading ? "Registering..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-600 text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:text-blue-800 font-semibold">
                Login here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-100 mt-6 text-sm">
          © 2026 KMJ Optical. All rights reserved.
        </p>
      </div>
    </div>
  );
}
