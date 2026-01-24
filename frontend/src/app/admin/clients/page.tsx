"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { TablesGrid } from "@/components/admin/TablesGrid";
import { Tables } from "@/components/admin/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const buildUrl = (path: string, params: Record<string, string> = {}) => {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

export default function AdminClientsPage() {
  const [tables, setTables] = useState<Tables | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [exportType, setExportType] = useState("users");

  const fetchJson = useCallback(async <T,>(path: string): Promise<T> => {
    const res = await fetch(buildUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      throw new Error(`Erreur ${res.status}`);
    }
    return res.json();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const t = await fetchJson<Tables>("/admin/dashboard/tables");
      setTables(t);
    } catch (err) {
      setError("Impossible de charger les données clients.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleExport = async () => {
    const res = await fetch(buildUrl("/admin/dashboard/export", { type: exportType }), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      setError("Export impossible");
      return;
    }
    const blob = await res.blob();
    const filename = `${exportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportOptions = useMemo(
    () => [
      { value: "users", label: "Users" },
      { value: "orders", label: "Orders" },
      { value: "payments", label: "Payments" },
      { value: "email_logs", label: "Delivery emails" },
    ],
    [],
  );

  return (
    <div className="space-y-6 bg-[radial-gradient(circle_at_top,_#111927_0%,_#020617_45%,_#0f172a_100%)] px-4 py-6 text-white">
      <header className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-gradient-to-r from-slate-900/80 to-slate-800/60 p-6 shadow-2xl shadow-emerald-500/10 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-emerald-300">BADBOYSHOP</div>
          <h1 className="mt-1 text-3xl font-black">Admin Clients</h1>
          <p className="text-sm text-white/70">Gestion des clients, commandes, paiements et emails.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadAll}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold shadow-lg shadow-emerald-500/40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <select
              className="bg-transparent text-white outline-none"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
            >
              {exportOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button onClick={handleExport} className="rounded-lg bg-white/10 px-3 py-2 text-white">
              <Download className="h-4 w-4" />
            </button>
          </div>
          <Link
            href="/admin/dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <TablesGrid
        tables={tables}
        visibleTables={["users", "orders", "payments", "email_logs"]}
      />
    </div>
  );
}
