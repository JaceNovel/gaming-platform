"use client";

import { FormEvent, useMemo, useState } from "react";
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

export default function AdminTournamentsAddPage() {
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
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => !!name.trim(), [name]);

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

      const res = await fetch(`${API_BASE}/admin/tournaments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setMessage(err?.message ?? "Création impossible");
        return;
      }

      setMessage("Tournoi enregistré.");
      setName("");
      setDescription("");
      setRules("");
      setRequirements("");
      setStreamUrl("");
      setContactEmail("");
      setImage("");
      setStatus("upcoming");
      setFormat("Élimination");
      setIsActive(true);
      setIsFree(false);
      setPrizePoolFcfa("10000");
      setEntryFeeFcfa("1000");
      setMaxParticipants("100");
      setStartsAt("");
      setEndsAt("");
      setRegistrationDeadline("");
      setFirstPrize("5000");
      setSecondPrize("3000");
      setThirdPrize("2000");
      setSponsors("");
    } catch {
      setMessage("Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Ajouter un tournoi" subtitle="Créez un tournoi avec inscription gratuite ou payante">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.8fr,1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-3xl font-semibold text-slate-800">Informations de base</h2>
              <p className="text-sm text-slate-500">Entrez les informations principales du tournoi</p>
            </header>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="text-sm font-medium">Nom du tournoi *</label>
                <input value={name} onChange={(event) => setName(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Description *</label>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={4} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Règles du tournoi</label>
                <textarea value={rules} onChange={(event) => setRules(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Exigences de participation</label>
                <textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">URL de streaming</label>
                  <input value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="https://twitch.tv/..." />
                </div>
                <div>
                  <label className="text-sm font-medium">Contact organisateur</label>
                  <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="email@exemple.com" />
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-3xl font-semibold text-slate-800">Image du tournoi</h3>
              </header>
              <div className="space-y-4 px-6 py-5">
                <label className="text-sm font-medium">Lien de l'image</label>
                <input value={image} onChange={(event) => setImage(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="https://..." />
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {image ? <img src={image} alt="Aperçu" className="h-40 w-full object-cover" /> : <div className="grid h-40 place-items-center text-sm text-slate-400">Aperçu image</div>}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-3xl font-semibold text-slate-800">Paramètres</h3>
              </header>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="text-sm font-medium">Statut</label>
                  <select value={status} onChange={(event) => setStatus(event.target.value as "upcoming" | "live" | "finished")} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm">
                    <option value="upcoming">À venir</option>
                    <option value="live">En cours</option>
                    <option value="finished">Terminé</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Format du tournoi</label>
                  <select value={format} onChange={(event) => setFormat(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm">
                    <option>Élimination</option>
                    <option>Round Robin</option>
                    <option>Système Suisse</option>
                    <option>Bracket</option>
                  </select>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-slate-700">Inscription gratuite</div>
                    <div className="text-xs text-slate-500">Masquer les frais d'entrée côté client</div>
                  </div>
                  <input type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} className="h-5 w-5" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-slate-700">Tournoi actif</div>
                    <div className="text-xs text-slate-500">Visible sur la plateforme</div>
                  </div>
                  <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-5 w-5" />
                </label>
              </div>
            </section>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-3xl font-semibold text-slate-800">Configuration</h2>
          </header>
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Prix total (FCFA) *</label>
                <input type="number" min={0} value={prizePoolFcfa} onChange={(event) => setPrizePoolFcfa(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              {!isFree ? (
                <div>
                  <label className="text-sm font-medium">Frais d'entrée (FCFA) *</label>
                  <input type="number" min={0} value={entryFeeFcfa} onChange={(event) => setEntryFeeFcfa(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Inscription gratuite: aucun prix d'entrée affiché aux clients.</div>
              )}
              <div>
                <label className="text-sm font-medium">Nombre max de participants *</label>
                <input type="number" min={1} value={maxParticipants} onChange={(event) => setMaxParticipants(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Date de début *</label>
                <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Date de fin *</label>
                <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Limite d'inscription</label>
                <input type="datetime-local" value={registrationDeadline} onChange={(event) => setRegistrationDeadline(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-3xl font-semibold text-slate-800">Répartition des prix</h2>
          </header>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
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
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-3xl font-semibold text-slate-800">Sponsors</h2>
          </header>
          <div className="px-6 py-5">
            <label className="text-sm font-medium">Liste des sponsors (séparés par virgule)</label>
            <input value={sponsors} onChange={(event) => setSponsors(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Sponsor A, Sponsor B" />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button type="button" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Annuler</button>
          <button type="submit" disabled={loading || !canSubmit} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Enregistrement..." : "Enregistrer le tournoi"}
          </button>
        </div>

        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    </AdminShell>
  );
}
