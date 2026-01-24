"use client";

import Image from "next/image";
import { Wallet } from "lucide-react";

type Avatar = { id: string; name: string; src: string };

type ProfileHeaderProps = {
  username: string;
  countryCode?: string | null;
  premiumTier: string;
  avatar: Avatar;
  walletBalance: number;
  onChangeAvatar: () => void;
  onAddFunds: () => void;
  onUseFunds: () => void;
};

const flagEmoji = (cc: string) => {
  const code = (cc || "FR").toUpperCase();
  if (code.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(...code.split("").map((c) => A + c.charCodeAt(0) - 65));
};

const formatFcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export default function ProfileHeader({
  username,
  countryCode,
  premiumTier,
  avatar,
  walletBalance,
  onChangeAvatar,
  onAddFunds,
  onUseFunds,
}: ProfileHeaderProps) {
  const safeCode = countryCode || "FR";
  const flag = flagEmoji(safeCode);

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-black/35 backdrop-blur-xl shadow-[0_30px_120px_rgba(95,45,255,0.35)]">
      <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_20%_15%,rgba(180,70,255,0.35),transparent_40%),radial-gradient(circle_at_75%_35%,rgba(0,255,255,0.25),transparent_45%),radial-gradient(circle_at_55%_85%,rgba(255,160,0,0.18),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.8))]" />

      <div className="relative p-6 md:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-xs">
          <span className="px-3 py-1 rounded-full bg-white/8 border border-white/15">🔒 Sécurité sécurisée</span>
          <span className="px-3 py-1 rounded-full bg-white/8 border border-white/15">⚡ Livraison instantanée</span>
          <span className="px-3 py-1 rounded-full bg-white/8 border border-white/15">🧠 Anti-fraude actif</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr] items-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-56 w-56 md:h-72 md:w-72 rounded-[32px] bg-white/5 border border-white/10 overflow-hidden">
              <Image src={avatar.src} alt={avatar.name} fill className="object-cover" priority />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.65),transparent_55%)]" />
            </div>
            <button
              onClick={onChangeAvatar}
              className="w-full max-w-[260px] px-4 py-2 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition text-sm"
            >
              Changer de personnage
            </button>
          </div>

          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.35em] text-white/60">Profil joueur</div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <span className="text-3xl">{flag}</span>
              <div className="text-4xl md:text-6xl font-black tracking-[0.12em]">{username.toUpperCase()}</div>
              <span className="text-3xl">{flag}</span>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-yellow-500/15 border border-yellow-300/25">
              <span>🏆</span>
              <span className="text-sm font-semibold">BADBOY {premiumTier}</span>
            </div>

            <div className="mt-7 rounded-3xl bg-white/8 border border-white/10 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm font-semibold opacity-90 flex items-center justify-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-200" /> BADBOY Wallet BD
                </div>
                <div className="mt-2 text-3xl md:text-4xl font-black">{formatFcfa(walletBalance)}</div>
                <ul className="mt-2 text-xs opacity-70 space-y-1">
                  <li>• Fonds utilisables pour achats & recharges</li>
                  <li>• Anti-fraude : contrôle IP/Device</li>
                </ul>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={onAddFunds}
                  className="px-4 py-2 rounded-2xl bg-yellow-500/20 border border-yellow-300/20 hover:bg-yellow-500/25 transition text-sm"
                >
                  Ajouter des fonds
                </button>
                <button
                  onClick={onUseFunds}
                  className="px-4 py-2 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition text-sm"
                >
                  Utiliser mes fonds
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
