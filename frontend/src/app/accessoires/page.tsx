"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import { emitCartUpdated } from "@/lib/cartEvents";
import { buildGroupedDeliveryMessages, parseGroupedNumber } from "@/lib/groupedDeliveryMessaging";
import { buildMapsUrlFromCoords, isValidShippingInfo, readShippingInfo, writeShippingInfo } from "@/lib/shippingInfo";

type AccessoryCategoryKey = "audio" | "keyboard_mouse" | "mobile" | "setup_comfort";

type AccessoryProduct = {
  id: number;
  name?: string | null;
  title?: string | null;
  price?: number | string | null;
  discount_price?: number | string | null;
  computed_final_price?: number | string | null;
  computed_transport_unit_fee?: number | string | null;
  shipping_fee?: number | string | null;
  grouping_progress_label?: string | null;
  grouping_remaining_value?: number | string | null;
  free_shipping_eligible?: boolean | null;
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

const parseNumber = (value: any): number => parseGroupedNumber(value);

const normalizeSearchText = (value: any): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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

const getCustomerDeliveryText = (product: AccessoryProduct): string => {
  return buildGroupedDeliveryMessages({
    shippingFee: product.shipping_fee,
    remainingValue: product.grouping_remaining_value,
    freeShippingEligible: product.free_shipping_eligible,
  }).short;
};

const matchesSearch = (product: AccessoryProduct, query: string): boolean => {
  if (!query) return true;

  const haystack = [
    product.title,
    product.name,
    product.accessory_subcategory,
    product.accessory_category,
  ]
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .join(" ");

  return haystack.includes(query);
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

const logisticsBadge = (modeRaw: any): { label: string; tone: "green" | "cyan" | "amber" } => {
  const mode = String(modeRaw ?? "local").toLowerCase();
  if (mode === "air") return { label: "✈️ Import aérien (≈ 2–3 semaines)", tone: "cyan" };
  if (mode === "sea") return { label: "🚢 Import bateau (≈ 30–45 jours)", tone: "amber" };
  return { label: "🟢 Prêt à être livré", tone: "green" };
};

function addToCart(product: AccessoryProduct) {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem("bbshop_cart");
  let cart: Array<any> = [];
  try {
    cart = raw ? JSON.parse(raw) : [];
  } catch {
    cart = [];
  }

  const id = Number(product.id);
  const name = productDisplayName(product);
  const unitPrice = parseNumber(product.computed_final_price ?? product.discount_price ?? product.price);
  const shippingFee = parseNumber(product.shipping_fee);

  const existing = cart.find((it: any) => Number(it?.id) === id);
  if (existing) {
    existing.quantity = Math.max(1, Number(existing.quantity ?? 1) + 1);
    existing.shippingFee = shippingFee;
    existing.groupingProgressLabel = String(product.grouping_progress_label ?? "").trim() || undefined;
    existing.groupingRemainingValue = parseNumber(product.grouping_remaining_value);
  } else {
    cart.push({
      id,
      name,
      price: unitPrice,
      priceLabel: formatFcfa(unitPrice),
      quantity: 1,
      type: String(product.type ?? "item"),
      shippingFee,
      groupingProgressLabel: String(product.grouping_progress_label ?? "").trim() || undefined,
      groupingRemainingValue: parseNumber(product.grouping_remaining_value),
      accessoryCategory: product.accessory_category ?? null,
      accessoryStockMode: product.accessory_stock_mode ?? null,
      deliveryEstimateLabel: product.delivery_estimate_label ?? null,
    });
  }

  window.localStorage.setItem("bbshop_cart", JSON.stringify(cart));
  emitCartUpdated({ action: "add" });
}

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<AccessoryProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [shippingOpen, setShippingOpen] = useState(false);
  const [shippingMapsUrl, setShippingMapsUrl] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingStatus, setShippingStatus] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ kind: "buy" | "cart"; product: AccessoryProduct } | null>(null);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const searchCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const existing = readShippingInfo();
    if (!existing) return;
    setShippingMapsUrl(existing.mapsUrl ?? "");
    setShippingCity(existing.city ?? "");
    setShippingPhone(existing.phone ?? "");
  }, []);

  useEffect(() => {
    return () => {
      if (searchCloseTimeoutRef.current) {
        clearTimeout(searchCloseTimeoutRef.current);
      }
    };
  }, []);

  const persistShipping = () => {
    writeShippingInfo({ mapsUrl: shippingMapsUrl.trim(), city: shippingCity.trim(), phone: shippingPhone.trim() });
  };

  const fillCurrentPosition = async () => {
    setShippingStatus(null);
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setShippingStatus("La géolocalisation n'est pas supportée sur cet appareil.");
      return;
    }
    setShippingStatus("Récupération de la position...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const url = buildMapsUrlFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (!url) {
          setShippingStatus("Position invalide.");
          return;
        }
        setShippingMapsUrl(url);
        setShippingStatus("Position ajoutée.");
      },
      () => {
        setShippingStatus("Impossible de récupérer la position. Autorise la localisation puis réessaie.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const requireShippingThen = (action: { kind: "buy" | "cart"; product: AccessoryProduct }) => {
    const current = { mapsUrl: shippingMapsUrl.trim(), city: shippingCity.trim(), phone: shippingPhone.trim() };
    const stored = readShippingInfo();
    const resolved = isValidShippingInfo(current) ? current : stored;

    if (isValidShippingInfo(resolved)) {
      if (!isValidShippingInfo(current)) {
        setShippingMapsUrl(resolved!.mapsUrl);
        setShippingCity(resolved!.city);
        setShippingPhone(resolved!.phone);
      }
      return true;
    }

    setPendingAction(action);
    setShippingStatus(null);
    setShippingOpen(true);
    return false;
  };

  const continuePendingAction = (action: { kind: "buy" | "cart"; product: AccessoryProduct }) => {
    if (action.kind === "buy") {
      router.push(`/checkout?product=${encodeURIComponent(String(action.product.id))}`);
      return;
    }
    addToCart(action.product);
  };

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

  const filteredProducts = useMemo(() => {
    const query = normalizeSearchText(deferredSearchQuery);
    return products.filter((product) => matchesSearch(product, query));
  }, [deferredSearchQuery, products]);

  const grouped = useMemo(() => {
    const byCat: Record<AccessoryCategoryKey, AccessoryProduct[]> = {
      audio: [],
      keyboard_mouse: [],
      mobile: [],
      setup_comfort: [],
    };
    for (const p of filteredProducts) {
      const key = normalizeCategoryKey(p.accessory_category);
      if (!key) continue;
      byCat[key].push(p);
    }
    return byCat;
  }, [filteredProducts]);

  const searchSuggestions = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) return [] as AccessoryProduct[];

    return filteredProducts
      .slice()
      .sort((left, right) => {
        const leftName = normalizeSearchText(productDisplayName(left));
        const rightName = normalizeSearchText(productDisplayName(right));
        const leftStarts = leftName.startsWith(query) ? 1 : 0;
        const rightStarts = rightName.startsWith(query) ? 1 : 0;

        if (leftStarts !== rightStarts) return rightStarts - leftStarts;
        return leftName.localeCompare(rightName);
      })
      .slice(0, 6);
  }, [filteredProducts, searchQuery]);

  const handleScrollTo = (key: AccessoryCategoryKey) => {
    const el = sectionRefs.current[key];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSuggestionSelect = (product: AccessoryProduct) => {
    const category = normalizeCategoryKey(product.accessory_category);

    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      setSearchQuery(productDisplayName(product));
      setSearchOpen(false);
      if (category) {
        window.setTimeout(() => handleScrollTo(category), 0);
      }
      return;
    }

    router.push(`/produits/${encodeURIComponent(String(product.id))}`);
  };

  return (
    <div className="min-h-screen text-white">
      <HeroBackdrop />

      {shippingOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShippingOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[28px] border border-white/10 bg-black/75 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">Livraison</p>
                <h2 className="mt-1 text-lg font-semibold">Lien Google Maps + Ville + Téléphone</h2>
                <p className="mt-1 text-sm text-white/60">Renseigne une adresse locale claire pour faciliter la livraison finale.</p>
              </div>
              <button
                type="button"
                onClick={() => setShippingOpen(false)}
                className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-white/70">Lien Google Maps *</label>
                <input
                  value={shippingMapsUrl}
                  onChange={(e) => setShippingMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fillCurrentPosition}
                    className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15"
                  >
                    Ma position actuelle
                  </button>
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-xs text-white/70">Ville *</label>
                <input
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="Ex: Douala"
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs text-white/70">Téléphone (WhatsApp) *</label>
                <input
                  value={shippingPhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  placeholder="Ex: 690000000"
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"
                />
              </div>

              {shippingStatus ? <div className="text-sm text-white/70">{shippingStatus}</div> : null}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const info = { mapsUrl: shippingMapsUrl.trim(), city: shippingCity.trim(), phone: shippingPhone.trim() };
                    if (!isValidShippingInfo(info)) {
                      setShippingStatus("Merci de renseigner Lien Maps, Ville et Téléphone.");
                      return;
                    }
                    writeShippingInfo(info);
                    setShippingOpen(false);
                    const action = pendingAction;
                    setPendingAction(null);
                    if (action) continuePendingAction(action);
                  }}
                  className="flex-1 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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

            <div className="relative mt-5 max-w-2xl">
              <div className="flex items-center gap-3 rounded-[24px] border border-white/12 bg-white/8 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <Search className="h-5 w-5 text-cyan-200/85" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (searchCloseTimeoutRef.current) {
                      clearTimeout(searchCloseTimeoutRef.current);
                    }
                    setSearchOpen(true);
                  }}
                  onBlur={() => {
                    searchCloseTimeoutRef.current = setTimeout(() => setSearchOpen(false), 120);
                  }}
                  placeholder="Rechercher un casque, clavier, manette, support..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35 md:text-base"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchOpen(false);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75 transition hover:bg-white/10"
                  >
                    Effacer
                  </button>
                ) : (
                  <span className="hidden items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-100 md:inline-flex">
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggestions en direct
                  </span>
                )}
              </div>

              {searchOpen && searchSuggestions.length > 0 ? (
                <div className="absolute z-20 mt-3 w-full overflow-hidden rounded-[24px] border border-white/12 bg-[#0a0715]/95 p-2 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  {searchSuggestions.map((product) => {
                    const image = extractImage(product);
                    const imageSrc = image ? (toDisplayImageSrc(image) ?? image) : null;
                    const name = productDisplayName(product);
                    const category = normalizeCategoryKey(product.accessory_category);

                    return (
                      <button
                        key={`suggestion-${product.id}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSuggestionSelect(product)}
                        className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition hover:bg-white/8"
                      >
                        <div className="h-12 w-12 flex-none overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                          {imageSrc ? (
                            <img src={imageSrc} alt={name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-xs text-white/55">PG</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{name}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
                            <span>{CATEGORY_ORDER.find((item) => item.key === category)?.label ?? "Accessoire"}</span>
                            <span className="text-cyan-200">{formatFcfa(parseNumber(product.discount_price ?? product.price))}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </header>

          <div className="mt-6 space-y-8">
            {!loading && searchQuery.trim() && filteredProducts.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                Aucun produit ne correspond à ta recherche.
              </div>
            ) : null}

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
                      <>
                        {/* Mobile: small cards, click -> detail */}
                        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-soft sm:hidden">
                          {items.map((p) => {
                            const name = productDisplayName(p);
                            const img = extractImage(p);
                            const imgSrc = img ? (toDisplayImageSrc(img) ?? img) : null;
                            const price = parseNumber(p.computed_final_price ?? p.discount_price ?? p.price);
                            return (
                              <Link
                                key={p.id}
                                href={`/produits/${encodeURIComponent(String(p.id))}`}
                                className="snap-start w-[220px] flex-none overflow-hidden rounded-[22px] border border-white/15 bg-white/5 backdrop-blur transition hover:bg-white/10"
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
                                    <p className="text-[11px] text-white/55">{getCustomerDeliveryText(p)}</p>
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

                        {/* Desktop/tablet: restore previous big cards + actions */}
                        <div className="hidden sm:flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-soft">
                          {items.map((p) => {
                            const name = productDisplayName(p);
                            const img = extractImage(p);
                            const imgSrc = img ? (toDisplayImageSrc(img) ?? img) : null;
                            const price = parseNumber(p.computed_final_price ?? p.discount_price ?? p.price);

                            return (
                              <div
                                key={p.id}
                                className="snap-start w-[320px] sm:w-[420px] flex-none rounded-[26px] border border-white/15 bg-white/5 p-4 backdrop-blur transition hover:bg-white/10"
                              >
                                <div className="flex gap-4">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs uppercase tracking-[0.35em] text-white/45">{cat.label}</p>
                                    <h3 className="mt-2 text-base font-semibold text-white line-clamp-2">{name}</h3>

                                    {p.accessory_subcategory ? (
                                      <p className="mt-1 text-xs text-white/60">{p.accessory_subcategory}</p>
                                    ) : null}

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <span
                                        className="inline-flex items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                                      >
                                        Livraison disponible
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                                        Meilleur Prix
                                      </span>
                                    </div>

                                    <div className="mt-4 grid gap-1 text-sm">
                                      <div className="flex items-center justify-between text-white/70">
                                        <span>Prix</span>
                                        <span className="font-semibold text-white">{formatFcfa(price)}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-white/70">
                                        <span>Livraison</span>
                                        <span className="font-semibold text-white">Disponible</span>
                                      </div>
                                      <div className="flex items-center justify-between text-white/70">
                                        <span>Choix client</span>
                                        <span className="font-semibold text-white">Voir détail</span>
                                      </div>
                                    </div>

                                    <p className="mt-3 text-xs text-cyan-100/80">{getCustomerDeliveryText(p)}</p>

                                    <div className="mt-4 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          router.push(`/produits/${encodeURIComponent(String(p.id))}`);
                                        }}
                                        className="flex-1 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15 transition"
                                      >
                                        Voir
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const ok = requireShippingThen({ kind: "cart", product: p });
                                          if (!ok) return;
                                          persistShipping();
                                          addToCart(p);
                                        }}
                                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
                                      >
                                        Panier
                                      </button>
                                    </div>
                                  </div>

                                  <div className="relative h-28 w-28 flex-none overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                                    {imgSrc ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={imgSrc} alt={name} className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="grid h-full w-full place-items-center bg-white/10 text-xs text-white/60">Image</div>
                                    )}
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent to-black/15" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
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
