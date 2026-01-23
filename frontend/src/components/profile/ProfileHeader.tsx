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

const flagUrl = (cc: string, w = 48) => {
  const code = (cc || "FR").toLowerCase();
  const size = w <= 20 ? 20 : w <= 40 ? 40 : 80;
  return `https://flagcdn.com/w${size}/${code}.png`;
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

  return (
    <div className="rounded-[32px] bg-black/35 border border-white/10 backdrop-blur-xl overflow-hidden relative">
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_15%_25%,rgba(180,70,255,0.35),transparent_40%),radial-gradient(circle_at_75%_45%,rgba(0,255,255,0.22),transparent_45%),radial-gradient(circle_at_55%_85%,rgba(255,160,0,0.12),transparent_45%)]" />
      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="shrink-0">
            <div className="relative h-44 w-44 md:h-52 md:w-52 rounded-[28px] bg-white/5 border border-white/10 overflow-hidden">
                <Image src={avatar.src} alt={avatar.name} fill className="object-cover" priority />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent_60%)]" />
            </div>
            <button
              onClick={onChangeAvatar}
              className="mt-3 w-full px-4 py-2 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition text-sm"
            >
              Changer de personnage
            </button>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="text-xs opacity-70 mb-1">Profil joueur</div>

            <div className="flex items-center justify-center md:justify-start gap-3">
              <Image
                src={flagUrl(safeCode, 48)}
                alt={safeCode}
                width={40}
                height={30}
                className="rounded-md border border-white/15"
              />
              <div className="text-3xl md:text-4xl font-black tracking-wide">
                {username.toUpperCase()}
              </div>
              <Image
                src={flagUrl(safeCode, 48)}
                alt={safeCode}
                width={40}
                height={30}
                className="rounded-md border border-white/15"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">🔒 Sécurité sécurisée</span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">⚡ Livraison instantanée</span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">🧠 Anti-fraude actif</span>
            </div>

            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/15 border border-yellow-300/20">
              <span>🏆</span>
              <span className="text-sm font-semibold">BADBOY {premiumTier}</span>
            </div>
          </div>
        </div>

        <div className="mt-7 rounded-3xl bg-white/5 border border-white/10 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm font-semibold opacity-90 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-200" /> BADBOY Wallet BD
            </div>
            <div className="mt-1 text-3xl font-black">{formatFcfa(walletBalance)}</div>
            <ul className="mt-2 text-xs opacity-70 space-y-1">
              <li>• Fonds utilisables pour achats & recharges</li>
              <li>• Anti-fraude : contrôle IP/Device</li>
            </ul>
          </div>
          <div className="flex gap-3">
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
  );
}
