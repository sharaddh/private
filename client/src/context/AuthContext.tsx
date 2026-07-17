import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import api from "../api";
import type { User, BranchInfo } from "../types";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  currentBranchId: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  branches: BranchInfo[];
  currentBranch: BranchInfo | null;
  login: (token: string, refresh: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setCurrentBranch: (branchId: string) => void;
}

const STORAGE_KEYS = {
  token: "accessToken",
  refresh: "refreshToken",
  branchId: "currentBranchId",
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

function loadAuth(): AuthState {
  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    refreshToken: localStorage.getItem(STORAGE_KEYS.refresh),
    user: null,
    currentBranchId: localStorage.getItem(STORAGE_KEYS.branchId),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadAuth);
  const [branches, setBranches] = useState<BranchInfo[]>([]);

  useEffect(() => {
    if (!state.token) return;

    let cancelled = false;
    api
      .get<User>("/api/auth/me")
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const user = res.data;
          setState((s) => ({ ...s, user }));
          setBranches(user.branches || []);
          if (!state.currentBranchId && user.branches?.length > 0) {
            setCurrentBranch(user.branches[0]._id);
          }
        } else {
          logout();
        }
      })
      .catch(() => {
        if (!cancelled) logout();
      });

    return () => {
      cancelled = true;
    };
  }, [state.token]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const setUser = useCallback((user: User) => {
    setState((s) => ({ ...s, user }));
    setBranches(user.branches || []);
  }, []);

  const setCurrentBranch = useCallback((branchId: string) => {
    localStorage.setItem(STORAGE_KEYS.branchId, branchId);
    setState((s) => ({ ...s, currentBranchId: branchId }));
  }, []);

  const role = state.user?.role;
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
