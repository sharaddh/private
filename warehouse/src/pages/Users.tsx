import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { Users as UsersIcon, Trash2, UserPlus } from "lucide-react";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

interface WarehouseUser {
  id: string;
  username: string;
  name: string;
  mobile: string;
  role: string;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<WarehouseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.get<WarehouseUser[]>("/api/auth/warehouse-users");
    if (res.success && Array.isArray(res.data)) setUsers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await api.del("/api/auth/users/" + id);
    if (res.success) { toast("User deleted"); fetchUsers(); }
    else { toast(res.message || "Failed to delete", "error"); }
    setDeleting(null);
    setDeleteTarget(null);
  }

  if (loading) {
    return <Spinner size={32} className="mx-auto mt-16" />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Warehouse Users</h1>
          <p className="page-subtitle">{users.length} user(s)</p>
        </div>
        <button onClick={() => navigate("/users/new")} className="btn-primary flex items-center gap-2">
          <UserPlus size={18} /> Add User
        </button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No warehouse users yet"
          action={{ label: "Add First User", onClick: () => navigate("/users/new") }}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-th-border bg-th-base">
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Username</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Name</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Mobile</th>
                  <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Created</th>
                  <th className="text-right text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-th-border hover:bg-th-hover transition-colors">
                    <td className="px-4 py-3 text-body-bold text-th-text">{u.username}</td>
                    <td className="px-4 py-3 text-body text-th-secondary">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-body text-th-secondary">{u.mobile || "—"}</td>
                    <td className="px-4 py-3 text-small text-th-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeleteTarget(u.id)} disabled={deleting === u.id}
                        className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted hover:text-negative transition-colors disabled:opacity-40"
                        title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        message="Delete this warehouse user permanently?"
      />
    </div>
  );
}
