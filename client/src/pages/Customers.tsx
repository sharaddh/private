import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
  Receipt,
  Glasses,
} from 'lucide-react';
import type { Customer, CustomerFormData, Prescription, Order, EyeData } from '../types';

interface CardDetail {
  loading: boolean;
  prescriptions: Prescription[];
  orders: Order[];
}

function fmtDate(d?: string | Date): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function signedNum(v?: number | string | null): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
}

function rxSummary(p?: Prescription | null): string {
  if (!p) return '';
  const r = p.rightEye?.dv as Partial<EyeData> | undefined;
  const l = p.leftEye?.dv as Partial<EyeData> | undefined;
  const rx = (e?: Partial<EyeData>): string => {
    if (e?.sph == null) return '—';
    const cyl = e.cyl ? ` / ${signedNum(e.cyl)}` : '';
    return `${signedNum(e.sph)}${cyl}`;
  };
  const bits = [`R ${rx(r)}`, `L ${rx(l)}`];
  if (p.pd) bits.push(`PD ${p.pd}`);
  return bits.join('   ');
}

const ORDER_COLORS: Record<string, string> = {
  Ready: 'bg-[#1ed760]/15 text-[#1ed760]',
  'In Lab': 'bg-[#3b82f6]/15 text-[#3b82f6]',
  Ordered: 'bg-[#a78bfa]/15 text-[#a78bfa]',
  Delivered: 'bg-th-elevated text-th-secondary',
  Pending: 'bg-[#e8a427]/15 text-[#e8a427]',
  Cancelled: 'bg-red-500/10 text-red-400',
};

