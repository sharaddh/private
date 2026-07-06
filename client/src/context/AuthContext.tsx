import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import api from "../api";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
}

interface BranchInfo {
  _id: string;
  name: string;
  code: string;
  dbName: string;
  isActive: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  branches: BranchInfo[];
  currentBranchId: string | null;
  currentBranch: BranchInfo | null;
  login: (token: string, refresh: string) => void;
  logout: () => void;
  setUser: (user: Record<string, unknown>) => void;
  setCurrentBranch: (branchId: string) => void;
}

const STORAGE_KEYS = {
  token: "accessToken",
  refresh: "refreshToken",
  branchId: "currentBranchId",
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

function loadAuth(): AuthState & { currentBranchId: string | null } {
  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    refreshToken: localStorage.getItem(STORAGE_KEYS.refresh),
    user: null,
    currentBranchId: localStorage.getItem(STORAGE_KEYS.branchId),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState & { currentBranchId: string | null }>(loadAuth);
  const [branches, setBranches] = useState<BranchInfo[]>([]);

  useEffect(() => {
    if (state.token) {
      api.get("/api/auth/me").then((d) => {
        if (d.success) {
          const user = d.data as Record<string, unknown>;
          setState((s) => ({ ...s, user }));
          const userBranches = (user?.branches || []) as BranchInfo[];
          setBranches(userBranches);
          if (!state.currentBranchId && userBranches.length > 0) {
            setCurrentBranch(userBranches[0]._id);
          }
        } else logout();
      }).catch(() => logout());
    }
  }, [state.token]);

  const login = useCallback((token: string, refresh: string) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.refresh, refresh);
    setState({ token, refreshToken: refresh, user: null, currentBranchId: null });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.refresh);
    localStorage.removeItem(STORAGE_KEYS.branchId);
    setState({ token: null, refreshToken: null, user: null, currentBranchId: null });
    setBranches([]);
  }, []);

  const setUser = useCallback((user: Record<string, unknown>) => {
    setState((s) => ({ ...s, user }));
    const userBranches = (user?.branches || []) as BranchInfo[];
    setBranches(userBranches);
  }, []);

  const setCurrentBranch = useCallback((branchId: string) => {
    localStorage.setItem(STORAGE_KEYS.branchId, branchId);
    setState((s) => ({ ...s, currentBranchId: branchId }));
  }, []);

  const role = state.user?.role as string | undefined;
  const isAdmin = !!state.token && role !== "staff";
  const isStaff = !!state.token && role === "staff";

  const currentBranch = branches.find((b) => b._id === state.currentBranchId) || null;

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated: !!state.token,
        isAdmin,
        isStaff,
        branches,
        currentBranchId: state.currentBranchId,
        currentBranch,
        login,
        logout,
        setUser,
        setCurrentBranch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
