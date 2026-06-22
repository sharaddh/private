import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
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
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${state.token}` },
      })
        .then((r) => r.json())
        .then((d) => { if (d.success) setState((s) => ({ ...s, user: d.data })); })
        .catch(() => {});
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

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated: !!state.token,
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
