"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const splitSponsors = (raw: string): string[] =>
  raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toDatetimeLocalValue = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type TournamentPayload = {
  id: number;
  name?: string;
  description?: string | null;
  rules?: string | null;
  requirements?: string | null;
  stream_url?: string | null;
  contact_email?: string | null;
  image?: string | null;
  status?: "upcoming" | "live" | "finished";
  format?: string | null;
  is_active?: boolean;
  is_free?: boolean;
  prize_pool_fcfa?: number;
  entry_fee_fcfa?: number;
  max_participants?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  registration_deadline?: string | null;
  first_prize_fcfa?: number;
  second_prize_fcfa?: number;
  third_prize_fcfa?: number;
  sponsors?: string[] | null;
};

export default function AdminTournamentEditPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [requirements, setRequirements] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [image, setImage] = useState("");
  const [status, setStatus] = useState<"upcoming" | "live" | "finished">("upcoming");
  const [format, setFormat] = useState("Élimination");
  const [isActive, setIsActive] = useState(true);
  const [isFree, setIsFree] = useState(false);
  const [prizePoolFcfa, setPrizePoolFcfa] = useState("10000");
  const [entryFeeFcfa, setEntryFeeFcfa] = useState("1000");
  const [maxParticipants, setMaxParticipants] = useState("100");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [firstPrize, setFirstPrize] = useState("5000");
  const [secondPrize, setSecondPrize] = useState("3000");
  const [thirdPrize, setThirdPrize] = useState("2000");
  const [sponsors, setSponsors] = useState("");

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => !!name.trim() && !!tournamentId, [name, tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    let active = true;

    const load = async () => {
      setInitialLoading(true);
      setMessage("");
      try {
        const res = await fetch(`${API_BASE}/admin/tournaments/${encodeURIComponent(tournamentId)}`, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });
        if (!res.ok) throw new Error("Chargement impossible");
        const payload = (await res.json()) as TournamentPayload;
        if (!active || !payload) return;

        setName(String(payload.name ?? ""));
        setDescription(String(payload.description ?? ""));
        setRules(String(payload.rules ?? ""));
        setRequirements(String(payload.requirements ?? ""));
        setStreamUrl(String(payload.stream_url ?? ""));
        setContactEmail(String(payload.contact_email ?? ""));
        setImage(String(payload.image ?? ""));
        setStatus(payload.status ?? "upcoming");
        setFormat(String(payload.format ?? "Élimination"));
        setIsActive(Boolean(payload.is_active ?? true));
        setIsFree(Boolean(payload.is_free ?? false));
        setPrizePoolFcfa(String(Number(payload.prize_pool_fcfa ?? 0)));
        setEntryFeeFcfa(String(Number(payload.entry_fee_fcfa ?? 0)));
        setMaxParticipants(String(Number(payload.max_participants ?? 0)));
        setStartsAt(toDatetimeLocalValue(payload.starts_at));
        setEndsAt(toDatetimeLocalValue(payload.ends_at));
        setRegistrationDeadline(toDatetimeLocalValue(payload.registration_deadline));
        setFirstPrize(String(Number(payload.first_prize_fcfa ?? 0)));
        setSecondPrize(String(Number(payload.second_prize_fcfa ?? 0)));
        setThirdPrize(String(Number(payload.third_prize_fcfa ?? 0)));
        setSponsors(Array.isArray(payload.sponsors) ? payload.sponsors.join(", ") : "");
      } catch {
        if (active) setMessage("Chargement impossible");
      } finally {
        if (active) setInitialLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [tournamentId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setMessage("");
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
        requirements: requirements.trim() || undefined,
        stream_url: streamUrl.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        image: image.trim() || undefined,
        status,
        format,
        is_active: isActive,
        is_free: isFree,
        prize_pool_fcfa: Number(prizePoolFcfa || 0),
        entry_fee_fcfa: isFree ? 0 : Number(entryFeeFcfa || 0),
        max_participants: Number(maxParticipants || 0),
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
        registration_deadline: registrationDeadline || undefined,
        first_prize_fcfa: Number(firstPrize || 0),
        second_prize_fcfa: Number(secondPrize || 0),
        third_prize_fcfa: Number(thirdPrize || 0),
        sponsors: splitSponsors(sponsors),
      };

      const res = await fetch(`${API_BASE}/admin/tournaments/${encodeURIComponent(tournamentId as string)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setMessage(err?.message ?? "Mise à jour impossible");
        return;
      }

      setMessage("Tournoi mis à jour.");
    } catch {
      setMessage("Mise à jour impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Modifier un tournoi" subtitle="Mettre à jour les informations du tournoi">
      {initialLoading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Chargement...</div> : null}
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Nom du tournoi *</label>
              <input value={name} onChange={(event) => setName(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Statut</label>
              <select value={status} onChange={(event) => setStatus(event.target.value as "upcoming" | "live" | "finished")} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm">
                <option value="upcoming">À venir</option>
                <option value="live">En cours</option>
                <option value="finished">Terminé</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">URL image</label>
              <input value={image} onChange={(event) => setImage(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Format</label>
              <input value={format} onChange={(event) => setFormat(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Prix total (FCFA)</label>
              <input type="number" min={0} value={prizePoolFcfa} onChange={(event) => setPrizePoolFcfa(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Frais d'entrée (FCFA)</label>
              <input type="number" min={0} value={entryFeeFcfa} onChange={(event) => setEntryFeeFcfa(event.target.value)} disabled={isFree} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:bg-slate-100" />
            </div>
            <div>
              <label className="text-sm font-medium">Participants max</label>
              <input type="number" min={1} value={maxParticipants} onChange={(event) => setMaxParticipants(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Email contact</label>
              <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Début</label>
              <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Fin</label>
              <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Date limite d'inscription</label>
              <input type="datetime-local" value={registrationDeadline} onChange={(event) => setRegistrationDeadline(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">URL streaming</label>
              <input value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">1ère place (FCFA)</label>
              <input type="number" min={0} value={firstPrize} onChange={(event) => setFirstPrize(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">2ème place (FCFA)</label>
              <input type="number" min={0} value={secondPrize} onChange={(event) => setSecondPrize(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">3ème place (FCFA)</label>
              <input type="number" min={0} value={thirdPrize} onChange={(event) => setThirdPrize(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Règles</label>
              <textarea value={rules} onChange={(event) => setRules(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Exigences</label>
              <textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Sponsors (séparés par virgule)</label>
              <input value={sponsors} onChange={(event) => setSponsors(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-700">Inscription gratuite</span>
              <input type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} className="h-5 w-5" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-700">Tournoi actif</span>
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-5 w-5" />
            </label>
          </div>
        </section>

        <div className="flex items-center justify-end">
          <button type="submit" disabled={loading || !canSubmit} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Mise à jour..." : "Enregistrer les modifications"}
          </button>
        </div>

        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    </AdminShell>
  );
}
