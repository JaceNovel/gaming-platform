"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/config";
const STORAGE_KEY = "bbshop_token";
const HAS_API_ENV = Boolean(process.env.NEXT_PUBLIC_API_URL);

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
  login: (email: string, password: string) => Promise<AuthUser>;
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

  const pickUser = (payload: any): AuthUser | null => {
    if (!payload) return null;
    if (payload.user && typeof payload.user === "object") {
      return payload.user as AuthUser;
    }
    if (typeof payload === "object" && "id" in payload && "email" in payload) {
      return payload as AuthUser;
    }
    return null;
  };

  const loadUser = async (nextToken: string) => {
    if (!HAS_API_ENV) {
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${nextToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const nextUser = pickUser(data);
        if (nextUser) {
          setUser(nextUser);
          return;
        }
      }
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
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
    if (!HAS_API_ENV) {
      throw new Error("API non configurée (NEXT_PUBLIC_API_URL manquant)");
    }
    const headers = new Headers(init.headers as HeadersInit | undefined);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(input, { ...init, headers });
  };

  const parseErrorMessage = async (res: Response) => {
    const payload = await res.clone().json().catch(() => null);
    if (payload?.message) {
      return payload.message;
    }
    if (payload?.errors) {
      const firstKey = Object.keys(payload.errors)[0];
      if (firstKey && Array.isArray(payload.errors[firstKey])) {
        return payload.errors[firstKey][0];
      }
    }

    const text = await res.text().catch(() => "");
    if (text) {
      return `Erreur ${res.status}`;
    }
    return "Une erreur est survenue";
  };

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      if (!HAS_API_ENV) {
        throw new Error("API non configurée (NEXT_PUBLIC_API_URL manquant)");
      }
      res = await fetch(`${API_BASE}/auth/login`, {
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
    const loggedUser = pickUser(data);
    if (!loggedUser) {
      throw new Error("Réponse utilisateur invalide");
    }
    setToken(data.token);
    setUser(loggedUser);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, data.token);
    }
    return loggedUser;
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
      if (!HAS_API_ENV) {
        throw new Error("API non configurée (NEXT_PUBLIC_API_URL manquant)");
      }
      res = await fetch(`${API_BASE}/auth/register`, {
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
    const nextUser = pickUser(data);
    setUser(nextUser);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, data.token);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authFetch(`${API_BASE}/auth/logout`, { method: "POST" });
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
