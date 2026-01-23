"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Clock, Users, Ticket, Trophy, X, ShieldCheck, Sparkles, Zap } from "lucide-react";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";

const tournaments = [
  {
    id: 1,
    title: "CoD Elite Showdown",
    subtitle: "Préparez-vous pour la bataille ultime sur Call of Duty !",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1400&auto=format&fit=crop",
    prize: "50 000 FCFA",
    status: "Bientôt",
    tag: "Tournoi",
    startDate: "27 juil. 2025",
    endDate: "30 juil. 2025",
    progress: 7,
    participants: "7/100",
    fee: "100 FCFA",
  },
  {
    id: 2,
    title: "Free Fire Championship",
    subtitle: "Tournoi mensuel avec de gros prix à gagner",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1400&auto=format&fit=crop",
    prize: "100 000 FCFA",
    status: "Bientôt",
    tag: "Tournoi",
    startDate: "20 déc. 2025",
    endDate: "22 déc. 2025",
    progress: 0,
    participants: "0/100",
    fee: "1000 FCFA",
  },
  {
    id: 3,
    title: "PUBG Squad Battle",
    subtitle: "Bataille d'équipes intense",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1400&auto=format&fit=crop",
    prize: "75 000 FCFA",
    status: "Bientôt",
    tag: "Tournoi",
    startDate: "25 déc. 2025",
    endDate: "27 déc. 2025",
    progress: 0,
    participants: "0/80",
    fee: "1500 FCFA",
  },
  {
    id: 4,
    title: "Valorant Rift",
    subtitle: "Escouades pro et cash prizes",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1400&auto=format&fit=crop",
    prize: "120 000 FCFA",
    status: "En cours",
    tag: "Tournoi",
    startDate: "15 jan. 2026",
    endDate: "18 jan. 2026",
    progress: 64,
    participants: "64/100",
    fee: "2000 FCFA",
  },
  {
    id: 5,
    title: "Mobile Legends Arena",
    subtitle: "Finales hebdo ultra rapides",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1400&auto=format&fit=crop",
    prize: "35 000 FCFA",
    status: "Terminés",
    tag: "Tournoi",
    startDate: "10 jan. 2026",
    endDate: "12 jan. 2026",
    progress: 100,
    participants: "100/100",
    fee: "500 FCFA",
  },
];

const tabs = ["Tous", "À venir", "En cours", "Terminés"] as const;

type Tab = (typeof tabs)[number];

type Tournament = (typeof tournaments)[number];

const statusMap: Record<Tab, Tournament["status"] | "Tous"> = {
  Tous: "Tous",
  "À venir": "Bientôt",
  "En cours": "En cours",
  Terminés: "Terminés",
};

