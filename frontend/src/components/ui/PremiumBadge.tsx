import clsx from "clsx";

type Level = "Bronze" | "Or" | "Platine";

type Props = {
  level: Level;
  className?: string;
};

const map: Record<Level, { bg: string; text: string; ring: string }> = {
  Bronze: {
    bg: "from-amber-600/70 via-amber-500/40 to-yellow-400/20",
    text: "text-amber-200",
    ring: "shadow-[0_0_20px_rgba(251,191,36,0.35)]",
  },
  Or: {
    bg: "from-yellow-400 via-amber-300 to-orange-200",
    text: "text-amber-900",
    ring: "shadow-[0_0_25px_rgba(251,191,36,0.45)]",
  },
  Platine: {
    bg: "from-cyan-300 via-sky-200 to-blue-200",
    text: "text-slate-900",
    ring: "shadow-[0_0_25px_rgba(56,189,248,0.4)]",
  },
};

export default function PremiumBadge({ level, className }: Props) {
  const styles = map[level];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
        "bg-gradient-to-r",
        styles.bg,
        styles.text,
        styles.ring,
        className,
      )}
    >
      {level}
    </span>
  );
}
