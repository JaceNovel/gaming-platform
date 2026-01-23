type Props = {
  label: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
};

export default function SectionTitle({ label, eyebrow, action, className }: Props) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className ?? ""}`}>
      <div>
        {eyebrow && <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">{eyebrow}</p>}
        <h3 className="text-lg font-bold leading-tight">{label}</h3>
      </div>
      {action}
    </div>
  );
}
