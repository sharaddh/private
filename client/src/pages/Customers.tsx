import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../api';
import { invalidateCache } from '../hooks/useCache';
import Modal from '../components/Modal';
import PageSkeleton from '../components/PageSkeleton';
import ShineCard from '../components/ShineCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslate } from '../context/TranslateContext';
import { customerService } from '../services';
import {
  Edit2,
  Trash2,
  UserPlus,
  Search,
  Phone,
  Users,
  Plus,
  X,
  MapPin,
  Tag,
  Activity,
  IndianRupee,
  Eye,
  Calendar,
  MapPinned,
} from 'lucide-react';
import type { Customer, CustomerFormData } from '../types';

export default function Customers(): React.JSX.Element {
  const toast = useToast();
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormData>({
    name: '',
    email: '',
    mobile: '',
    alternateMobile: '',
    address: '',
    city: '',
    age: '',
    gender: '',
    tags: '',
    isAyushman: false,
    abhaNumber: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();
  const { isStaff, user } = useAuth();
  const { uiT } = useTranslate();
  const [recalculating, setRecalculating] = useState<boolean>(false);

  const fetchCustomers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await customerService.list<Customer>({ limit: 1000 });
      const raw = res.data as unknown;
      let customers: Customer[] = [];
      if (Array.isArray(raw)) {
        customers = raw;
      } else if (
        raw &&
        typeof raw === 'object' &&
        Array.isArray((raw as Record<string, unknown>).data)
      ) {
        customers = (raw as { data: Customer[] }).data;
      }
      setList(customers);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const refetch = useCallback(
    (invalidate?: boolean): void => {
      if (invalidate) invalidateCache('/api/customers?limit=1000');
      fetchCustomers();
    },
    [fetchCustomers]
  );

  const filteredList = useMemo((): Customer[] => {
    const q = searchQuery.trim();
    if (!q) return list;
    const lower = q.toLowerCase();
    return list.filter(
      (c: Customer) =>
        c.name?.toLowerCase().includes(lower) ||
        c.mobile?.includes(q) ||
        c.customerId?.toLowerCase().includes(lower) ||
        c.email?.toLowerCase().includes(lower)
    );
  }, [searchQuery, list]);

  function openCreate(): void {
    setEditing(null);
    setForm({
      name: '',
      email: '',
      mobile: '',
      alternateMobile: '',
      address: '',
      city: '',
      age: '',
      gender: '',
      tags: '',
    isAyushman: false,
    abhaNumber: '',
    });
    setShowForm(true);
    setError('');
  }

  function openEdit(c: Customer): void {
    setEditing(c);
    setForm({
      name: c.name || '',
      email: c.email || '',
      mobile: c.mobile || '',
      alternateMobile: c.alternateMobile || '',
      address: c.address || '',
      city: c.city || '',
      age: c.age?.toString() || '',
      gender: c.gender || '',
      tags: c.tags?.join(', ') || '',
        isAyushman: c.isAyushman || false,
        abhaNumber: c.abhaNumber || '',
    });
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        ...form,
        age: form.age ? Number(form.age) : undefined,
        tags: form.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
        email: form.email || undefined,
        mobile: form.mobile || undefined,
      };
      const res = editing
        ? await customerService.update<Customer>(editing._id, payload)
        : await customerService.create<Customer>(payload);
      if (res.success) {
        invalidateCache('/api/customers?limit=1000');
        setShowForm(false);
        if (!editing && res.data?._id) navigate(`/customers/${res.data._id}`);
      } else setError(res.message || uiT('Operation failed', 'αñæαñ¬αñ░αÑçαñ╢αñ¿ αñ╡αñ┐αñ½αñ▓'));
    } catch {
      setError(uiT('An error occurred', 'αñÅαñò αññαÑìαñ░αÑüαñƒαñ┐ αñ╣αÑüαñê'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (
      !confirm(
        uiT(
          'Are you sure you want to delete this customer?',
          'αñòαÑìαñ»αñ╛ αñåαñ¬ αñ╡αñ╛αñòαñê αñçαñ╕ αñùαÑìαñ░αñ╛αñ╣αñò αñòαÑï αñ╣αñƒαñ╛αñ¿αñ╛ αñÜαñ╛αñ╣αññαÑç αñ╣αÑêαñé?'
        )
      )
    )
      return;
    const res = await customerService.remove<Customer>(id);
    if (res.success) setList((prev: Customer[]) => prev.filter((c: Customer) => c._id !== id));
  }

  if (loading) return <PageSkeleton page="customers" />;

  return (
    <div className="min-h-screen bg-th-base text-th-text p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-th-text tracking-tight">
            {uiT('Customers', 'αñùαÑìαñ░αñ╛αñ╣αñò')}
          </h1>
          <p className="text-sm text-th-secondary mt-0.5">
            {uiT(
              'Search, view, and manage customer profiles.',
              'αñùαÑìαñ░αñ╛αñ╣αñò αñ¬αÑìαñ░αÑïαñ½αñ╝αñ╛αñçαñ▓ αñûαÑïαñ£αÑçαñé, αñªαÑçαñûαÑçαñé αñöαñ░ αñ¬αÑìαñ░αñ¼αñéαñºαñ┐αññ αñòαñ░αÑçαñéαÑñ'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isStaff && (
            <button
              onClick={async (): Promise<void> => {
                setRecalculating(true);
                const res = await api.post('/api/recalculate/customer-totals', {});
                if (res.success) {
                  refetch(true);
                  const d = res.data as Record<string, unknown> | undefined;
                  toast.success(
                    `${uiT('Fixed', 'αñáαÑÇαñò αñòαñ┐αñ»αñ╛')} ${(d as { updated?: number })?.updated || 0} ${uiT('customer records', 'αñùαÑìαñ░αñ╛αñ╣αñò αñ░αñ┐αñòαÑëαñ░αÑìαñí')}`
                  );
                } else {
                  toast.error(
                    `${uiT('Recalculation failed', 'αñ¬αÑüαñ¿αñ░αÑìαñùαñúαñ¿αñ╛ αñ╡αñ┐αñ½αñ▓')}: ` +
                      (res.message || uiT('Unknown error', 'αñàαñ£αÑìαñ₧αñ╛αññ αññαÑìαñ░αÑüαñƒαñ┐'))
                  );
                }
                setRecalculating(false);
              }}
              disabled={recalculating}
              className="flex items-center gap-1.5 text-[15px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors disabled:opacity-50"
            >
              <Activity size={14} />
              {recalculating
                ? uiT('Fixing...', 'αñ╕αÑüαñºαñ╛αñ░ αñ╣αÑï αñ░αñ╣αñ╛ αñ╣αÑê...')
                : uiT('Fix Data', 'αñíαÑçαñƒαñ╛ αñáαÑÇαñò αñòαñ░αÑçαñé')}
            </button>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 text-[15px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform"
          >
            <Plus size={16} />
            <span>{uiT('Add Customer', 'αñùαÑìαñ░αñ╛αñ╣αñò αñ£αÑïαñíαñ╝αÑçαñé')}</span>
          </button>
        </div>
      </div>

      <div className="relative mt-6" role="search">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-th-secondary pointer-events-none"
        />
        <input
          type="text"
          placeholder={uiT(
            'Search by name, mobile, email, or ID...',
            'αñ¿αñ╛αñ«, αñ«αÑïαñ¼αñ╛αñçαñ▓, αñêαñ«αÑçαñ▓ αñ»αñ╛ αñåαñêαñíαÑÇ αñ╕αÑç αñûαÑïαñ£αÑçαñé...'
          )}
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          aria-label={uiT('Search customers', 'αñùαÑìαñ░αñ╛αñ╣αñò αñûαÑïαñ£αÑçαñé')}
          className="w-full bg-th-elevated text-th-text placeholder-[#a7a7a7] pl-11 pr-10 py-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1ed760] transition-shadow"
        />
        {searchQuery.trim() && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-th-card text-th-secondary hover:text-th-text transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filteredList.length === 0 ? (
        <div className="bg-th-surface rounded-lg text-center py-16 mt-6">
          <div className="w-16 h-16 bg-th-hover rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-[#535353]" />
          </div>
          <h3 className="text-lg font-bold text-th-text mb-1">
            {searchQuery
              ? uiT('No customers found', 'αñòαÑïαñê αñùαÑìαñ░αñ╛αñ╣αñò αñ¿αñ╣αÑÇαñé αñ«αñ┐αñ▓αñ╛')
              : uiT('No customers yet', 'αñàαñ¡αÑÇ αññαñò αñòαÑïαñê αñùαÑìαñ░αñ╛αñ╣αñò αñ¿αñ╣αÑÇαñé')}
          </h3>
          <p className="text-sm text-th-secondary mb-5">
            {searchQuery
              ? `${uiT('No results matching', 'αñòαÑïαñê αñ¬αñ░αñ┐αñúαñ╛αñ« αñ«αÑçαñ▓ αñ¿αñ╣αÑÇαñé αñûαñ╛ αñ░αñ╣αñ╛')} "${searchQuery}"`
              : uiT('Start by adding your first customer.', 'αñàαñ¬αñ¿αñ╛ αñ¬αñ╣αñ▓αñ╛ αñùαÑìαñ░αñ╛αñ╣αñò αñ£αÑïαñíαñ╝αñòαñ░ αñ╢αÑüαñ░αÑé αñòαñ░αÑçαñéαÑñ')}
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 text-[15px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-colors"
          >
            <UserPlus size={16} /> {uiT('Add Customer', 'αñùαÑìαñ░αñ╛αñ╣αñò αñ£αÑïαñíαñ╝αÑçαñé')}
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-3">
            {filteredList.length} {uiT('customer(s)', 'αñùαÑìαñ░αñ╛αñ╣αñò')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredList.map((c: Customer) => (
              <ShineCard
                key={c._id}
                onClick={() => navigate(`/customers/${c._id}`)}
                className="group relative bg-th-surface rounded-xl cursor-pointer hover:shadow-lg hover:shadow-black/10 active:scale-[0.98] overflow-hidden border border-th-border hover:border-[#1ed760]/30"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${
                          (c.pendingAmount || 0) > 0
                            ? 'bg-[#e8a427] text-black'
                            : 'bg-[#1ed760] text-black'
                        }`}
                      >
                        {c.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      {(c.pendingAmount || 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-th-surface" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm text-th-text truncate">{c.name}</h3>
                        {c.age && (
                          <span className="text-[14px] text-th-secondary shrink-0">
                            {c.age}y{c.gender ? `, ${c.gender}` : ''}
                          </span>
                        )}
                      </div>
                      {c.customerId && (
                        <span className="text-[14px] text-th-secondary font-mono bg-th-elevated px-1.5 py-0.5 rounded-lg inline-block mt-0.5">
                          #{c.customerId.replace('CUST-', '').slice(-6)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        className="p-1 hover:bg-th-elevated rounded text-th-secondary hover:text-[#1ed760] transition-colors"
                        title={uiT('Edit', 'αñ╕αñéαñ¬αñ╛αñªαñ┐αññ αñòαñ░αÑçαñé')}
                      >
                        <Edit2 size={12} />
                      </button>
                      {!isStaff && (
                        <button
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleDelete(c._id);
                          }}
                          className="p-1 hover:bg-red-500/10 rounded text-th-secondary hover:text-red-400 transition-colors"
                          title={uiT('Delete', 'αñ╣αñƒαñ╛αñÅαñé')}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2.5 text-xs text-th-secondary">
                    {c.mobile && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} /> {c.mobile.replace(/^0+/, '')}
                      </span>
                    )}
                    {c.city && (
                      <span className="flex items-center gap-1">
                        <MapPinned size={10} /> {c.city}
                      </span>
                    )}
                  </div>

                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.tags.slice(0, 2).map((t: string) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 bg-[#1ed760]/10 text-[#1ed760] rounded text-[13px] font-medium"
                        >
                          {t}
                        </span>
                      ))}
                      {c.tags.length > 2 && (
                        <span className="text-[13px] text-th-secondary px-0.5">
                          +{c.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-th-elevated/50 border-t border-th-border">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[15px] font-bold text-th-secondary">
                      <Calendar size={10} /> {c.totalVisits || 0}
                    </span>
                    <span className="text-[15px] font-bold text-[#1ed760]">
                      Γé╣{(c.totalSpent || 0).toLocaleString()}
                    </span>
                  </div>
                  {(c.pendingAmount || 0) > 0 ? (
                    <span className="text-[14px] font-semibold text-[#e8a427]">
                      Γé╣{(c.pendingAmount || 0).toLocaleString()} {uiT('due', 'αñ¼αñòαñ╛αñ»αñ╛')}
                    </span>
                  ) : (c.totalVisits || 0) > 0 ? (
                    <span className="text-[14px] text-[#1ed760] font-medium">
                      {uiT('Clear', 'αñÜαÑüαñòαññαñ╛')}
                    </span>
                  ) : null}
                </div>
              </ShineCard>
            ))}
          </div>
        </div>
      )}

      {showForm &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowForm(false)}
          >
            <div
              className="bg-th-surface rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
              <h3 className="text-base font-bold text-th-text">
                {editing ? uiT('Edit', 'αñ╕αñéαñ¬αñ╛αñªαñ┐αññ αñòαñ░αÑçαñé') : uiT('Add Customer', 'αñùαÑìαñ░αñ╛αñ╣αñò αñ£αÑïαñíαñ╝αÑçαñé')}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 hover:bg-th-elevated rounded-full text-th-secondary hover:text-th-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none p-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2.5 rounded-lg text-sm mb-3">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <UserPlus size={14} className="text-[#1ed760]" />{' '}
                    {uiT('Personal Info', 'αñ╡αÑìαñ»αñòαÑìαññαñ┐αñùαññ αñ£αñ╛αñ¿αñòαñ╛αñ░αÑÇ')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('Name', 'αñ¿αñ╛αñ«')} *
                      </label>
                      <input
                        className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                        value={form.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        required
                        aria-label={uiT('Customer name', 'αñùαÑìαñ░αñ╛αñ╣αñò αñòαñ╛ αñ¿αñ╛αñ«')}
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('Age', 'αñåαñ»αÑü')}
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={form.age}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm({ ...form, age: e.target.value })
                        }
                        aria-label={uiT('Customer age', 'αñùαÑìαñ░αñ╛αñ╣αñò αñòαÑÇ αñåαñ»αÑü')}
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('Gender', 'αñ▓αñ┐αñéαñù')}
                      </label>
                      <select
                        className="w-full bg-th-hover text-th-text px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                        value={form.gender}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setForm({ ...form, gender: e.target.value })
                        }
                        aria-label={uiT('Customer gender', 'αñùαÑìαñ░αñ╛αñ╣αñò αñòαñ╛ αñ▓αñ┐αñéαñù')}
                      >
                        <option value="">{uiT('Select', 'αñÜαÑüαñ¿αÑçαñé')}</option>
                        <option value="Male">{uiT('Male', 'αñ¬αÑüαñ░αÑüαñ╖')}</option>
                        <option value="Female">{uiT('Female', 'αñ«αñ╣αñ┐αñ▓αñ╛')}</option>
                        <option value="Other">{uiT('Other', 'αñàαñ¿αÑìαñ»')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <Phone size={14} className="text-[#1ed760]" /> {uiT('Contact', 'αñ╕αñéαñ¬αñ░αÑìαñò')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('Mobile', 'αñ«αÑïαñ¼αñ╛αñçαñ▓')} *
                      </label>
                      <input
                        className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                        value={form.mobile}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm({ ...form, mobile: e.target.value })
                        }
                        aria-label={uiT('Mobile number', 'αñ«αÑïαñ¼αñ╛αñçαñ▓ αñ¿αñéαñ¼αñ░')}
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('Alt Mobile', 'αñ╡αÑêαñòαñ▓αÑìαñ¬αñ┐αñò αñ«αÑïαñ¼αñ╛αñçαñ▓')}
                      </label>
                      <input
                        className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                        value={form.alternateMobile}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm({ ...form, alternateMobile: e.target.value })
                        }
                        aria-label={uiT('Alternate mobile number', 'αñ╡αÑêαñòαñ▓αÑìαñ¬αñ┐αñò αñ«αÑïαñ¼αñ╛αñçαñ▓ αñ¿αñéαñ¼αñ░')}
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('Email', 'αñêαñ«αÑçαñ▓')}
                      </label>
                      <input
                        type="email"
                        className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                        value={form.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        aria-label={uiT('Email address', 'αñêαñ«αÑçαñ▓ αñ¬αññαñ╛')}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <MapPin size={14} className="text-[#1ed760]" /> {uiT('Address', 'αñ¬αññαñ╛')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('Address', 'αñ¬αññαñ╛')}
                      </label>
                      <textarea
                        className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                        rows={2}
                        value={form.address}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setForm({ ...form, address: e.target.value })
                        }
                        aria-label={uiT('Address', 'αñ¬αññαñ╛')}
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">
                        {uiT('City', 'αñ╢αñ╣αñ░')}
                      </label>
                      <input
                        className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                        value={form.city}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm({ ...form, city: e.target.value })
                        }
                        aria-label={uiT('City', 'αñ╢αñ╣αñ░')}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <Tag size={14} className="text-[#1ed760]" /> {uiT('Tags', 'αñƒαÑêαñù')}
                  </h3>
                  <input
                    className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow"
                    placeholder="tag1, tag2"
                    value={form.tags}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, tags: e.target.value })
                    }
                    aria-label={uiT('Tags', 'αñƒαÑêαñù')}
                  />
                </div>

                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <Tag size={14} className="text-[#1ed760]" /> Ayushman Bharat Scheme
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="isAyushman" checked={form.isAyushman} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, isAyushman: e.target.checked })} className="w-4 h-4 rounded border-th-border text-[#1ed760] focus:ring-[#1ed760]" />
                      <label htmlFor="isAyushman" className="text-sm text-th-text font-medium">Ayushman Beneficiary</label>
                    </div>
                    <div>
                      <label className="block text-[15px] font-bold uppercase tracking-wider text-th-secondary mb-1">ABHA Number</label>
                      <input className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.abhaNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, abhaNumber: e.target.value })} placeholder="ABHA number" aria-label="ABHA number" />
                    </div>
                  </div>
                </div>                <div className="flex justify-end gap-2 pt-3 border-t border-th-border">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-[15px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors"
                  >
                    {uiT('Cancel', 'αñ░αñªαÑìαñª αñòαñ░αÑçαñé')}
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="text-[15px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {isLoading
                      ? uiT('Saving...', 'αñ╕αñ╣αÑçαñ£αñ╛ αñ£αñ╛ αñ░αñ╣αñ╛ αñ╣αÑê...')
                      : editing
                        ? uiT('Edit', 'αñ╕αñéαñ¬αñ╛αñªαñ┐αññ αñòαñ░αÑçαñé')
                        : uiT('Add Customer', 'αñùαÑìαñ░αñ╛αñ╣αñò αñ£αÑïαñíαñ╝αÑçαñé')}
                  </button>
                </div>
              </form>
            </div>
            </div>
          </div>,
          document.body
        )}

      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={uiT('Customer Details', 'αñùαÑìαñ░αñ╛αñ╣αñò αñ╡αñ┐αñ╡αñ░αñú')}
        size="lg"
      >
        {detailCustomer && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-th-elevated rounded-lg">
              <div className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center text-black font-bold text-xl">
                {detailCustomer.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-th-text">{detailCustomer.name}</h2>
                <p className="text-sm text-th-secondary">
                  {detailCustomer.customerId && `ID: ${detailCustomer.customerId}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-th-elevated rounded-lg p-3 text-center">
                <Activity size={16} className="text-[#1ed760] mx-auto mb-1" />
                <p className="text-lg font-bold text-th-text">{detailCustomer.totalVisits || 0}</p>
                <p className="text-[14px] text-th-secondary font-bold uppercase tracking-wider">
                  {uiT('Visits', 'αñ╡αñ┐αñ£αñ╝αñ┐αñƒ')}
                </p>
              </div>
              <div className="bg-th-elevated rounded-lg p-3 text-center">
                <IndianRupee size={16} className="text-[#1ed760] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#1ed760]">
                  Γé╣{(detailCustomer.totalSpent || 0).toLocaleString()}
                </p>
                <p className="text-[14px] text-th-secondary font-bold uppercase tracking-wider">
                  {uiT('Spent', 'αñûαñ░αÑìαñÜ')}
                </p>
              </div>
              <div className="bg-th-elevated rounded-lg p-3 text-center">
                <IndianRupee size={16} className="text-[#e8a427] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#e8a427]">
                  Γé╣{(detailCustomer.pendingAmount || 0).toLocaleString()}
                </p>
                <p className="text-[14px] text-th-secondary font-bold uppercase tracking-wider">
                  {uiT('Pending', 'αñ¼αñ╛αñòαÑÇ')}
                </p>
              </div>
            </div>

            <div className="bg-th-surface rounded-lg p-4">
              <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                <UserPlus size={14} className="text-[#1ed760]" />{' '}
                {uiT('Personal Info', 'αñ╡αÑìαñ»αñòαÑìαññαñ┐αñùαññ αñ£αñ╛αñ¿αñòαñ╛αñ░αÑÇ')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[15px] text-th-secondary font-bold uppercase tracking-wider">
                    {uiT('Age', 'αñåαñ»αÑü')}
                  </p>
                  <p className="text-th-text">{detailCustomer.age || 'ΓÇö'}</p>
                </div>
                <div>
                  <p className="text-[15px] text-th-secondary font-bold uppercase tracking-wider">
                    {uiT('Gender', 'αñ▓αñ┐αñéαñù')}
                  </p>
                  <p className="text-th-text">{detailCustomer.gender || 'ΓÇö'}</p>
                </div>
                <div>
                  <p className="text-[15px] text-th-secondary font-bold uppercase tracking-wider">
                    {uiT('Member Since', 'αñ╕αñªαñ╕αÑìαñ» αññαñ¼ αñ╕αÑç')}
                  </p>
                  <p className="text-th-text">
                    {detailCustomer.createdAt
                      ? new Date(detailCustomer.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'ΓÇö'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-th-surface rounded-lg p-4">
              <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                <Phone size={14} className="text-[#1ed760]" /> {uiT('Contact', 'αñ╕αñéαñ¬αñ░αÑìαñò')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[15px] text-th-secondary font-bold uppercase tracking-wider">
                    {uiT('Mobile', 'αñ«αÑïαñ¼αñ╛αñçαñ▓')}
                  </p>
                  <p className="text-th-text">{detailCustomer.mobile || 'ΓÇö'}</p>
                </div>
                <div>
                  <p className="text-[15px] text-th-secondary font-bold uppercase tracking-wider">
                    {uiT('Alt Mobile', 'αñ╡αÑêαñòαñ▓αÑìαñ¬αñ┐αñò αñ«αÑïαñ¼αñ╛αñçαñ▓')}
                  </p>
                  <p className="text-th-text">{detailCustomer.alternateMobile || 'ΓÇö'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[15px] text-th-secondary font-bold uppercase tracking-wider">
                    {uiT('Email', 'αñêαñ«αÑçαñ▓')}
                  </p>
                  <p className="text-th-text">{detailCustomer.email || 'ΓÇö'}</p>
                </div>
              </div>
            </div>

            <div className="bg-th-surface rounded-lg p-4">
              <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-[#1ed760]" /> {uiT('Address', 'αñ¬αññαñ╛')}
              </h3>
              <p className="text-sm text-th-secondary">
                {detailCustomer.address
                  ? `${detailCustomer.address}${detailCustomer.city ? `, ${detailCustomer.city}` : ''}`
                  : 'ΓÇö'}
              </p>
            </div>

            {detailCustomer.tags && detailCustomer.tags.length > 0 && (
              <div className="bg-th-surface rounded-lg p-4">
                <h3 className="text-[15px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                  <Tag size={14} className="text-[#1ed760]" /> {uiT('Tags', 'αñƒαÑêαñù')}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {detailCustomer.tags.map((t: string, i: number) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-[15px] font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-th-border">
              <button
                onClick={() => setShowDetail(false)}
                className="text-[15px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors"
              >
                {uiT('Close', 'αñ¼αñéαñª αñòαñ░αÑçαñé')}
              </button>
              <button
                onClick={() => {
                  setShowDetail(false);
                  openEdit(detailCustomer);
                }}
                className="flex items-center gap-2 text-[15px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform"
              >
                <Edit2 size={14} /> {uiT('Edit', 'αñ╕αñéαñ¬αñ╛αñªαñ┐αññ αñòαñ░αÑçαñé')}
              </button>
              <button
                onClick={() => {
                  setShowDetail(false);
                  navigate(`/customers/${detailCustomer._id}`);
                }}
                className="flex items-center gap-2 text-[15px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform"
              >
                <Eye size={14} /> {uiT('View Full Profile', 'αñ¬αÑéαñ░αÑÇ αñ¬αÑìαñ░αÑïαñ½αñ╝αñ╛αñçαñ▓ αñªαÑçαñûαÑçαñé')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
