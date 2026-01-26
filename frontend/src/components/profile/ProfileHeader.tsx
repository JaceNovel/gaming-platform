"use client";

import Image from "next/image";
import { Wallet } from "lucide-react";

type Avatar = { id: string; name: string; src: string };

type ProfileHeaderProps = {
  username: string;
  countryCode?: string | null;
  tierLabel: string;
  avatar: Avatar;
  walletDisplay: string;
  walletCurrencyLabel: string;
  onChangeAvatar: () => void;
  onAddFunds: () => void;
  onUseFunds: () => void;
};

export default function ProfileHeader({
  username,
  countryCode,
  tierLabel,
  avatar,
  walletDisplay,
  walletCurrencyLabel,
  onChangeAvatar,
  onAddFunds,
  onUseFunds,
}: ProfileHeaderProps) {
  const safeCode = (countryCode ?? "FR").toUpperCase();
  const countryTag = safeCode.length === 2 ? safeCode : "FR";

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-black/35 backdrop-blur-xl shadow-[0_30px_120px_rgba(95,45,255,0.35)]">
      <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_20%_15%,rgba(180,70,255,0.35),transparent_40%),radial-gradient(circle_at_75%_35%,rgba(0,255,255,0.25),transparent_45%),radial-gradient(circle_at_55%_85%,rgba(255,160,0,0.18),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.8))]" />

      <div className="relative p-6 md:p-10">

        <div className="grid gap-8 lg:grid-cols-[320px_1fr] items-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-56 w-56 md:h-72 md:w-72 rounded-[32px] bg-white/5 border border-white/10 overflow-hidden">
              <Image src={avatar.src} alt={avatar.name} fill className="object-cover" priority />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.65),transparent_55%)]" />
            </div>
            <button
              onClick={onChangeAvatar}
              className="hidden w-full max-w-[260px] px-4 py-2 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition text-sm md:block"
            >
              Changer de personnage
            </button>
            <p className="text-xs text-white/70 md:hidden">Choisis ton personnage depuis un ordinateur.</p>
          </div>

          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.35em] text-white/60">Profil joueur</div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-1 text-sm font-semibold tracking-[0.4em]">
                {countryTag}
              </span>
              <div className="text-4xl md:text-6xl font-black tracking-[0.12em]">{username.toUpperCase()}</div>
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-1 text-sm font-semibold tracking-[0.4em]">
                {countryTag}
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-yellow-500/15 border border-yellow-300/25">
              <span>🏆</span>
              <span className="text-sm font-semibold">BADBOY {tierLabel}</span>
            </div>

            <div className="mt-7 rounded-3xl bg-white/8 border border-white/10 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm font-semibold opacity-90 flex items-center justify-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-200" /> BADBOY Wallet BD
                </div>
                <div className="mt-2 text-3xl md:text-4xl font-black">{walletDisplay}</div>
                <p className="mt-2 text-xs text-white/70">Affiché en {walletCurrencyLabel}.</p>
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
