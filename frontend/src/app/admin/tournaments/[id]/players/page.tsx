"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type RegistrationRow = {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_email?: string | null;
  created_at?: string | null;
};

type RegistrationsPayload = {
  tournament?: {
    id: number;
    name: string;
    slug: string;
  };
  registrations?: {
    data?: RegistrationRow[];
  };
  total_registrations?: number;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminTournamentPlayersPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [tournamentName, setTournamentName] = useState<string>("Tournoi");
  const [totalRegistrations, setTotalRegistrations] = useState<number>(0);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations?per_page=200`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!res.ok) throw new Error("Chargement impossible");

      const payload = (await res.json()) as RegistrationsPayload;
      setRows(Array.isArray(payload?.registrations?.data) ? payload.registrations.data : []);
      setTournamentName(payload?.tournament?.name ?? "Tournoi");
      setTotalRegistrations(Number(payload?.total_registrations ?? 0));
    } catch {
      setError("Impossible de charger les joueurs inscrits.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExportCsv = async () => {
    if (!tournamentId || exporting || typeof window === "undefined") return;
    setExporting(true);
    setError("");

    try {
      const token = window.localStorage.getItem("bbshop_token");
      const res = await fetch(`${API_BASE}/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Export impossible");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tournoi_${tournamentId}_joueurs.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Impossible d'exporter le CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminShell
      title="Joueurs inscrits"
      subtitle={`${tournamentName} • ${totalRegistrations} inscription(s)`}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {exporting ? "Export..." : "Exporter CSV"}
          </button>
          <Link href="/admin/tournaments" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Retour tournois
          </Link>
        </div>
      }
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ID inscription</th>
              <th className="px-4 py-3">ID joueur</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-700">{row.id}</td>
                <td className="px-4 py-3 text-slate-700">{row.user_id}</td>
                <td className="px-4 py-3 text-slate-700">{row.user_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.user_email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {row.created_at ? new Date(row.created_at).toLocaleString("fr-FR") : "—"}
                </td>
              </tr>
            ))}

            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  {loading ? "Chargement..." : "Aucun joueur inscrit"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
