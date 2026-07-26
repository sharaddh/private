import { useState, useEffect, useCallback, Fragment } from "react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { Users as UsersIcon, Trash2, ChevronDown, ChevronRight, Clock, PackageMinus } from "lucide-react";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import Badge from "../components/Badge";
import { formatDate } from "../utils/helpers";

interface WarehouseUser {
  id: string;
  username: string;
  name: string;
  mobile: string;
  role: string;
  createdAt: string;
}

interface WithdrawalRecord {
  _id: string;
  user: string;
  username: string;
  items: { coating: string; lensType: string; powerKey: string; quantity: number }[];
  totalQuantity: number;
  withdrawnAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<WarehouseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();

  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.get<WarehouseUser[]>("/api/auth/warehouse-users");
    if (res.success && Array.isArray(res.data)) setUsers(res.data);
    setLoading(false);
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    setLoadingHistory(true);
    const res = await api.get<WithdrawalRecord[]>("/api/cart/withdrawals/all");
    if (res.success && Array.isArray(res.data)) setWithdrawals(res.data);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchWithdrawals();
  }, [fetchUsers, fetchWithdrawals]);

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await api.del("/api/auth/users/" + id);
    if (res.success) { toast("User deleted"); fetchUsers(); fetchWithdrawals(); }
    else { toast(res.message || "Failed to delete", "error"); }
    setDeleting(null);
    setDeleteTarget(null);
  }

  function getUserWithdrawals(userId: string): WithdrawalRecord[] {
    return withdrawals.filter((w) => w.user === userId);
  }

  function getUserTotalItems(userId: string): number {
    return getUserWithdrawals(userId).reduce((sum, w) => sum + w.totalQuantity, 0);
  }

  function toggleUser(userId: string) {
    setExpandedUser((prev) => (prev === userId ? null : userId));
  }

  if (loading) {
    return <Spinner size={32} className="mx-auto mt-16" />;
  }

  return (
    <div className="space-y-4 pb-20 lg:pb-0 animate-fade-in">
      <div>
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">{users.length} user(s) &middot; {withdrawals.length} withdrawal(s)</p>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No users yet"
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden lg:block card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-th-border bg-th-base">
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Username</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Name</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Mobile</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Role</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Withdrawals</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Created</th>
                  <th className="text-right text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const userWithdrawals = getUserWithdrawals(u.id);
                  const totalItems = getUserTotalItems(u.id);
                  const isExpanded = expandedUser === u.id;

                  return (
                    <Fragment key={u.id}>
                      <tr className="border-b border-th-border hover:bg-th-hover transition-colors">
                        <td className="px-4 py-3 text-body-bold text-th-text">{u.username}</td>
                        <td className="px-4 py-3 text-body text-th-secondary">{u.name || "—"}</td>
                        <td className="px-4 py-3 text-body text-th-secondary">{u.mobile || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={u.role === "owner" ? "green" : "blue"}>{u.role}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {userWithdrawals.length > 0 ? (
                            <button
                              onClick={() => toggleUser(u.id)}
                              className="flex items-center gap-1.5 text-body text-primary-500 font-medium hover:underline"
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {userWithdrawals.length} ({totalItems} items)
                            </button>
                          ) : (
                            <span className="text-body text-th-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-small text-th-muted">{formatDate(u.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {u.role !== "owner" && (
                            <button onClick={() => setDeleteTarget(u.id)} disabled={deleting === u.id}
                              className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted hover:text-negative transition-colors disabled:opacity-40"
                              title="Delete">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && userWithdrawals.length > 0 && (
                        <tr className="bg-th-elevated/50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="space-y-2">
                              {loadingHistory ? (
                                <p className="text-center text-th-muted text-micro py-2">Loading...</p>
                              ) : (
                                userWithdrawals.map((rec) => (
                                  <div key={rec._id} className="flex items-start justify-between gap-3 py-2 border-b border-th-border last:border-0">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Clock size={12} className="text-th-muted shrink-0" />
                                        <span className="text-small text-th-muted">
                                          {formatDate(rec.withdrawnAt)}
                                          {" "}
                                          {new Date(rec.withdrawnAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        <span className="text-small text-th-muted">&middot;</span>
                                        <span className="text-small font-medium text-th-secondary">{rec.totalQuantity} item{rec.totalQuantity !== 1 ? "s" : ""}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {rec.items.map((it, idx) => {
                                          const isNeg = it.powerKey.startsWith("-");
                                          const isPos = it.powerKey.startsWith("+") && it.powerKey !== "+0.00";
                                          return (
                                            <span
                                              key={idx}
                                              className={`px-1.5 py-0.5 rounded text-micro font-medium ${
                                                isNeg ? "bg-amber-400/15 text-amber-500" : isPos ? "bg-emerald-400/15 text-emerald-500" : "bg-th-surface text-th-secondary"
                                              }`}
                                            >
                                              {it.coating} {it.powerKey} x{it.quantity}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
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
              const userWithdrawals = getUserWithdrawals(u.id);
              const totalItems = getUserTotalItems(u.id);
              const isExpanded = expandedUser === u.id;

              return (
                <div key={u.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-th-text">{u.username}</span>
                        <Badge variant={u.role === "owner" ? "green" : "blue"}>{u.role}</Badge>
                      </div>
                      {u.name && <p className="text-xs text-th-secondary mt-1">{u.name}</p>}
                      {u.mobile && <p className="text-xs text-th-muted mt-0.5">{u.mobile}</p>}
                      <p className="text-micro text-th-muted mt-1">{formatDate(u.createdAt)}</p>
                    </div>
                    {u.role !== "owner" && (
                      <button onClick={() => setDeleteTarget(u.id)} disabled={deleting === u.id}
                        className="shrink-0 w-9 h-9 rounded-xl bg-negative/10 text-negative flex items-center justify-center active:scale-90 active:bg-negative/20 transition-all disabled:opacity-40"
                        title="Delete">
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  {/* Withdrawal history toggle */}
                  {userWithdrawals.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-th-border">
                      <button
                        onClick={() => toggleUser(u.id)}
                        className="flex items-center gap-2 w-full"
                      >
                        {isExpanded ? <ChevronDown size={14} className="text-th-muted" /> : <ChevronRight size={14} className="text-th-muted" />}
                        <PackageMinus size={14} className="text-primary-500" />
                        <span className="text-xs font-bold text-th-text uppercase tracking-wider">Withdrawals</span>
                        <span className="text-xs text-th-muted font-medium ml-auto">
                          {userWithdrawals.length} ({totalItems} items)
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 pl-5">
                          {loadingHistory ? (
                            <p className="text-center text-th-muted text-micro py-2">Loading...</p>
                          ) : (
                            userWithdrawals.map((rec) => (
                              <div key={rec._id} className="bg-th-elevated/50 rounded-lg p-2.5">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <Clock size={11} className="text-th-muted" />
                                    <span className="text-micro text-th-muted">
                                      {formatDate(rec.withdrawnAt)}
                                      {" "}
                                      {new Date(rec.withdrawnAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                  <span className="text-micro font-medium text-th-secondary">{rec.totalQuantity} item{rec.totalQuantity !== 1 ? "s" : ""}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {rec.items.map((it, idx) => {
                                    const isNeg = it.powerKey.startsWith("-");
                                    const isPos = it.powerKey.startsWith("+") && it.powerKey !== "+0.00";
                                    return (
                                      <span
                                        key={idx}
                                        className={`px-1.5 py-0.5 rounded text-micro font-medium ${
                                          isNeg ? "bg-amber-400/15 text-amber-500" : isPos ? "bg-emerald-400/15 text-emerald-500" : "bg-th-surface text-th-secondary"
                                        }`}
                                      >
                                        {it.coating} {it.powerKey} x{it.quantity}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          )}
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

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        message="Delete this user permanently?"
      />
    </div>
  );
}
