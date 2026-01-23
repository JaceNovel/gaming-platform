import clsx from "clsx";
import React from "react";

type Props = {
  title: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  glow?: boolean;
  className?: string;
};

export default function StatCard({ title, value, hint, icon, glow, className }: Props) {
  return (
    <div
      className={clsx(
        "glass-card rounded-2xl p-4 border border-white/10 relative overflow-hidden",
        glow && "shadow-[0_10px_40px_rgba(110,231,255,0.25)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="h-10 w-10 rounded-xl bg-white/5 grid place-items-center text-cyan-200">{icon}</div>}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">{title}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {hint && <p className="text-xs text-white/50 mt-1">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
