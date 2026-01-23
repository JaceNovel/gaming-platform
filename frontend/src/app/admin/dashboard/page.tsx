'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, RefreshCw } from "lucide-react";
import { MetricGrid } from "@/components/admin/MetricGrid";
import { ChartGrid } from "@/components/admin/ChartGrid";
import { TablesGrid } from "@/components/admin/TablesGrid";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { Charts, Settings, Summary, Tables } from "@/components/admin/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api` : "");

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("badboyshop_token");
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

export default function AdminDashboardPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [tables, setTables] = useState<Tables | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [exportType, setExportType] = useState("orders");

  const dateParams = useMemo(() => ({ from, to }), [from, to]);

  const fetchJson = useCallback(
    async <T,>(path: string): Promise<T> => {
      const res = await fetch(buildUrl(path, dateParams), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
      }

      return res.json();
    },
    [dateParams],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, c, t, st] = await Promise.all([
        fetchJson<Summary>('/admin/dashboard/summary'),
        fetchJson<Charts>('/admin/dashboard/charts'),
        fetchJson<Tables>('/admin/dashboard/tables'),
        fetchJson<Settings>('/admin/settings'),
      ]);
      setSummary(s);
      setCharts(c);
      setTables(t);
      setSettings(st);
    } catch (err) {
      setError('Impossible de charger le dashboard. Vérifie le token admin.');
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleExport = async () => {
    const res = await fetch(buildUrl('/admin/dashboard/export', { ...dateParams, type: exportType }), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      setError('Export impossible');
      return;
    }
    const blob = await res.blob();
    const filename = `${exportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const saveSettings = async (payload: Partial<Settings>) => {
    const res = await fetch(buildUrl('/admin/settings'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
    }
  };

  const uploadLogo = async (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    const res = await fetch(buildUrl('/admin/settings/logo'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      setSettings((prev) => ({ ...(prev ?? {}), logo_url: data.logo_url }));
    }
  };

  return (
    <div className="space-y-6 bg-[radial-gradient(circle_at_top,_#111927_0%,_#020617_45%,_#0f172a_100%)] px-4 py-6 text-white">
      <header className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-gradient-to-r from-slate-900/80 to-slate-800/60 p-6 shadow-2xl shadow-emerald-500/10 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-emerald-300">BADBOYSHOP</div>
          <h1 className="mt-1 text-3xl font-black">Admin Dashboard</h1>
          <p className="text-sm text-white/70">Pilotage temps réel : ventes, paiements, premium, modération.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <CalendarRange className="h-4 w-4 text-emerald-300" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent text-white outline-none"
            />
            <span className="text-white/50">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent text-white outline-none"
            />
          </label>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold shadow-lg shadow-emerald-500/40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <select
              className="bg-transparent text-white outline-none"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
            >
              <option value="orders">Orders</option>
              <option value="payments">Payments</option>
              <option value="users">Users</option>
              <option value="premium_memberships">Premium</option>
              <option value="products">Products</option>
              <option value="likes">Likes</option>
              <option value="tournaments">Tournaments</option>
              <option value="chat_messages">Chat</option>
            </select>
            <button onClick={handleExport} className="rounded-lg bg-white/10 px-3 py-2 text-white">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <MetricGrid summary={summary} />
      <ChartGrid charts={charts} />
      <TablesGrid tables={tables} />
      <SettingsPanel settings={settings} onSave={saveSettings} onUploadLogo={uploadLogo} loading={loading} />
    </div>
  );
}
