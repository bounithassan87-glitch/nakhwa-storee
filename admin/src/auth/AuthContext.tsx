import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiGet, apiPost, setUnauthorizedHandler } from "@/lib/api";

export interface AdminUser {
  email: string;
  role: string;
  name?: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
}

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AdminUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Check the real server session on load.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await apiGet<{ user: AdminUser }>("/api/admin/auth/session");
        if (alive) {
          setUser(res.user);
          setStatus("authenticated");
        }
      } catch {
        if (alive) {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Any 401 from the API (e.g. expired session) → drop to unauthenticated.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiPost<{ user: AdminUser }>("/api/admin/auth/login", { email, password });
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/admin/auth/logout");
    } catch {
      /* clear locally regardless */
    }
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<{ user: AdminUser }>("/api/admin/auth/session");
      setUser(res.user);
      setStatus("authenticated");
    } catch {
      /* keep current state */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

// The provider and its consumer hook intentionally live together (canonical
// React context pattern). Splitting them would touch every consumer file for a
// Fast-Refresh-only benefit.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
