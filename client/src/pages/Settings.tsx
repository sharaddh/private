import React, { useState } from "react";
import { Save, User, Shield, Bell } from "lucide-react";

export default function Settings() {
  const [shopName, setShopName] = useState("KMJ Optical");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your ERP system preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Shop Profile</h3>
              <p className="text-xs text-gray-500">Update shop information</p>
            </div>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Shop Name</label>
              <input className="input-field" value={shopName} onChange={(e) => setShopName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <textarea className="input-field" rows={2} value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input className="input-field" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary flex items-center gap-2">
              {saved ? "Saved!" : <><Save size={18} /> Save Settings</>}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Security</h3>
              <p className="text-xs text-gray-500">Manage access and security</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-medium text-gray-900">User Role</p>
              <p className="text-xs text-gray-500 mt-1">Currently: Owner / Operator</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-medium text-gray-900">Multi-role Support</p>
              <p className="text-xs text-gray-500 mt-1">Coming in a future update</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500">Coming soon</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">WhatsApp automation features:</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">• Order Ready Notification</li>
              <li className="flex items-center gap-2">• Payment Reminder</li>
              <li className="flex items-center gap-2">• Annual Eye Check Reminder</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
