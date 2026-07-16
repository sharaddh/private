import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const staffPrefixes = [
  "/", "/customers", "/orders", "/bills", "/pickup", "/whatsapp", "/workspace",
];

function isStaffAllowed(path: string): boolean {
  return staffPrefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export default function RoleGuard({ children, path }: { children: React.ReactNode; path: string }) {
  const { isStaff, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isStaff && !isStaffAllowed(path)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
