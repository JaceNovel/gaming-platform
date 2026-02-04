import React from "react";

type GlowButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export default function GlowButton({
  className,
  variant = "primary",
  children,
  ...props
}: GlowButtonProps) {
  const variants: Record<NonNullable<GlowButtonProps["variant"]>, string> = {
    primary:
      "bg-gradient-to-r from-cyan-300 to-cyan-400 text-black shadow-[0_0_30px_rgba(110,231,255,0.35)]",
    secondary:
      "bg-white/10 text-white border border-white/15 backdrop-blur hover:border-white/25",
    ghost: "bg-transparent text-white border border-white/10 hover:border-white/25",
  };

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70";
  const classes = [base, variants[variant], className].filter(Boolean).join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
