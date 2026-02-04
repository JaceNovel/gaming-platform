import clsx from "clsx";

type Level = "Bronze" | "Or" | "Platine";

type Props = {
  level: Level;
  className?: string;
};

const map: Record<Level, { bg: string; text: string; ring: string }> = {
  Bronze: {
    bg: "from-cyan-500/55 via-cyan-400/25 to-white/5",
    text: "text-cyan-100",
    ring: "shadow-[0_0_18px_rgba(110,231,255,0.22)]",
  },
  Or: {
    bg: "from-cyan-300 via-cyan-200 to-white/10",
    text: "text-slate-900",
    ring: "shadow-[0_0_22px_rgba(110,231,255,0.3)]",
  },
  Platine: {
    bg: "from-cyan-200 via-cyan-100 to-white/20",
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
