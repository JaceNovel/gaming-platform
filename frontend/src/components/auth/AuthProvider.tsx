"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api` : "");
const STORAGE_KEY = "bbshop_token";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role?: string | null;
  is_premium?: boolean;
  premium_level?: number | null;
  premium_expiration?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    countryCode: string;
    countryName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async (nextToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/user`, {
        headers: { Authorization: `Bearer ${nextToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
        setToken(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setToken(stored);
      loadUser(stored);
    } else {
      setLoading(false);
    }
  }, []);

  const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers as HeadersInit | undefined);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(input, { ...init, headers });
  };

  const parseErrorMessage = async (res: Response) => {
    const payload = await res.json().catch(() => ({}));
    if (payload?.message) {
      return payload.message;
    }
    if (payload?.errors) {
      const firstKey = Object.keys(payload.errors)[0];
      if (firstKey && Array.isArray(payload.errors[firstKey])) {
        return payload.errors[firstKey][0];
      }
    }
    return "Une erreur est survenue";
  };

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch (error) {
      throw new Error("Connexion au serveur impossible");
    }

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, data.token);
    }
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    countryCode: string;
    countryName: string;
  }) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error("Connexion au serveur impossible");
    }

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, data.token);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authFetch(`${API_BASE}/logout`, { method: "POST" });
      }
    } catch (error) {
      // best effort logout
    } finally {
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, authFetch }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
