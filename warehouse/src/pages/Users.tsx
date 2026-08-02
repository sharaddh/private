import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import api from "../api";
import {
  Users as UsersIcon, ChevronDown, ChevronRight, Clock, PackageMinus,
  CheckCircle2, Boxes, Wallet, Phone, Calendar,
} from "lucide-react";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";
import Badge from "../components/Badge";
import { formatDate, formatCurrency, formatLensPower, lensTypeLabel, powerChipClass } from "../utils/helpers";

interface WarehouseUser {
  id: string;
  username: string;
  name: string;
  mobile: string;
  role: string;
  createdAt: string;
}

interface WithdrawalItem {
  coating: string;
  lensType: string;
  powerKey: string;
  quantity: number;
  price?: number;
  fogMark?: string;
}

interface WithdrawalRecord {
  _id: string;
  user: string;
  username: string;
  items: WithdrawalItem[];
  totalQuantity: number;
  totalPrice?: number;
  paid?: boolean;
  withdrawnAt: string;
}

function OwnerAvatar({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-primary-500/15 flex items-center justify-center shrink-0">
      <span className="text-body-bold text-primary-500">{(name || "?").charAt(0).toUpperCase()}</span>
    </div>
  );
}

function WithdrawalDetail({ rec }: { rec: WithdrawalRecord }) {
  return (
    <div className="bg-th-elevated/50 rounded-lg p-3 border border-th-border">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="text-th-muted shrink-0" />
          <span className="text-small text-th-muted">
            {formatDate(rec.withdrawnAt)}
            {" · "}
            {new Date(rec.withdrawnAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <span className="text-small font-bold text-th-secondary">{rec.totalQuantity} item{rec.totalQuantity !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {rec.items.map((it, idx) => (
          <span key={idx} className={`px-2 py-0.5 rounded text-small font-medium ${powerChipClass(it.powerKey)}`}>
            {it.coating} · {lensTypeLabel(it.lensType)} · {formatLensPower(it.powerKey)} x{it.quantity}
            {it.fogMark ? ` · ${it.fogMark}` : ""}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap mt-2 pt-2 border-t border-th-border">
        <span className="text-body-bold text-th-text">{formatCurrency(rec.totalPrice ?? 0)}</span>
        {rec.paid ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-pill bg-emerald-500/15 text-emerald-500 text-small-bold">
            <CheckCircle2 size={14} /> Paid
          </span>
        ) : (
          <span className="px-3 py-1 rounded-pill bg-amber-500/15 text-amber-500 text-small-bold">Unpaid</span>
        )}
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<WarehouseUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.get<WarehouseUser[]>("/api/auth/warehouse-users");
    if (res.success && Array.isArray(res.data)) setUsers(res.data);
    setLoading(false);
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    const res = await api.get<WithdrawalRecord[]>("/api/cart/withdrawals/all");
    if (res.success && Array.isArray(res.data)) setWithdrawals(res.data);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchWithdrawals();
  }, [fetchUsers, fetchWithdrawals]);

  const withdrawalsByUser = useMemo(() => {
    const map = new Map<string, WithdrawalRecord[]>();
    for (const w of withdrawals) {
      const existing = map.get(w.user);
      if (existing) existing.push(w);
      else map.set(w.user, [w]);
    }
    return map;
  }, [withdrawals]);

  const userTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const [userId, recs] of withdrawalsByUser) {
      map.set(userId, recs.reduce((sum, w) => sum + w.totalQuantity, 0));
    }
    return map;
  }, [withdrawalsByUser]);

  const totalItemsAll = useMemo(() => withdrawals.reduce((sum, w) => sum + w.totalQuantity, 0), [withdrawals]);
  const unpaidTotal = useMemo(() => withdrawals.filter((w) => !w.paid).reduce((sum, w) => sum + (w.totalPrice ?? 0), 0), [withdrawals]);

  if (loading) {
    return <Spinner size={32} className="mx-auto mt-16" />;
  }

  return (
    <div className="space-y-4 pb-20 lg:pb-0 animate-page-enter">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
          <UsersIcon size={22} className="text-primary-500" />
        </div>
        <div>
          <h1 className="page-title leading-tight">Users</h1>
          <p className="page-subtitle">{users.length} owner(s) &middot; {withdrawals.length} withdrawal(s)</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={UsersIcon} iconColor="text-primary-500" iconBg="bg-primary-500/10" value={users.length} label="Owners" />
        <StatCard icon={PackageMinus} iconColor="text-blue-500" iconBg="bg-blue-500/10" value={withdrawals.length} label="Withdrawals" />
        <StatCard icon={Boxes} iconColor="text-amber-500" iconBg="bg-amber-500/10" value={totalItemsAll} label="Items Withdrawn" />
        <StatCard icon={Wallet} iconColor="text-negative" iconBg="bg-negative/10" value={formatCurrency(unpaidTotal)} label="Unpaid Total" />
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No owners yet"
          message="Create the first owner to get started"
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden lg:block card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-th-border bg-th-base">
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Branch Owner</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Mobile</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Withdrawals</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const userWithdrawals = withdrawalsByUser.get(u.id) || [];
                  const totalItems = userTotals.get(u.id) || 0;
                  const isExpanded = expandedUser === u.id;

                  return (
                    <Fragment key={u.id}>
                      <tr className="border-b border-th-border hover:bg-th-hover transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <OwnerAvatar name={u.name || u.username} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-body-bold text-th-text">{u.name || u.username}</span>
                                <Badge variant={u.role === "owner" ? "purple" : "gray"}>{u.role === "owner" ? "Owner" : u.role}</Badge>
                              </div>
                              <p className="text-small text-th-muted truncate">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.mobile ? (
                            <span className="flex items-center gap-1.5 text-body text-th-secondary">
                              <Phone size={14} className="text-th-muted shrink-0" />
                              {u.mobile}
                            </span>
                          ) : (
                            <span className="text-body text-th-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {userWithdrawals.length > 0 ? (
                            <button
                              onClick={() => setExpandedUser((prev) => (prev === u.id ? null : u.id))}
                              className="flex items-center gap-1.5 text-body text-primary-500 font-medium hover:underline"
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {userWithdrawals.length} withdrawal{userWithdrawals.length !== 1 ? "s" : ""} ({totalItems} items)
                            </button>
                          ) : (
                            <span className="text-body text-th-muted">No withdrawals</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-small text-th-muted">
                            <Calendar size={13} className="shrink-0" />
                            {formatDate(u.createdAt)}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && userWithdrawals.length > 0 && (
                        <tr className="bg-th-elevated/50">
                          <td colSpan={4} className="px-4 py-3">
                            <div className="space-y-2">
                              {userWithdrawals.map((rec, idx) => (
                                <div key={rec._id} style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }} className="animate-fade-up">
                                  <WithdrawalDetail rec={rec} />
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="lg:hidden space-y-2">
            {users.map((u) => {
              const userWithdrawals = withdrawalsByUser.get(u.id) || [];
              const totalItems = userTotals.get(u.id) || 0;
              const isExpanded = expandedUser === u.id;

              return (
                <div key={u.id} className="card p-3">
                  <div className="flex items-start gap-3">
                    <OwnerAvatar name={u.name || u.username} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body-bold font-bold text-th-text">{u.name || u.username}</span>
                        <Badge variant={u.role === "owner" ? "purple" : "gray"}>{u.role === "owner" ? "Owner" : u.role}</Badge>
                      </div>
                      <p className="text-small text-th-muted truncate">@{u.username}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        {u.mobile && (
                          <span className="flex items-center gap-1 text-small text-th-secondary">
                            <Phone size={12} className="text-th-muted" />
                            {u.mobile}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-small text-th-muted">
                          <Calendar size={12} />
                          {formatDate(u.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {userWithdrawals.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-th-border">
                      <button
                        onClick={() => setExpandedUser((prev) => (prev === u.id ? null : u.id))}
                        className="flex items-center gap-2 w-full"
                      >
                        {isExpanded ? <ChevronDown size={14} className="text-th-muted" /> : <ChevronRight size={14} className="text-th-muted" />}
                        <PackageMinus size={14} className="text-primary-500" />
                        <span className="text-small font-bold text-th-text uppercase tracking-wider">Withdrawals</span>
                        <span className="text-small text-th-muted font-medium ml-auto">
                          {userWithdrawals.length} ({totalItems} items)
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 pl-2">
                          {userWithdrawals.map((rec, idx) => (
                            <div key={rec._id} style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }} className="animate-fade-up">
                              <WithdrawalDetail rec={rec} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
