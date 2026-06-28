import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import api from "../api";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  login: (token: string, refresh: string) => void;
  logout: () => void;
  setUser: (user: Record<string, unknown>) => void;
}

const STORAGE_KEYS = {
  token: "accessToken",
  refresh: "refreshToken",
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

function loadAuth(): AuthState {
  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    refreshToken: localStorage.getItem(STORAGE_KEYS.refresh),
    user: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadAuth);

  useEffect(() => {
    if (state.token) {
      api.get("/api/auth/me").then((d) => {
        if (d.success) setState((s) => ({ ...s, user: d.data }));
        else logout();
      }).catch(() => logout());
    }
  }, [state.token]);

  const login = useCallback((token: string, refresh: string) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.refresh, refresh);
    setState({ token, refreshToken: refresh, user: null });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.refresh);
    setState({ token: null, refreshToken: null, user: null });
  }, []);

  const setUser = useCallback((user: Record<string, unknown>) => {
    setState((s) => ({ ...s, user }));
  }, []);

  const role = state.user?.role as string | undefined;
  const isAdmin = !!state.token && role !== "staff";
  const isStaff = !!state.token && role === "staff";

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated: !!state.token,
        isAdmin,
        isStaff,
        login,
        logout,
        setUser,
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
