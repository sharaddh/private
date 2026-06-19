import React, { useEffect, useState } from "react";
import api from "../api";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2, Eye } from "lucide-react";

interface EyeData { sph?: number; cyl?: number; axis?: number; va?: string; }
interface EyeSet { dv?: EyeData; nv?: EyeData; pc?: EyeData; }

export default function Prescriptions() {
  const [list, setList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "", visitId: "", pd: "", notes: "",
    rightEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    leftEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
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

  const emptyEye = () => ({ sph: undefined, cyl: undefined, axis: undefined, va: undefined });

  function openCreate() {
    setEditing(null);
    setForm({
      customerId: "", visitId: "", pd: "", notes: "",
      rightEye: { dv: emptyEye(), nv: emptyEye(), pc: emptyEye() },
      leftEye: { dv: emptyEye(), nv: emptyEye(), pc: emptyEye() },
    });
    setShowForm(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm({
      customerId: p.customerId || "", visitId: p.visitId || "",
      pd: p.pd || "", notes: p.notes || "",
      rightEye: {
        dv: p.rightEye?.dv || emptyEye(),
        nv: p.rightEye?.nv || emptyEye(),
        pc: p.rightEye?.pc || emptyEye(),
      },
      leftEye: {
        dv: p.leftEye?.dv || emptyEye(),
        nv: p.leftEye?.nv || emptyEye(),
        pc: p.leftEye?.pc || emptyEye(),
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this prescription?")) return;
    const res = await api.del(`/api/prescriptions/${id}`);
    if (res.success) setList((prev) => prev.filter((p) => p._id !== id));
  }

  function renderEyeBlock(label: string, data: EyeData) {
    return (
      <div className="text-xs text-gray-600 mb-1 p-1.5 bg-gray-50 rounded-lg">
        <span className="font-semibold text-gray-700">{label}: </span>
        SPH: {data?.sph ?? "—"} | CYL: {data?.cyl ?? "—"} | AXIS: {data?.axis ?? "—"}
        {data?.va ? ` | VA: ${data.va}` : ""}
      </div>
    );
  }

  function renderEyeInputs(prefix: string, data: EyeData) {
    return (
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <label className="text-gray-500">SPH</label>
          <input type="number" step="0.25" className="input-field py-1.5 text-xs" value={data?.sph ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined;
              const path = prefix.split(".");
              setForm((prev: any) => {
                const upd = { ...prev };
                let obj = upd;
                for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
                obj[path[path.length - 1]] = { ...obj[path[path.length - 1]], sph: v };
                return upd;
              });
            }} />
        </div>
        <div>
          <label className="text-gray-500">CYL</label>
          <input type="number" step="0.25" className="input-field py-1.5 text-xs" value={data?.cyl ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined;
              const path = prefix.split(".");
              setForm((prev: any) => {
                const upd = { ...prev };
                let obj = upd;
                for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
                obj[path[path.length - 1]] = { ...obj[path[path.length - 1]], cyl: v };
                return upd;
              });
            }} />
        </div>
        <div>
          <label className="text-gray-500">AXIS</label>
          <input type="number" className="input-field py-1.5 text-xs" value={data?.axis ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined;
              const path = prefix.split(".");
              setForm((prev: any) => {
                const upd = { ...prev };
                let obj = upd;
                for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
                obj[path[path.length - 1]] = { ...obj[path[path.length - 1]], axis: v };
                return upd;
              });
            }} />
        </div>
        <div>
          <label className="text-gray-500">VA</label>
          <input className="input-field py-1.5 text-xs" value={data?.va ?? ""}
            onChange={(e) => {
              const v = e.target.value || undefined;
              const path = prefix.split(".");
              setForm((prev: any) => {
                const upd = { ...prev };
                let obj = upd;
                for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
                obj[path[path.length - 1]] = { ...obj[path[path.length - 1]], va: v };
                return upd;
              });
            }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Prescriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Store and compare eye prescriptions.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">New Prescription</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.length === 0 ? (
          <div className="card col-span-full">
            <p className="text-gray-400 text-sm text-center py-8">No prescriptions yet.</p>
          </div>
        ) : list.map((p: any) => (
          <div key={p._id} className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</p>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1 hover:bg-indigo-50 rounded text-indigo-600"><Edit2 size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(p._id); }} className="p-1 hover:bg-red-50 rounded text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Right Eye</p>
                {p.rightEye?.dv && renderEyeBlock("DV", p.rightEye.dv)}
                {p.rightEye?.nv && renderEyeBlock("NV", p.rightEye.nv)}
                {p.rightEye?.pc && renderEyeBlock("PC", p.rightEye.pc)}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Left Eye</p>
                {p.leftEye?.dv && renderEyeBlock("DV", p.leftEye.dv)}
                {p.leftEye?.nv && renderEyeBlock("NV", p.leftEye.nv)}
                {p.leftEye?.pc && renderEyeBlock("PC", p.leftEye.pc)}
              </div>
            </div>
            {p.pd && <p className="text-xs text-gray-500 mt-2">PD: {p.pd}</p>}
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

          <div className="grid grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Right Eye</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Distance Vision (DV)</p>
                  {renderEyeInputs("rightEye.dv", form.rightEye.dv || {})}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Near Vision (NV)</p>
                  {renderEyeInputs("rightEye.nv", form.rightEye.nv || {})}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Peripheral Curve (PC)</p>
                  {renderEyeInputs("rightEye.pc", form.rightEye.pc || {})}
                </div>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Left Eye</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Distance Vision (DV)</p>
                  {renderEyeInputs("leftEye.dv", form.leftEye.dv || {})}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Near Vision (NV)</p>
                  {renderEyeInputs("leftEye.nv", form.leftEye.nv || {})}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Peripheral Curve (PC)</p>
                  {renderEyeInputs("leftEye.pc", form.leftEye.pc || {})}
                </div>
              </div>
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
                {selected.rightEye?.dv && renderEyeBlock("DV", selected.rightEye.dv)}
                {selected.rightEye?.nv && renderEyeBlock("NV", selected.rightEye.nv)}
                {selected.rightEye?.pc && renderEyeBlock("PC", selected.rightEye.pc)}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Left Eye</h4>
                {selected.leftEye?.dv && renderEyeBlock("DV", selected.leftEye.dv)}
                {selected.leftEye?.nv && renderEyeBlock("NV", selected.leftEye.nv)}
                {selected.leftEye?.pc && renderEyeBlock("PC", selected.leftEye.pc)}
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
