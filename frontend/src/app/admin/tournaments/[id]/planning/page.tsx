"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Tournament = {
  id: number;
  name: string;
  slug: string;
  planning_enabled?: boolean;
  first_match_at?: string | null;
  reward_rules?: string | null;
  planning_notes?: string | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const toDatetimeLocal = (value?: string | null): string => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminTournamentPlanningPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [tournamentName, setTournamentName] = useState("Tournoi");
  const [planningEnabled, setPlanningEnabled] = useState(true);
  const [firstMatchAt, setFirstMatchAt] = useState("");
  const [rewardRules, setRewardRules] = useState("");
  const [planningNotes, setPlanningNotes] = useState("");

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/tournaments/${encodeURIComponent(tournamentId)}`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Chargement impossible");
      const payload = (await res.json()) as Tournament;
      setTournamentName(payload?.name ?? "Tournoi");
      setPlanningEnabled(Boolean(payload?.planning_enabled ?? true));
      setFirstMatchAt(toDatetimeLocal(payload?.first_match_at));
      setRewardRules(String(payload?.reward_rules ?? ""));
      setPlanningNotes(String(payload?.planning_notes ?? ""));
    } catch {
      setError("Impossible de charger le planning.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tournamentId || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE}/admin/tournaments/${encodeURIComponent(tournamentId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          planning_enabled: planningEnabled,
          first_match_at: firstMatchAt || null,
          reward_rules: rewardRules.trim() || null,
          planning_notes: planningNotes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Sauvegarde impossible");

      setSuccess("Planning enregistré. Les emails automatiques ont été déclenchés pour les inscrits.");
    } catch {
      setError("Impossible d'enregistrer le planning.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Planning tournoi"
      subtitle={tournamentName}
      actions={
        <Link href="/admin/tournaments" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Retour tournois
        </Link>
      }
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <div>
              <div className="font-semibold text-slate-700">Planning activé</div>
              <div className="text-xs text-slate-500">Visible côté client sur Voir Planning</div>
            </div>
            <input type="checkbox" checked={planningEnabled} onChange={(e) => setPlanningEnabled(e.target.checked)} className="h-5 w-5" />
          </label>

          <div>
            <label className="text-sm font-medium">Heure du 1er match</label>
            <input
              type="datetime-local"
              value={firstMatchAt}
              onChange={(e) => setFirstMatchAt(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Calcul des récompenses</label>
            <textarea
              value={rewardRules}
              onChange={(e) => setRewardRules(e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="Ex: 1ère place 50%, 2ème 30%, 3ème 20%. Bonus MVP +10 000 FCFA."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes planning</label>
            <textarea
              value={planningNotes}
              onChange={(e) => setPlanningNotes(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="Infos additionnelles pour les joueurs"
            />
          </div>
        </section>

        <button type="submit" disabled={saving || loading} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Enregistrement..." : "Enregistrer le planning"}
        </button>
      </form>
    </AdminShell>
  );
}
