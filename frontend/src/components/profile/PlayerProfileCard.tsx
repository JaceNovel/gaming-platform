type PlayerProfileCardProps = {
  username: string;
  countryTag: string;
  tierLabel: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export default function PlayerProfileCard({
  username,
  countryTag,
  tierLabel,
  actionLabel = "Wallet BD",
  onAction,
  className = "",
}: PlayerProfileCardProps) {
  const centered = !onAction;
  const cardClassName = [
    "rounded-[28px] border border-white/10 bg-black/45 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.55)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClassName}>
      <div className={centered ? "flex flex-col items-center text-center gap-3" : "flex items-center justify-between gap-4"}>
        <div className={centered ? "flex flex-col items-center" : ""}>
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">Profil joueur</p>
          <div className={`mt-2 flex items-center gap-3 ${centered ? "justify-center" : ""}`}>
            <span className="text-2xl font-black tracking-wide text-white">{username}</span>
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.4em] text-white/80">
              {countryTag}
            </span>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold text-white/90">
            <span role="img" aria-label="Trophée">
              🏆
            </span>
            <span>BADBOY {tierLabel}</span>
          </div>
        </div>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