export default function Customers(): React.JSX.Element {
  const toast = useToast();
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ayushmanFilter, setAyushmanFilter] = useState<'all' | 'abha'>('all');
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
  const [detailMap, setDetailMap] = useState<Record<string, CardDetail>>({});
  const [hover, setHover] = useState<null | { c: Customer; left: number; top: number; width: number }>(
    null
  );
  const hoverCloseTimer = useRef<number | null>(null);
  const detailFetching = useRef<Set<string>>(new Set());

  async function loadCardDetail(id: string) {
    if (detailFetching.current.has(id)) return;
    if (detailMap[id]) return;
    detailFetching.current.add(id);
    setDetailMap((m) => ({ ...m, [id]: { loading: true, prescriptions: [], orders: [] } }));
    try {
      const [rxRes, ordRes] = await Promise.all([
        api.get<Prescription[]>('/api/prescriptions?customerId=' + id),
        api.get<Order[]>('/api/orders?customerId=' + id),
      ]);
      const listOf = (res: unknown): unknown[] => {
        const data = (res as { data?: unknown })?.data;
        if (Array.isArray(data)) return data as unknown[];
        if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).data))
          return ((data as Record<string, unknown>).data as unknown[]) || [];
        return [];
      };
      const prescriptions = (listOf(rxRes) as Prescription[]).filter((p) => p && p.rightEye);
      const orders = listOf(ordRes) as Order[];
      setDetailMap((m) => ({ ...m, [id]: { loading: false, prescriptions, orders } }));
    } catch {
      setDetailMap((m) => ({ ...m, [id]: { loading: false, prescriptions: [], orders: [] } }));
    } finally {
      detailFetching.current.delete(id);
    }
  }

  function openHover(e: React.MouseEvent<Element>, c: Customer) {
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHover({ c, left: rect.left, top: rect.top, width: rect.width });
    loadCardDetail(c._id);
  }

  function closeHoverSoon() {
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = window.setTimeout(() => setHover(null), 180);
  }

  function cancelCloseHover() {
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }

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
    const lower = q.toLowerCase();
    return list.filter((c: Customer) => {
      if (ayushmanFilter === 'abha' && !c.isAyushman) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(lower) ||
        c.mobile?.includes(q) ||
        c.customerId?.toLowerCase().includes(lower) ||
        c.email?.toLowerCase().includes(lower)
      );
    });
  }, [searchQuery, list, ayushmanFilter]);

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

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => setAyushmanFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${
            ayushmanFilter === 'all'
              ? 'bg-[#1ed760] text-black'
              : 'bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text'
          }`}
        >
          {uiT('All', 'सभी')}
        </button>
        <button
          onClick={() => setAyushmanFilter('abha')}
          className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${
            ayushmanFilter === 'abha'
              ? 'bg-[#1ed760] text-black'
              : 'bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text'
          }`}
        >
          ABHA {list.filter((c: Customer) => c.isAyushman).length}
        </button>
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
            {filteredList.map((c: Customer) => {
              const d = detailMap[c._id];
              const lastRx = d?.prescriptions?.[0] as
                | (Prescription & { _id?: string; createdAt?: string })
                | undefined;
              const rxLine = lastRx
                ? `${rxSummary(lastRx)}   ·   ${fmtDate(lastRx.createdAt)}`
                : d?.loading
                  ? '…'
                  : uiT('No prescription yet', 'अभी तक कोई नुस्खा नहीं');
              return (
                <div
                  key={c._id}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => openHover(e, c)}
                  onMouseLeave={closeHoverSoon}
                >
                  <ShineCard
                    onClick={() => navigate(`/customers/${c._id}`)}
                    className="group relative bg-th-surface rounded-xl cursor-pointer hover:shadow-lg hover:shadow-black/10 active:scale-[0.98] overflow-hidden border border-th-border hover:border-[#1ed760]/30"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base ${
                              (c.pendingAmount || 0) > 0
                                ? 'bg-[#e8a427] text-black'
                                : 'bg-[#1ed760] text-black'
                            }`}
                          >
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          {(c.pendingAmount || 0) > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-th-surface" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-th-text truncate">{c.name}</h3>
                            {c.isAyushman && (
                              <span className="px-1.5 py-0.5 bg-[#1ed760]/15 text-[#1ed760] rounded-md text-[11px] font-bold shrink-0">
                                ABHA
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-th-secondary">
                            {c.mobile ? (
                              <span className="flex items-center gap-1">
                                <Phone size={11} /> {c.mobile.replace(/^0+/, '')}
                              </span>
                            ) : null}
                            {c.age ? (
                              <span>
                                {c.age}y{c.gender ? `, ${c.gender[0]}` : ''}
                              </span>
                            ) : c.gender ? (
                              <span>{c.gender}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openHover(e, c);
                            }}
                            className="p-1.5 hover:bg-th-elevated rounded-md text-th-secondary hover:text-[#1ed760] transition-colors"
                            title={uiT('Quick view', 'त्वरित देखें')}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              navigate(`/pickup?customerId=${c._id}`);
                            }}
                            className="p-1.5 hover:bg-th-elevated rounded-md text-th-secondary hover:text-[#1ed760] transition-colors"
                            title={uiT('Bill', 'बिल बनाएं')}
                          >
                            <Receipt size={16} />
                          </button>
                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openEdit(c);
                            }}
                            className="p-1.5 hover:bg-th-elevated rounded-md text-th-secondary hover:text-[#1ed760] transition-colors"
                            title={uiT('Edit', 'संपादित करें')}
                          >
                            <Edit2 size={16} />
                          </button>
                          {!isStaff && (
                            <button
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                handleDelete(c._id);
                              }}
                              className="p-1.5 hover:bg-red-500/10 rounded-md text-th-secondary hover:text-red-400 transition-colors"
                              title={uiT('Delete', 'हटाएं')}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-th-border/60 text-[13px]">
                        <Glasses size={14} className="text-[#1ed760]/70 shrink-0" />
                        <span className="font-medium text-th-secondary shrink-0">
                          {uiT('Last Rx', 'अंतिम नुस्खा')}
                        </span>
                        <span
                          className={`min-w-0 flex-1 text-right font-mono truncate ${
                            lastRx ? 'text-th-text' : 'text-th-secondary'
                          }`}
                          title={rxLine}
                        >
                          {rxLine}
                        </span>
                      </div>

                      {c.isAyushman && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                          <span className="text-[13px] text-th-secondary">
                            {c.ayushmanUsedYear === new Date().getFullYear()
                              ? `${uiT('Next specs', 'अगली सुविधा')}: 1 ${uiT(
                                  'Jan',
                                  'जनवरी'
                                )} ${new Date().getFullYear() + 1}`
                              : uiT('Eligible now', 'अभी पात्र')}
                          </span>
                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              navigate(`/pickup?customerId=${c._id}`);
                            }}
                            className="ml-auto px-2 py-0.5 bg-[#1ed760] text-black rounded-md text-[13px] font-bold hover:bg-[#1ed760]/80 transition-colors"
                            title={uiT('Bill with Ayushman', 'आयुष्मान से बिल बनाएं')}
                          >
                            {uiT('Bill', 'बिल बनाएं')}
                          </button>
                        </div>
                      )}

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
                          <Calendar size={15} /> {c.totalVisits || 0}
                        </span>
                        <span className="flex items-center gap-1 text-[15px] font-bold text-[#1ed760]">
                          <IndianRupee size={14} /> ₹{(c.totalSpent || 0).toLocaleString()}
                        </span>
                      </div>
                      {(c.pendingAmount || 0) > 0 ? (
                        <span className="text-[14px] font-semibold text-[#e8a427]">
                          ₹{(c.pendingAmount || 0).toLocaleString()} {uiT('due', 'बकाया')}
                        </span>
                      ) : (c.totalVisits || 0) > 0 ? (
                        <span className="text-[14px] text-[#1ed760] font-medium">
                          {uiT('Clear', 'चुकता')}
                        </span>
                      ) : null}
                    </div>
                  </ShineCard>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hover &&
        createPortal(
          (() => {
            const d = detailMap[hover.c._id];
            const orders = d?.orders || [];
            const rxItems = (d?.prescriptions || []) as Array<
              Prescription & { _id?: string; createdAt?: string }
            >;
            const counts: Record<string, number> = {};
            orders.forEach((o) => {
              counts[o.status] = (counts[o.status] || 0) + 1;
            });
            const totalBilled = orders.reduce(
              (s, o) => s + (Number(o.billInfo?.totalAmount) || 0),
              0
            );
            const orderPending = orders.reduce(
              (s, o) => s + (Number(o.billInfo?.pendingAmount) || 0),
              0
            );
            const popW = 340;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let left = hover.left + hover.width + 10;
            if (left + popW > vw - 8) left = Math.max(8, hover.left - popW - 10);
            const top = Math.max(8, Math.min(hover.top, vh - 420));
            return (
              <div
                className="fixed z-[90] w-[340px] max-w-[90vw] rounded-xl border border-th-border bg-th-surface shadow-2xl shadow-black/40 overflow-hidden animate-fade-in"
                style={{ left, top, maxHeight: '78vh' }}
                onMouseEnter={cancelCloseHover}
                onMouseLeave={closeHoverSoon}
              >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-th-border bg-th-elevated/40">
                  <div className="w-10 h-10 rounded-full bg-[#1ed760] text-black flex items-center justify-center font-bold shrink-0">
                    {hover.c.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-th-text truncate">{hover.c.name}</p>
                      {hover.c.isAyushman && (
                        <span className="px-1.5 py-0.5 bg-[#1ed760]/15 text-[#1ed760] rounded-md text-[10px] font-bold shrink-0">
                          ABHA
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-th-secondary truncate">
                      {hover.c.mobile
                        ? hover.c.mobile.replace(/^0+/, '')
                        : uiT('No mobile', 'मोबाइल नहीं')}
                      {hover.c.age ? ` · ${hover.c.age}y` : ''}
                      {hover.c.city ? ` · ${hover.c.city}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => setHover(null)}
                    className="p-1 rounded-md text-th-secondary hover:text-th-text hover:bg-th-elevated shrink-0"
                    aria-label={uiT('Close', 'बंद करें')}
                  >
                    <X size={15} />
                  </button>
                </div>

                <div
                  className="px-4 py-3 overflow-y-auto scrollbar-none"
                  style={{ maxHeight: 'calc(78vh - 128px)' }}
                >
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-th-elevated/40 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-sm font-bold text-th-text">{hover.c.totalVisits || 0}</p>
                      <p className="text-[10px] uppercase tracking-wide text-th-secondary">
                        {uiT('Visits', 'विज़िट')}
                      </p>
                    </div>
                    <div className="bg-th-elevated/40 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-sm font-bold text-[#1ed760]">
                        ₹{(Number(hover.c.totalSpent) || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-th-secondary">
                        {uiT('Spent', 'खर्च')}
                      </p>
                    </div>
                    <div className="bg-th-elevated/40 rounded-lg px-2 py-1.5 text-center">
                      <p
                        className={`text-sm font-bold ${
                          (hover.c.pendingAmount || 0) > 0 ? 'text-[#e8a427]' : 'text-th-secondary'
                        }`}
                      >
                        ₹{(Number(hover.c.pendingAmount) || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-th-secondary">
                        {uiT('Due', 'बकाया')}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1.5">
                    {uiT('Recent details', 'हाल का विवरण')}
                  </p>
                  {d?.loading ? (
                    <div className="space-y-1.5">
                      {[0, 1].map((i) => (
                        <div key={i} className="h-8 bg-th-elevated rounded animate-pulse" />
                      ))}
                    </div>
                  ) : rxItems.length === 0 ? (
                    <p className="text-xs text-th-secondary">
                      {uiT('No prescriptions yet', 'अभी तक कोई नुस्खा नहीं')}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {rxItems.slice(0, 3).map((p, i) => (
                        <div
                          key={p._id || i}
                          className="flex items-center justify-between gap-2 bg-th-elevated/40 rounded-lg px-2.5 py-1.5"
                        >
                          <span className="font-mono text-[12px] text-th-text truncate">
                            {rxSummary(p)}
                          </span>
                          <span className="text-[11px] text-th-secondary shrink-0">
                            {fmtDate(p.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] font-bold uppercase tracking-wider text-th-secondary mt-3 mb-1.5">
                    {uiT('Orders summary', 'ऑर्डर सारांश')}
                  </p>
                  {d?.loading ? (
                    <div className="h-8 bg-th-elevated rounded animate-pulse" />
                  ) : orders.length === 0 ? (
                    <p className="text-xs text-th-secondary">
                      {uiT('No orders yet', 'अभी तक कोई ऑर्डर नहीं')}
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.entries(counts).map(([status, n]) => (
                          <span
                            key={status}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              ORDER_COLORS[status] || 'bg-th-elevated text-th-secondary'
                            }`}
                          >
                            {status} · {n}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-th-secondary">{uiT('Total billed', 'कुल बिल')}</span>
                        <span className="font-bold text-th-text">
                          ₹{totalBilled.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-th-secondary">{uiT('Open due', 'बकाया')}</span>
                        <span className="font-bold text-[#e8a427]">
                          ₹{orderPending.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 px-4 py-3 border-t border-th-border">
                  <button
                    onClick={() => navigate(`/customers/${hover.c._id}`)}
                    className="flex-1 px-3 py-2 rounded-lg border border-th-border text-th-text text-sm font-semibold hover:bg-th-elevated transition-colors"
                  >
                    {uiT('View Profile', 'प्रोफ़ाइल')}
                  </button>
                  <button
                    onClick={() => navigate(`/pickup?customerId=${hover.c._id}`)}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#1ed760] text-black text-sm font-bold hover:bg-[#1ed760]/90 transition-colors"
                  >
                    {uiT('Bill', 'बिल बनाएं')}
                  </button>
                </div>
              </div>
            );
          })(),
          document.body
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
                  ₹{(detailCustomer.totalSpent || 0).toLocaleString()}
                </p>
                <p className="text-[14px] text-th-secondary font-bold uppercase tracking-wider">
                  {uiT('Spent', 'αñûαñ░αÑìαñÜ')}
                </p>
              </div>
              <div className="bg-th-elevated rounded-lg p-3 text-center">
                <IndianRupee size={16} className="text-[#e8a427] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#e8a427]">
                  ₹{(detailCustomer.pendingAmount || 0).toLocaleString()}
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
