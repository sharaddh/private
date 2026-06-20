import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2 } from "lucide-react";

interface EyeData { sph?: number; cyl?: number; axis?: number; va?: string; }
interface EyeSet { dv?: EyeData; nv?: EyeData; pc?: EyeData; }
interface FormState {
  customerId: string; visitId: string; pd: string; notes: string;
  rightEye: EyeSet; leftEye: EyeSet;
}

const emptyEye: EyeData = {};
const emptySet: EyeSet = { dv: {}, nv: {}, pc: {} };

export default function Prescriptions() {
  const [list, setList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<FormState>({
    customerId: "", visitId: "", pd: "", notes: "",
    rightEye: { dv: {}, nv: {}, pc: {} },
    leftEye: { dv: {}, nv: {}, pc: {} },
  });
  const [visits, setVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get("/api/prescriptions").then((d) => { if (d.success) setList(d.data || []); });
    api.get("/api/customers").then((d) => { if (d.success) setCustomers(d.data || []); });
  }, []);

  useEffect(() => {
    if (form.customerId) {
      api.get(`/api/visits?customerId=${form.customerId}`).then((d) => {
        if (d.success) setVisits(d.data || []);
      });
    }
  }, [form.customerId]);

  function updateEye(side: "rightEye" | "leftEye", type: "dv" | "nv" | "pc", field: keyof EyeData, value: string) {
    setForm((prev) => {
      const eyeSet = { ...prev[side] };
      eyeSet[type] = { ...eyeSet[type], [field]: value === "" ? undefined : field === "va" ? value : Number(value) };
      return { ...prev, [side]: eyeSet };
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ customerId: "", visitId: "", pd: "", notes: "", rightEye: { ...emptySet }, leftEye: { ...emptySet } });
    setShowForm(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm({
      customerId: p.customerId || "", visitId: p.visitId || "",
      pd: p.pd || "", notes: p.notes || "",
      rightEye: {
        dv: { ...emptyEye, ...p.rightEye?.dv },
        nv: { ...emptyEye, ...p.rightEye?.nv },
        pc: { ...emptyEye, ...p.rightEye?.pc },
      },
      leftEye: {
        dv: { ...emptyEye, ...p.leftEye?.dv },
        nv: { ...emptyEye, ...p.leftEye?.nv },
        pc: { ...emptyEye, ...p.leftEye?.pc },
      },
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        ...form,
        visitId: form.visitId || undefined,
        rightEye: { dv: cleanEye(form.rightEye.dv), nv: cleanEye(form.rightEye.nv), pc: cleanEye(form.rightEye.pc) },
        leftEye: { dv: cleanEye(form.leftEye.dv), nv: cleanEye(form.leftEye.nv), pc: cleanEye(form.leftEye.pc) },
      };
      const res = editing
        ? await api.put(`/api/prescriptions/${editing._id}`, payload)
        : await api.post("/api/prescriptions", payload);
      if (res.success) {
        const d = await api.get("/api/prescriptions");
        if (d.success) setList(d.data || []);
        setShowForm(false);
      }
    } finally { setIsLoading(false); }
  }

  function cleanEye(e: any): EyeData {
    const out: EyeData = {};
    if (e.sph !== undefined && e.sph !== "") out.sph = Number(e.sph);
    if (e.cyl !== undefined && e.cyl !== "") out.cyl = Number(e.cyl);
    if (e.axis !== undefined && e.axis !== "") out.axis = Number(e.axis);
    if (e.va) out.va = e.va;
    return out;
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this prescription?")) return;
    const res = await api.del(`/api/prescriptions/${id}`);
    if (res.success) setList((prev) => prev.filter((p) => p._id !== id));
  }

  function renderEyeBlock(label: string, data: EyeData) {
    if (!data || (!data.sph && !data.cyl && !data.axis && !data.va)) return null;
    return (
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 p-1.5 bg-gray-50 dark:bg-dark-700 rounded-lg">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label}: </span>
        {data.sph !== undefined ? `SPH: ${data.sph}` : ""}
        {data.cyl !== undefined ? ` | CYL: ${data.cyl}` : ""}
        {data.axis !== undefined ? ` | AXIS: ${data.axis}` : ""}
        {data.va ? ` | VA: ${data.va}` : ""}
      </div>
    );
  }

  function EyeInputGroup({ side, type, label }: { side: "rightEye" | "leftEye"; type: "dv" | "nv" | "pc"; label: string }) {
    const data = form[side][type] || {};
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(["sph", "cyl", "axis", "va"] as (keyof EyeData)[]).map((field) => (
            <div key={field}>
              <label className="text-[10px] text-gray-400 dark:text-gray-500 block">{field.toUpperCase()}</label>
              <input
                type={field === "va" ? "text" : "number"}
                step={field === "va" ? undefined : "0.25"}
                className="input-field py-1.5 text-xs"
                value={data[field] ?? ""}
                onChange={(e) => updateEye(side, type, field, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Prescriptions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Store and compare eye prescriptions.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">New Prescription</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.length === 0 ? (
          <div className="card col-span-full">
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No prescriptions yet.</p>
          </div>
        ) : list.map((p: any) => (
          <div key={p._id} className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</p>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-600 dark:text-indigo-400"><Edit2 size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(p._id); }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Right Eye</p>
                {renderEyeBlock("DV", p.rightEye?.dv)}
                {renderEyeBlock("NV", p.rightEye?.nv)}
                {renderEyeBlock("PC", p.rightEye?.pc)}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Left Eye</p>
                {renderEyeBlock("DV", p.leftEye?.dv)}
                {renderEyeBlock("NV", p.leftEye?.nv)}
                {renderEyeBlock("PC", p.leftEye?.pc)}
              </div>
            </div>
            {(p.pd || p.notes) && (
              <div className="mt-2 text-xs text-gray-500">
                {p.pd && <span>PD: {p.pd} </span>}
                {p.notes && <span>Notes: {p.notes}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Prescription" : "New Prescription"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer *</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Visit</label>
              <select className="input-field" value={form.visitId} onChange={(e) => setForm({ ...form, visitId: e.target.value })}>
                <option value="">Select visit (optional)</option>
                {visits.map((v) => (
                  <option key={v._id} value={v._id}>{new Date(v.visitDate).toLocaleDateString()} - {v.doctorName || "—"}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">Right Eye</h4>
              <EyeInputGroup side="rightEye" type="dv" label="Distance Vision (DV)" />
              <EyeInputGroup side="rightEye" type="nv" label="Near Vision (NV)" />
              <EyeInputGroup side="rightEye" type="pc" label="Peripheral Curve (PC)" />
            </div>
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">Left Eye</h4>
              <EyeInputGroup side="leftEye" type="dv" label="Distance Vision (DV)" />
              <EyeInputGroup side="leftEye" type="nv" label="Near Vision (NV)" />
              <EyeInputGroup side="leftEye" type="pc" label="Peripheral Curve (PC)" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">PD (Pupillary Distance)</label>
              <input className="input-field" value={form.pd} onChange={(e) => setForm({ ...form, pd: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Save Prescription"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Prescription Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Date: {new Date(selected.createdAt).toLocaleDateString()}</p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Right Eye</h4>
                {renderEyeBlock("DV", selected.rightEye?.dv)}
                {renderEyeBlock("NV", selected.rightEye?.nv)}
                {renderEyeBlock("PC", selected.rightEye?.pc)}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Left Eye</h4>
                {renderEyeBlock("DV", selected.leftEye?.dv)}
                {renderEyeBlock("NV", selected.leftEye?.nv)}
                {renderEyeBlock("PC", selected.leftEye?.pc)}
              </div>
            </div>
            {selected.pd && <p className="text-sm text-gray-600">PD: {selected.pd}</p>}
            {selected.notes && <p className="text-sm text-gray-600">Notes: {selected.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
