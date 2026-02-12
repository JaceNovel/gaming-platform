"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type AccessoryCategoryKey = "audio" | "keyboard_mouse" | "mobile" | "setup_comfort";

type AccessoryProduct = {
  id: number;
  name?: string | null;
  title?: string | null;
  price?: number | string | null;
  discount_price?: number | string | null;
  shipping_fee?: number | string | null;
  type?: string | null;
  accessory_category?: string | null;
  accessory_subcategory?: string | null;
  accessory_stock_mode?: "local" | "air" | "sea" | string | null;
  delivery_eta_days?: number | null;
  delivery_estimate_label?: string | null;
  is_active?: boolean | null;
  details?: { image?: string | null; cover?: string | null; banner?: string | null } | null;
  image_url?: string | null;
  cover?: string | null;
  banner?: string | null;
  images?: Array<{ url?: string | null; path?: string | null } | string> | null;
};

const CATEGORY_ORDER: Array<{ key: AccessoryCategoryKey; label: string; navLabel: string }> = [
  { key: "audio", label: "Audio Gaming", navLabel: "🎧 Audio Gaming" },
  { key: "keyboard_mouse", label: "Clavier & Souris", navLabel: "🖱️ Clavier & Souris" },
  { key: "mobile", label: "Mobile Gaming", navLabel: "🎮 Mobile Gaming" },
  { key: "setup_comfort", label: "Setup & Confort", navLabel: "🪑 Setup & Confort" },
];

const formatFcfa = (value: number) => `${Math.round(Math.max(0, value)).toLocaleString("fr-FR")} FCFA`;

const parseNumber = (value: any): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const productDisplayName = (p: AccessoryProduct) => String(p.title ?? p.name ?? "Produit").trim() || "Produit";

const extractImage = (p: AccessoryProduct): string | null => {
  if (p.image_url) return p.image_url;
  const images = Array.isArray(p.images) ? p.images : [];
  if (images.length) {
    const first = images[0];
    if (typeof first === "string") return first;
    return first?.url ?? first?.path ?? null;
  }
  if (p.details?.image) return p.details.image;
  if (p.cover) return p.cover;
  if (p.banner) return p.banner;
  if (p.details?.cover) return p.details.cover;
  if (p.details?.banner) return p.details.banner;
  return null;
};

const normalizeCategoryKey = (value: any): AccessoryCategoryKey | null => {
  const key = String(value ?? "").trim().toLowerCase();
  if (key === "audio") return "audio";
  if (key === "keyboard_mouse" || key === "keyboard" || key === "mouse") return "keyboard_mouse";
  if (key === "mobile") return "mobile";
  if (key === "setup_comfort" || key === "setup" || key === "comfort") return "setup_comfort";
  return null;
};

const defaultDeliveryEstimate = (p: AccessoryProduct): string => {
  const admin = String(p.delivery_estimate_label ?? "").trim();
  if (admin) return admin;

  const mode = String(p.accessory_stock_mode ?? "local").toLowerCase();
  if (mode === "air") return "≈ 2–3 semaines";
  if (mode === "sea") return "≈ 30–45 jours";
  const eta = Number(p.delivery_eta_days ?? 0);
  if (Number.isFinite(eta) && eta > 0) return `${eta} jour${eta > 1 ? "s" : ""}`;
  return "—";
};

function HeroBackdrop() {
  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      <div className="absolute inset-0 bg-black" />

      <div
        className="absolute inset-0 bg-cover bg-center opacity-55"
        style={{ backgroundImage: "url('/images/WhatsApp Image 2026-02-06 at 03.44.47.jpeg')" }}
      />

      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl motion-safe:animate-pulse" />
      <div className="absolute top-16 right-[-60px] h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl motion-safe:animate-pulse" />
      <div className="absolute bottom-[-80px] left-[20%] h-80 w-80 rounded-full bg-amber-400/10 blur-3xl motion-safe:animate-pulse" />

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-black" />
    </div>
  );
}

