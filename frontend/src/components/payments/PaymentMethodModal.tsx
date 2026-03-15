"use client";

import { useEffect } from "react";
import { Check, ShieldCheck, X } from "lucide-react";

export type PaymentMethodOption = {
  key: string;
  title: string;
  description: string;
  badge?: string;
  variant: "paypal" | "mobile_money" | "wallet" | "reward_wallet" | "bank_card";
  disabled?: boolean;
  disabledReason?: string;
};

type PaymentMethodModalProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  amountLabel?: string;
  options: PaymentMethodOption[];
  value: string;
  loading?: boolean;
  status?: string | null;
  confirmLabel: string;
  onChange: (key: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const visualByVariant: Record<PaymentMethodOption["variant"], { image: string; label: string }> = {
  mobile_money: {
    image: "https://img.icons8.com/?size=100&id=YsVvEs0F7slI&format=png&color=000000",
    label: "Mobile money",
  },
  paypal: {
    image: "https://img.icons8.com/?size=100&id=13611&format=png&color=000000",
    label: "PayPal",
  },
  wallet: {
    image: "https://img.icons8.com/?size=100&id=13016&format=png&color=000000",
    label: "Wallet",
  },
  reward_wallet: {
    image: "https://img.icons8.com/?size=100&id=13016&format=png&color=000000",
    label: "Wallet",
  },
  bank_card: {
    image: "https://img.icons8.com/?size=100&id=44779&format=png&color=000000",
    label: "Carte bancaire",
  },
};

function BrandBadge({ option }: { option: PaymentMethodOption }) {
  const visual = visualByVariant[option.variant];

  return (
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#fbfbfb] px-3 py-2.5 text-center shadow-[0_3px_10px_rgba(15,23,42,0.04)] sm:h-[104px] sm:w-[140px] sm:flex-col sm:gap-2 sm:px-4 sm:py-3">
      <img src={visual.image} alt={visual.label} className="h-8 w-8 object-contain sm:h-9 sm:w-9" loading="lazy" referrerPolicy="no-referrer" />
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">{visual.label}</span>
    </div>
  );
}

export default function PaymentMethodModal({
  open,
  title = "Moyens de paiement",
  subtitle = "Nous protégeons vos informations de paiement.",
  amountLabel,
  options,
  value,
  loading = false,
  status,
  confirmLabel,
  onChange,
  onClose,
  onConfirm,
}: PaymentMethodModalProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onClose, open]);

  if (!open) return null;

  const selectedOption = options.find((option) => option.key === value) ?? options[0] ?? null;
  const confirmDisabled = loading || !selectedOption || Boolean(selectedOption.disabled);

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : onClose}>
      <div className="flex min-h-full items-end justify-center p-0 md:items-center md:p-6">
        <div
          className="w-full overflow-hidden rounded-t-[30px] bg-[#fdfcf9] text-slate-900 shadow-[0_32px_80px_rgba(15,23,42,0.24)] md:max-w-5xl md:rounded-[32px]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-200/80 px-4 pb-4 pt-3 sm:px-6 md:px-8">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-200 md:hidden" />
            <div className="relative flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1 pr-12 text-center sm:pr-14">
                <p className="text-[1.9rem] font-black leading-none tracking-tight sm:text-[2.1rem]">{title}</p>
                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 sm:text-sm">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-2 text-left sm:truncate">{subtitle}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="max-h-[76dvh] overflow-y-auto px-4 py-4 sm:px-6 md:px-8 md:py-7">
            <div className="space-y-3 sm:space-y-4">
              {options.map((option) => {
                const selected = option.key === value;
                const disabled = Boolean(option.disabled);

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      if (!disabled) onChange(option.key);
                    }}
                    disabled={disabled || loading}
                    className={[
                      "grid min-h-[92px] w-full grid-cols-[28px_72px_minmax(0,1fr)] items-center gap-3 rounded-[24px] border bg-white px-3 py-3 text-left transition sm:grid-cols-[42px_140px_minmax(0,1fr)] sm:gap-5 sm:px-6 sm:py-5",
                      selected ? "border-slate-900 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5" : "border-slate-200 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
                      disabled ? "cursor-not-allowed opacity-55" : "",
                    ].join(" ")}
                  >
                    <div className={[
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white transition sm:h-10 sm:w-10",
                      selected ? "border-slate-900" : "border-slate-300",
                    ].join(" ")}>
                      {selected ? <Check className="h-4 w-4 text-slate-900 sm:h-5 sm:w-5" /> : null}
                    </div>

                    <BrandBadge option={option} />

                    <div className="min-w-0 self-center">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-base font-bold leading-tight text-slate-900 sm:text-[1.35rem]">{option.title}</span>
                        {option.badge ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-3 sm:text-xs">
                            {option.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500 sm:mt-2 sm:max-w-[42rem] sm:text-[1.02rem]">{option.description}</p>
                      {disabled && option.disabledReason ? <p className="mt-2 text-xs font-semibold text-rose-500 sm:text-sm">{option.disabledReason}</p> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-white px-4 py-4 sm:px-6 md:px-8 md:py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sélection</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 sm:text-base">{selectedOption?.title ?? "Choisis un moyen de paiement"}</p>
                {amountLabel ? <p className="mt-1 text-sm text-slate-500 sm:text-base">{amountLabel}</p> : null}
                {status ? <p className="mt-2 text-sm text-amber-600">{status}</p> : null}
              </div>

              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 md:min-w-[240px] md:w-auto"
              >
                {loading ? "Traitement..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}