type Props = {
  label: string;
  variant?: "cyan" | "purple" | "gold" | "neutral";
  className?: string;
};

const variants: Record<NonNullable<Props["variant"]>, string> = {
  cyan: "bg-cyan-400/15 text-cyan-200 border-cyan-300/30",
  purple: "bg-purple-400/15 text-purple-200 border-purple-300/30",
  gold: "bg-amber-400/15 text-amber-200 border-amber-300/30",
  neutral: "bg-white/10 text-white/70 border-white/10",
};

export default function Badge({ label, variant = "neutral", className }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${
        variants[variant]
      } ${className ?? ""}`}
    >
      {label}
    </span>
  );
}