export default function AccessoiresPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<AccessoryProduct[]>([]);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          active: "1",
          per_page: "200",
          shop_type: "accessory",
          sort: "recent",
        });
        const res = await fetch(`${API_BASE}/products?${qs.toString()}`, { headers: { Accept: "application/json" } });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les accessoires");

        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.data) ? payload.data.data : [];
        const items = (Array.isArray(rows) ? rows : []) as AccessoryProduct[];
        const onlyAccessories = items
          .filter((p) => Boolean(normalizeCategoryKey(p?.accessory_category)))
          .filter((p) => String(p?.type ?? "").toLowerCase() === "item");

        if (!active) return;
        setProducts(onlyAccessories);
      } catch (e: any) {
        if (!active) return;
        setProducts([]);
        setError(e?.message ?? "Impossible de charger");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const byCat: Record<AccessoryCategoryKey, AccessoryProduct[]> = {
      audio: [],
      keyboard_mouse: [],
      mobile: [],
      setup_comfort: [],
    };
    for (const p of products) {
      const key = normalizeCategoryKey(p.accessory_category);
      if (!key) continue;
      byCat[key].push(p);
    }
    return byCat;
  }, [products]);

  const handleScrollTo = (key: AccessoryCategoryKey) => {
    const el = sectionRefs.current[key];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen text-white">
      <HeroBackdrop />

      <main className="w-full px-5 md:px-10 lg:px-12 py-10">
        <div className="mx-auto w-full max-w-6xl">
          <header className="p-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">Catalogue</p>
                <h1 className="mt-1 text-2xl md:text-3xl font-semibold">Accessoires Gaming</h1>
                <p className="mt-2 text-sm text-white/60">Prix & livraison clairs, avant paiement.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORY_ORDER.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => handleScrollTo(c.key)}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
                  >
                    {c.navLabel}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="mt-6 space-y-8">
            {error && (
              <div className="rounded-[28px] border border-rose-300/30 bg-rose-500/10 p-5 text-sm text-rose-100">
                {error}
              </div>
            )}

            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat.key] ?? [];
              return (
                <section
                  key={cat.key}
                  ref={(node) => {
                    sectionRefs.current[cat.key] = node;
                  }}
                  className="space-y-4"
                >
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="text-lg md:text-xl font-semibold">{cat.label}</h2>
                      <p className="mt-1 text-sm text-white/55">Défile horizontalement pour voir tout.</p>
                    </div>
                    <Link
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleScrollTo(cat.key);
                      }}
                      className="text-sm font-semibold text-cyan-100 hover:text-cyan-50"
                    >
                      Revenir ici
                    </Link>
                  </div>

                  <div className="p-1">
                    {loading ? (
                      <div className="animate-pulse grid gap-3">
                        <div className="h-4 w-2/3 rounded bg-white/10" />
                        <div className="h-24 w-full rounded bg-white/10" />
                      </div>
                    ) : items.length === 0 ? (
                      <div className="text-sm text-white/60">Aucun produit pour le moment.</div>
                    ) : (
                      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-soft">
                        {items.map((p) => {
                          const name = productDisplayName(p);
                          const img = extractImage(p);
                          const imgSrc = img ? (toDisplayImageSrc(img) ?? img) : null;
                          const price = parseNumber(p.discount_price ?? p.price);
                          return (
                            <Link
                              key={p.id}
                              href={`/produits/${encodeURIComponent(String(p.id))}`}
                              className="snap-start w-[220px] sm:w-[280px] flex-none overflow-hidden rounded-[22px] border border-white/15 bg-white/5 backdrop-blur transition hover:bg-white/10"
                            >
                              <div className="relative h-28 w-full bg-black/30">
                                {imgSrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={imgSrc} alt={name} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="grid h-full w-full place-items-center bg-white/10 text-sm text-white/70">🛒</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                                <div className="absolute left-3 top-3">
                                  <span className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/85">
                                    {cat.label}
                                  </span>
                                </div>
                              </div>

                              <div className="p-3">
                                <h3 className="text-sm font-semibold text-white line-clamp-2">{name}</h3>
                                {p.accessory_subcategory ? (
                                  <p className="mt-1 text-xs text-white/60 line-clamp-1">{p.accessory_subcategory}</p>
                                ) : null}
                                <div className="mt-2 flex items-end justify-between gap-2">
                                  <p className="text-base font-black text-cyan-200">{formatFcfa(price)}</p>
                                  <p className="text-[11px] text-white/55">{defaultDeliveryEstimate(p)}</p>
                                </div>
                              </div>

                              <div className="px-3 pb-3">
                                <div className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-center text-xs font-semibold text-white/80">
                                  Voir le détail
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