export default function TournamentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Tous");
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const filtered = useMemo(() => {
    const status = statusMap[activeTab];
    if (status === "Tous") return tournaments;
    return tournaments.filter((t) => t.status === status);
  }, [activeTab]);

  const openModal = (tournament: Tournament) => {
    setSelected(tournament);
  };

  const closeModal = () => {
    setIsJoining(false);
    setSelected(null);
  };

  const handleJoin = () => {
    // Placeholder for API call toward tournament registration
    setIsJoining(true);
    setTimeout(() => {
      setIsJoining(false);
      closeModal();
    }, 800);
  };

  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="w-full py-10">
        <div className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-10">
          <header className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 text-black grid place-items-center shadow-[0_10px_30px_rgba(110,231,255,0.35)]">
                <Trophy className="h-6 w-6" />
              </span>
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">Tournois</p>
                <h1 className="text-3xl lg:text-4xl font-black">Tournois</h1>
              </div>
            </div>
            <p className="text-sm text-white/60">Participez à des tournois exclusifs et gagnez des prix incroyables</p>
          </header>

          <div className="glass-card rounded-2xl p-3 border border-white/10 flex items-center justify-between max-w-2xl mx-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-xl px-4 py-2 text-sm transition ${
                  activeTab === tab ? "bg-emerald-400/20 text-emerald-200" : "text-white/60 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              {filtered.length} tournois trouvés
            </div>
            <SectionTitle eyebrow="Sélection" label="Disponibles maintenant" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {filtered.map((tournament) => (
              <div
                key={tournament.id}
                className="glass-card rounded-3xl border border-white/10 overflow-hidden card-hover"
              >
                <div className="relative h-44 w-full">
                  <img src={tournament.image} alt={tournament.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute left-4 top-4 flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-cyan-400/20 text-cyan-100 px-2 py-1 border border-cyan-300/40">
                      {tournament.tag}
                    </span>
                    <span className="rounded-full bg-amber-400/20 text-amber-100 px-2 py-1 border border-amber-300/40">
                      {tournament.status}
                    </span>
                  </div>
                  <div className="absolute right-4 top-4 rounded-full bg-cyan-400/20 text-cyan-100 px-3 py-1 text-xs border border-cyan-300/40">
                    {tournament.prize}
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">{tournament.title}</h3>
                    <p className="text-sm text-white/60">{tournament.subtitle}</p>
                  </div>

                  <div className="space-y-2 text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-cyan-300" />
                      <span>
                        {tournament.startDate} - {tournament.endDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-300" />
                      <span>Commence aujourd'hui</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-300" />
                      <span>{tournament.participants} participants</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-amber-300" />
                      <span>Frais d'entrée: {tournament.fee}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Participation</span>
                      <span>{tournament.progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${tournament.progress}%` }}
                      />
                    </div>
                  </div>

                  <GlowButton className="w-full justify-center" onClick={() => openModal(tournament)}>
                    S'inscrire
                  </GlowButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-800/80 shadow-2xl">
            <div className="flex justify-between items-start gap-4 p-6 border-b border-white/10">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Inscription</p>
                <h2 className="text-2xl font-black">{selected.title}</h2>
                <p className="text-sm text-white/60">{selected.subtitle}</p>
              </div>
              <button
                aria-label="Fermer"
                onClick={closeModal}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-400/20 text-emerald-100 px-3 py-1 text-xs border border-emerald-300/40">
                      {selected.status}
                    </span>
                    <span className="rounded-full bg-cyan-400/20 text-cyan-100 px-3 py-1 text-xs border border-cyan-300/40">
                      Prix: {selected.prize}
                    </span>
                    <span className="rounded-full bg-amber-400/20 text-amber-100 px-3 py-1 text-xs border border-amber-300/40">
                      Frais: {selected.fee}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-cyan-300" />
                      <span>
                        {selected.startDate} → {selected.endDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-300" />
                      <span>{selected.participants}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Remplissage</span>
                      <span>{selected.progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400"
                        style={{ width: `${selected.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-cyan-500/5 to-emerald-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-white/70">
                        <Sparkles className="h-4 w-4 text-cyan-200" />
                        <span>Confirmation immédiate après paiement sécurisé.</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/70">
                        <Zap className="h-4 w-4 text-amber-200" />
                        <span>Recevez le code salle / ID match par email et notification.</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/70">
                        <Trophy className="h-4 w-4 text-yellow-200" />
                        <span>Classement et récompenses créditées automatiquement.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="rounded-xl overflow-hidden border border-white/10 h-40">
                  <img src={selected.image} alt={selected.title} className="h-full w-full object-cover" />
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Frais d'entrée</span>
                    <span className="font-semibold text-white">{selected.fee}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Jackpot</span>
                    <span className="font-semibold text-emerald-200">{selected.prize}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Places restantes</span>
                    <span className="font-semibold text-white">{selected.participants}</span>
                  </div>
                </div>

                <GlowButton className="w-full justify-center" onClick={handleJoin} disabled={isJoining}>
                  {isJoining ? "Inscription..." : "Confirmer et payer"}
                </GlowButton>
                <button
                  onClick={closeModal}
                  className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:text-white hover:border-white/30 transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
