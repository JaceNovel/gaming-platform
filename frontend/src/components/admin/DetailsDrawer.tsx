"use client";

import { useEffect } from "react";

type DetailsDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
};

export default function DetailsDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClassName,
}: DetailsDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={
        "fixed inset-0 z-[80] " +
        (open ? "pointer-events-auto" : "pointer-events-none")
      }
      aria-hidden={!open}
    >
      <div
        className={
          "absolute inset-0 bg-black/40 transition-opacity duration-200 " +
          (open ? "opacity-100" : "opacity-0")
        }
        onClick={onClose}
      />

      <aside
        className={
          "absolute right-0 top-0 h-full w-full border-l border-slate-200 bg-white shadow-[0_20px_80px_rgba(0,0,0,0.25)] transition-transform duration-300 " +
          (widthClassName ?? "max-w-[560px]") +
          " " +
          (open ? "translate-x-0" : "translate-x-full")
        }
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-slate-900">{title}</div>
                {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-5 py-5">{children}</div>

          {footer ? <div className="border-t border-slate-200 px-5 py-4">{footer}</div> : null}
        </div>
      </aside>
    </div>
  );
}
