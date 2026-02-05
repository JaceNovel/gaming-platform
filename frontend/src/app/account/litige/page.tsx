"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

type Dispute = {
  id: number;
  status: "open" | "under_review" | "resolved" | string;
  reason: string | null;
  created_at?: string | null;
  opened_at?: string | null;
  resolved_at?: string | null;
  resolution?: string | null;
  resolution_note?: string | null;
  evidence_urls?: string[];
  listing?: { title?: string | null } | null;
  marketplace_order?: { id?: number; status?: string | null } | null;
  marketplaceOrder?: { id?: number; status?: string | null } | null;
};

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  total?: number;
};

const statusLabel = (s?: string | null) => {
  const v = String(s ?? "").toLowerCase();
  if (v === "open") return { label: "Accepté", tone: "amber" as const };
  if (v === "under_review") return { label: "En cours", tone: "slate" as const };
  if (v === "resolved") return { label: "Décision", tone: "emerald" as const };
  return { label: v || "—", tone: "slate" as const };
};

const badgeClass = (tone: "amber" | "slate" | "emerald") => {
  if (tone === "emerald") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  if (tone === "amber") return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/5 text-white/75";
};

function LitigeClient() {
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  const [orderRef, setOrderRef] = useState("");
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/gaming-accounts/disputes/mine`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les litiges");
      const page: Paginated<Dispute> | null = payload?.data ?? null;
      const list = Array.isArray(page?.data) ? page!.data! : [];
      setDisputes(list);
    } catch (e) {
      setDisputes([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les litiges");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (submitting) return;
    setError("");
    setSuccess("");

    const ref = orderRef.trim();
    if (!ref) {
      setError("Référence commande obligatoire.");
      return;
    }
    const message = reason.trim();
    if (!message) {
      setError("Explique le problème (raison) obligatoire.");
      return;
    }

    const form = new FormData();
    form.append("reason", message);
    for (const file of photos) {
      form.append("photos[]", file);
    }

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE}/gaming-accounts/orders/${encodeURIComponent(ref)}/dispute`, {
        method: "POST",
        body: form,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible d’ouvrir le litige");

      setSuccess("Litige envoyé. Un agent va analyser votre demande.");
      setOrderRef("");
      setReason("");
      setPhotos([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’ouvrir le litige");
    } finally {
      setSubmitting(false);
    }
  }, [authFetch, load, orderRef, photos, reason, submitting]);

  const items = useMemo(() => disputes ?? [], [disputes]);

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.35),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.25),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.2),transparent_55%)]" />
      </div>

      <main className="mx-auto w-full max-w-5xl px-5 md:px-10 lg:px-12 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/45">Support</p>
            <h1 className="mt-1 text-2xl font-semibold">Litige</h1>
            <p className="mt-1 text-sm text-white/60">Dépose une demande avec preuves (photos) et suis le statut.</p>
          </div>
          <button
            onClick={() => history.back()}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Retour
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
        ) : null}
        {success ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{success}</div>
        ) : null}

        <div className="mt-6 rounded-[32px] border border-white/10 bg-black/45 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">Ouvrir un litige</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-white/70">
              Référence / ID commande
              <input
                value={orderRef}
                onChange={(e) => setOrderRef(e.target.value)}
                placeholder="Ex: 12345 ou REF-..."
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/90 focus:border-cyan-300 focus:outline-none"
              />
            </label>

            <label className="text-sm text-white/70">
              Photos (optionnel)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setPhotos(files);
                }}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/80 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white/80"
              />
              <p className="mt-2 text-xs text-white/45">JPG/PNG/WEBP, 6 max.</p>
            </label>
          </div>

          <label className="mt-4 block text-sm text-white/70">
            Raison
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              placeholder="Décris le problème, ce qui a été livré (ou pas), et ce que tu demandes..."
              className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/90 focus:border-cyan-300 focus:outline-none"
            />
          </label>

          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {submitting ? "Envoi..." : "Envoyer le litige"}
          </button>
        </div>

        <div className="mt-8 rounded-[32px] border border-white/10 bg-black/45 p-6 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/45">Historique</p>
              <h2 className="mt-1 text-lg font-semibold">Mes litiges</h2>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
              disabled={loading}
            >
              {loading ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/65">
                {loading ? "Chargement..." : "Aucun litige."}
              </div>
            ) : (
              items.map((d) => {
                const s = statusLabel(d.status);
                const urls = Array.isArray(d.evidence_urls) ? d.evidence_urls : [];
                const title = d.listing?.title ?? "Marketplace";
                return (
                  <div key={d.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Litige #{d.id} — {title}</div>
                        <div className="mt-1 text-xs text-white/50">Créé: {d.opened_at ?? d.created_at ?? "—"}</div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs ${badgeClass(s.tone)}`}>{s.label}</div>
                    </div>

                    {d.reason ? <p className="mt-3 text-sm text-white/70 whitespace-pre-wrap">{d.reason}</p> : null}

                    {urls.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {urls.map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="preuve" className="h-20 w-20 object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {d.status === "resolved" ? (
                      <div className="mt-4 rounded-2xl border border-emerald-300/10 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                        <div className="font-semibold">Décision</div>
                        <div className="mt-1 text-xs opacity-80">{d.resolved_at ?? "—"}</div>
                        <div className="mt-2 text-sm text-emerald-50/90">{d.resolution_note ?? d.resolution ?? "—"}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LitigePage() {
  return (
    <RequireAuth>
      <LitigeClient />
    </RequireAuth>
  );
}
