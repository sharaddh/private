import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, DollarSign, Eye, ClipboardList } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<"overview" | "visits" | "prescriptions" | "bills" | "orders">("overview");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/customers/${id}`),
      api.get(`/api/visits?customerId=${id}`),
      api.get(`/api/prescriptions?customerId=${id}`),
      api.get("/api/bills"),
      api.get("/api/orders"),
    ]).then(([c, v, p, b, o]) => {
      if (c.success) setCustomer(c.data);
      if (v.success) setVisits(v.data);
      if (p.success) setPrescriptions(p.data);
      if (b.success) setBills(b.data.filter((bill: any) => bill.customerId === id));
      if (o.success) setOrders(o.data.filter((ord: any) => ord.customerId === id));
    });
  }, [id]);

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: Eye },
    { key: "visits", label: `Visits (${visits.length})`, icon: ClipboardList },
    { key: "prescriptions", label: `Prescriptions (${prescriptions.length})`, icon: Eye },
    { key: "bills", label: `Bills (${bills.length})`, icon: DollarSign },
    { key: "orders", label: `Orders (${orders.length})`, icon: ClipboardList },
  ] as const;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/customers")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={18} /> Back to Customers
      </button>

      <div className="card">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-2xl">
            {customer.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-500">{customer.customerId || "—"}</p>
            <div className="flex flex-wrap gap-4 mt-3">
              {customer.mobile && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" /> {customer.mobile}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Mail size={14} className="text-gray-400" /> {customer.email}
                </span>
              )}
              {customer.city && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <MapPin size={14} className="text-gray-400" /> {customer.city}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm text-gray-600">
                <Calendar size={14} className="text-gray-400" /> Joined {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "—"}
              </span>
              {customer.age && <span className="text-sm text-gray-600">Age: {customer.age}</span>}
              {customer.gender && <span className="text-sm text-gray-600">Gender: {customer.gender}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{customer.totalVisits || 0}</p>
          <p className="text-sm text-gray-500">Total Visits</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600">₹{(customer.totalSpent || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Total Spent</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">₹{(customer.pendingAmount || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Pending Amount</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-indigo-600">{customer.tags?.length || 0}</p>
          <p className="text-sm text-gray-500">Tags</p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {tab === "overview" && (
          <div className="card space-y-4">
            {customer.address && (
              <div>
                <p className="text-sm font-medium text-gray-500">Address</p>
                <p className="text-gray-900">{customer.address}</p>
              </div>
            )}
            {customer.alternateMobile && (
              <div>
                <p className="text-sm font-medium text-gray-500">Alternate Mobile</p>
                <p className="text-gray-900">{customer.alternateMobile}</p>
              </div>
            )}
            {customer.tags?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Tags</p>
                <div className="flex gap-2 flex-wrap">
                  {customer.tags.map((tag: string, i: number) => (
                    <span key={i} className="badge-blue">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "visits" && (
          <div className="card">
            {visits.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No visits recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {visits.map((v: any) => (
                  <div key={v._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{new Date(v.visitDate).toLocaleDateString()}</p>
                      {v.doctorName && <p className="text-xs text-gray-500">Doctor: {v.doctorName}</p>}
                    </div>
                    {v.remarks && <p className="text-sm text-gray-500">{v.remarks}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "prescriptions" && (
          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <div className="card"><p className="text-gray-400 text-sm text-center py-8">No prescriptions yet.</p></div>
            ) : (
              prescriptions.map((p: any) => (
                <div key={p._id} className="card">
                  <p className="text-xs text-gray-400 mb-3">{new Date(p.createdAt).toLocaleDateString()}</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Right Eye</p>
                      {p.rightEye?.dv && <EyeRow label="DV" data={p.rightEye.dv} />}
                      {p.rightEye?.nv && <EyeRow label="NV" data={p.rightEye.nv} />}
                      {p.rightEye?.pc && <EyeRow label="PC" data={p.rightEye.pc} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Left Eye</p>
                      {p.leftEye?.dv && <EyeRow label="DV" data={p.leftEye.dv} />}
                      {p.leftEye?.nv && <EyeRow label="NV" data={p.leftEye.nv} />}
                      {p.leftEye?.pc && <EyeRow label="PC" data={p.leftEye.pc} />}
                    </div>
                  </div>
                  {p.pd && <p className="text-sm text-gray-500 mt-2">PD: {p.pd}</p>}
                  {p.notes && <p className="text-sm text-gray-500 mt-1">Notes: {p.notes}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "bills" && (
          <div className="card">
            {bills.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No bills yet.</p>
            ) : (
              <div className="space-y-3">
                {bills.map((b: any) => (
                  <div key={b._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.billNumber || "—"}</p>
                      <p className="text-xs text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">₹{(b.totalAmount || 0).toLocaleString()}</p>
                      <p className="text-xs" style={{color: (b.pendingAmount || 0) > 0 ? "#d97706" : "#059669"}}>
                        {(b.pendingAmount || 0) > 0 ? `Pending: ₹${b.pendingAmount}` : "Paid"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="card">
            {orders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No orders yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.map((o: any) => (
                  <div key={o._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{o.frame || "—"} / {o.lens || "—"}</p>
                      <p className="text-xs text-gray-500">Qty: {o.quantity || 1}</p>
                    </div>
                    <span className={`badge ${
                      o.status === "Delivered" ? "badge-green" :
                      o.status === "Cancelled" ? "badge-red" :
                      o.status === "Ready" ? "badge-blue" :
                      "badge-yellow"
                    }`}>{o.status || "Draft"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EyeRow({ label, data }: { label: string; data: any }) {
  return (
    <div className="text-xs text-gray-600 mb-1">
      <span className="font-medium text-gray-700">{label}: </span>
      SPH: {data.sph ?? "—"} CYL: {data.cyl ?? "—"} AXIS: {data.axis ?? "—"} {data.va ? `VA: ${data.va}` : ""}
    </div>
  );
}
