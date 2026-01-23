type Props = {
  label: string;
  value: string;
  className?: string;
};

export default function StatPill({ label, value, className }: Props) {
  return (
    <div
      className={`glass-strong rounded-full border border-white/10 px-3 py-2 text-xs flex items-center gap-2 ${
        className ?? ""
      }`}
    >
      <span className="text-white/60 uppercase tracking-[0.2em]">{label}</span>
      <span className="font-semibold text-cyan-200">{value}</span>
    </div>
  );
}
