import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Users as UsersIcon, Trash2, UserPlus, Loader } from "lucide-react";

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
  const navigate = useNavigate();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.get<WarehouseUser[]>("/api/auth/warehouse-users");
    if (res.success && Array.isArray(res.data)) setUsers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this warehouse user permanently?")) return;
    setDeleting(id);
    const res = await api.del("/api/auth/users/" + id);
    if (res.success) fetchUsers();
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Warehouse Users</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} user(s)</p>
        </div>
        <button onClick={() => navigate("/users/new")} className="btn-primary flex items-center gap-2">
          <UserPlus size={18} /> Add User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="card p-12 text-center">
          <UsersIcon size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No warehouse users yet</p>
          <button onClick={() => navigate("/users/new")} className="btn-primary mt-4">Add First User</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Username</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Mobile</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Created</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.mobile || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(u.id)} disabled={deleting === u.id}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        title="Delete">
                        {deleting === u.id ? <Loader size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}