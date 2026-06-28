import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import api from "../api";

interface AuthState {
  token: string | null;
  user: Record<string, unknown> | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const STORAGE_KEY = "wh_accessToken";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token: (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })(),
    user: null,
  }));

  useEffect(() => {
    if (state.token) {
      api.get("/api/auth/me").then((d) => {
        if (d.success) setState((s) => ({ ...s, user: d.data }));
        else logout();
      }).catch(() => logout());
    }
  }, [state.token]);

  const login = useCallback((token: string) => {
    try { localStorage.setItem(STORAGE_KEY, token); } catch {}
    setState({ token, user: null });
  }, []);

  const logout = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    api.clearToken();
    setState({ token: null, user: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
