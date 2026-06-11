import React, { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post("/api/auth/login", { username, password });
    if (res.success) {
      api.setToken(res.data.access);
      navigate('/');
    } else {
      setError(res.message || "Login failed");
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Login</h2>
      <form onSubmit={submit} className="grid grid-cols-1 gap-2 max-w-sm">
        <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" className="border p-2" />
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="border p-2" />
        {error && <div className="text-red-600">{error}</div>}
        <button className="bg-blue-600 text-white p-2">Login</button>
      </form>
    </div>
  );
}
