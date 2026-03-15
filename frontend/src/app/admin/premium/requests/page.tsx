"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type PremiumRequestRow = {
  id: number;
  level: "bronze" | "platine";
  status: "pending" | "approved" | "refused";
  followers_count: number;
  social_platform?: string | null;
  social_handle?: string | null;
  social_url?: string | null;
  other_platforms?: string[];
  promotion_channels?: string[];
  motivation?: string | null;
  admin_note?: string | null;
  rejection_reasons?: string[];
  created_at?: string | null;
  processed_at?: string | null;
  user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  plan?: {
    label?: string;
    earnings_ceiling?: string;
    benefits?: string[];
    requirements?: string[];
  } | null;
};

type Paginated<T> = {
  data?: T[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

const emptyDecisionState = {
  adminNote: "",
  rejectionReasons: "",
  sendEmail: true,
};

export default function AdminPremiumRequestsPage() {
  const [rows, setRows] = useState<PremiumRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("pending");
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decision, setDecision] = useState(emptyDecisionState);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(`${API_BASE}/admin/premium/requests`);
      if (status !== "all") url.searchParams.set("status", status);
      if (level !== "all") url.searchParams.set("level", level);
      if (search.trim()) url.searchParams.set("search", search.trim());

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les demandes Premium");

      const page: Paginated<PremiumRequestRow> | null = payload?.data ?? null;
      const nextRows = Array.isArray(page?.data) ? page.data ?? [] : [];
      setRows(nextRows);
      if (!nextRows.some((row) => row.id === selectedId)) {
        setSelectedId(nextRows[0]?.id ?? null);
        setDecision(emptyDecisionState);
      }
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les demandes Premium");
    } finally {
      setLoading(false);
    }
  }, [level, search, selectedId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
  }, [selected]);

  const approve = useCallback(async () => {
    if (!selected) return;
    setProcessingId(selected.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/premium/requests/${selected.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ admin_note: decision.adminNote.trim() || null }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Validation impossible");
      setDecision(emptyDecisionState);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation impossible");
    } finally {
      setProcessingId(null);
    }
  }, [decision.adminNote, load, selected]);

  const refuse = useCallback(async () => {
    if (!selected) return;
    if (!decision.rejectionReasons.trim()) {
      setError("Ajoute au moins une condition non respectée.");
      return;
    }

    setProcessingId(selected.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/premium/requests/${selected.id}/refuse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          admin_note: decision.adminNote.trim() || null,
          rejection_reasons: decision.rejectionReasons,
          send_email: decision.sendEmail,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Refus impossible");
      setDecision(emptyDecisionState);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refus impossible");
    } finally {
      setProcessingId(null);
    }
  }, [decision, load, selected]);

  return (
    <AdminShell title="Demandes Premium" subtitle="Validation du programme partenaire PRIME Gaming">
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="pending">En attente</option>
            <option value="approved">Approuvées</option>
            <option value="refused">Refusées</option>
            <option value="all">Toutes</option>
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tous les plans</option>
            <option value="bronze">Bronze</option>
            <option value="platine">Platine</option>
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, email ou téléphone" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" disabled={loading}>
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm text-slate-500">{loading ? "Chargement..." : `${rows.length} demande(s)`}</div>
          <div className="space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Aucune demande.</div>
            ) : rows.map((row) => {
              const active = selected?.id === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(row.id);
                    setDecision(emptyDecisionState);
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left ${active ? "border-red-300 bg-red-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{row.user?.name ?? "Utilisateur"}</div>
                      <div className="text-xs text-slate-500">{row.user?.email ?? "—"}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] uppercase text-slate-600">{row.status}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{row.plan?.label ?? row.level} • {row.followers_count.toLocaleString("fr-FR")} abonnés</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">Sélectionne une demande pour voir son dossier.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selected.user?.name ?? "Utilisateur"}</h2>
                  <p className="text-sm text-slate-500">{selected.user?.email ?? "—"}</p>
                  <p className="text-sm text-slate-500">{selected.user?.phone ?? "—"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div><strong>Plan:</strong> {selected.plan?.label ?? selected.level}</div>
                  <div><strong>Plafond:</strong> {selected.plan?.earnings_ceiling ?? "—"}</div>
                  <div><strong>Audience:</strong> {selected.followers_count.toLocaleString("fr-FR")}</div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div><strong>Plateforme:</strong> {selected.social_platform ?? "—"}</div>
                  <div><strong>Handle:</strong> {selected.social_handle ?? "—"}</div>
                  <div><strong>Lien:</strong> {selected.social_url ?? "—"}</div>
                  <div><strong>Autres plateformes:</strong> {(selected.other_platforms ?? []).join(" • ") || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div><strong>Canaux de promo:</strong> {(selected.promotion_channels ?? []).join(" • ") || "—"}</div>
                  <div className="mt-3"><strong>Motivation:</strong></div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-600">{selected.motivation ?? "—"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Conditions du plan</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  {(selected.plan?.benefits ?? []).map((benefit) => (
                    <span key={benefit} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{benefit}</span>
                  ))}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {(selected.plan?.requirements ?? []).map((requirement) => (
                    <li key={requirement}>• {requirement}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-medium text-slate-700">Note admin</label>
                <textarea
                  value={decision.adminNote}
                  onChange={(e) => setDecision((prev) => ({ ...prev, adminNote: e.target.value }))}
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="Note interne ou message court pour l'utilisateur"
                />

                <label className="mt-4 block text-sm font-medium text-slate-700">Conditions non respectées en cas de refus</label>
                <textarea
                  value={decision.rejectionReasons}
                  onChange={(e) => setDecision((prev) => ({ ...prev, rejectionReasons: e.target.value }))}
                  className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder={"Une condition par ligne\nEx: Audience insuffisante\nEx: Profil social non vérifiable"}
                />

                <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={decision.sendEmail}
                    onChange={(e) => setDecision((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                  />
                  Envoyer aussi l'email de refus avec le PDF récapitulatif
                </label>
              </div>

              {selected.status === "pending" ? (
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => void approve()} disabled={processingId === selected.id} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {processingId === selected.id ? "Validation..." : "Approuver et générer les PDFs"}
                  </button>
                  <button onClick={() => void refuse()} disabled={processingId === selected.id} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {processingId === selected.id ? "Refus..." : "Refuser"}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Dossier déjà traité le {selected.processed_at ?? "—"}.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}