import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import api from "../api";

interface User {
  _id: string;
  username: string;
  name?: string;
  mobile?: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isOwner: boolean;
  isWarehouseUser: boolean;
  login: (token: string, user?: User) => void;
  logout: () => void;
}

const STORAGE_KEY = "wh_accessToken";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token: (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })(),
    user: null,
    loading: true,
  }));

  useEffect(() => {
    if (state.token && !state.user) {
      api.get<User>("/api/auth/me").then((d) => {
        if (d.success && d.data) setState((s) => ({ ...s, user: d.data!, loading: false }));
        else { logout(); setState((s) => ({ ...s, loading: false })); }
      }).catch(() => { logout(); setState((s) => ({ ...s, loading: false })); });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.token, state.user]);

  const login = useCallback((token: string, user?: User) => {
    try { localStorage.setItem(STORAGE_KEY, token); } catch {}
    setState({ token, user: user || null, loading: false });
  }, []);

  const logout = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    api.clearToken();
    setState({ token: null, user: null, loading: false });
  }, []);

  const isOwner = state.user?.role === "owner";
  const isWarehouseUser = state.user?.role === "warehouse";

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.token, isOwner, isWarehouseUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
