"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { CART_UPDATED_EVENT } from "@/lib/cartEvents";

type CartItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  priceLabel?: string;
  quantity: number;
  type?: string;
  displaySection?: string | null;
  deliveryEstimateLabel?: string | null;
  deliveryLabel?: string;
  gameId?: string;
};

const DISMISSED_KEY = "bbshop_cart_drawer_dismissed";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem("bbshop_cart");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("bbshop_cart", JSON.stringify(items));
}

function getDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISMISSED_KEY) === "1";
}

function setDismissed(next: boolean) {
  if (typeof window === "undefined") return;
  if (next) window.localStorage.setItem(DISMISSED_KEY, "1");
  else window.localStorage.removeItem(DISMISSED_KEY);
}

export default function CartDrawer() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissedState] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setDismissedState(getDismissed());
  }, []);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0) || 0), 0),
    [items]
  );
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.price ?? 0) || 0) * (Number(item.quantity ?? 0) || 0), 0),
    [items]
  );

  useEffect(() => {
    const onCartUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ action?: string }>;
      const action = String(custom.detail?.action ?? "").toLowerCase();
      const prevCount = itemCount;
      const next = readCart();
      const nextCount = next.reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0) || 0), 0);

      setItems(next);

      if (action === "add" && prevCount === 0 && nextCount > 0 && !getDismissed()) {
        setOpen(true);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "bbshop_cart" && event.key !== DISMISSED_KEY) return;
      setItems(readCart());
      setDismissedState(getDismissed());
    };

    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [itemCount]);

  const handleClose = () => {
    setOpen(false);
    setDismissed(true);
    setDismissedState(true);
  };

  const handleToggle = () => {
    if (open) {
      handleClose();
      return;
    }
    setOpen(true);
  };

  const removeItem = (id: number) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    writeCart(next);
  };

  const updateQuantity = (id: number, nextQuantity: number) => {
    const q = Math.max(1, Number(nextQuantity || 1));
    const next = items.map((item) => (item.id === id ? { ...item, quantity: q } : item));
    setItems(next);
    writeCart(next);
  };

  const arrowVisible = itemCount > 0;

  return (
    <>
      {/* Persistent arrow tab (also the cart-flight target) */}
      <button
        type="button"
        data-cart-target="drawer"
        aria-label={open ? "Fermer le panier" : "Ouvrir le panier"}
        onClick={handleToggle}
        className={
          "fixed right-0 top-1/2 z-[90] -translate-y-1/2 rounded-l-2xl border border-white/10 bg-black/70 px-3 py-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur transition " +
          (arrowVisible ? "opacity-100" : "opacity-[0.01] pointer-events-none")
        }
      >
        <div className="flex items-center gap-2">
          <span className="text-lg font-black leading-none">{open ? "→" : "←"}</span>
          {arrowVisible ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/85 ring-1 ring-white/10">
              {itemCount}
            </span>
          ) : null}
        </div>
      </button>

      {/* Slide-in drawer */}
      <aside
        className={
          "fixed right-0 top-0 z-[95] h-[100dvh] w-[340px] max-w-[92vw] border-l border-white/10 bg-black/85 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur transition-transform duration-300 " +
          (open ? "translate-x-0" : "translate-x-full")
        }
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col pt-[70px] lg:pt-[112px]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-extrabold text-white">Panier</div>
              <div className="text-xs font-semibold text-white/60">
                {itemCount > 0 ? `${itemCount} article${itemCount > 1 ? "s" : ""}` : "Aucun article"}
                {dismissed ? " · auto-off" : ""}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-white/80 ring-1 ring-white/10 hover:bg-white/10"
            >
              Fermer
            </button>
          </div>

          <div className="flex-1 overflow-auto px-4 py-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-white/70">
                Ton panier est vide.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-white">{item.name}</div>
                        <div className="mt-0.5 text-xs font-semibold text-white/60">
                          {item.priceLabel ?? `${Number(item.price ?? 0).toLocaleString("fr-FR")} FCFA`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-4 w-4 text-white/75" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-bold text-white/70">Quantité</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, Number(item.quantity ?? 1) - 1)}
                          className="h-8 w-8 rounded-xl bg-white/5 text-sm font-black text-white/80 ring-1 ring-white/10 hover:bg-white/10"
                          aria-label="Diminuer"
                        >
                          −
                        </button>
                        <div className="min-w-[32px] text-center text-sm font-extrabold text-white">
                          {Number(item.quantity ?? 1) || 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, Number(item.quantity ?? 1) + 1)}
                          className="h-8 w-8 rounded-xl bg-white/5 text-sm font-black text-white/80 ring-1 ring-white/10 hover:bg-white/10"
                          aria-label="Augmenter"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-4">
            <div className="flex items-center justify-between text-sm font-extrabold text-white">
              <span>Sous-total</span>
              <span>{subtotal.toLocaleString("fr-FR")} FCFA</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/cart"
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-extrabold text-white/85 ring-1 ring-white/10 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                Voir panier
              </Link>
              <Link
                href="/cart"
                className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold text-white ring-1 ring-white/15 hover:bg-white/15"
                onClick={() => setOpen(false)}
              >
                Commander
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
