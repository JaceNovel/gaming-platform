"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Gamepad2, Headphones, Monitor, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCartFlight } from "@/hooks/useCartFlight";
import { emitCartUpdated } from "@/lib/cartEvents";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import { buildGroupedDeliveryMessages, formatGroupedFcfa, parseGroupedNumber } from "@/lib/groupedDeliveryMessaging";
import {
  getStoredStorefrontCountry,
  onStorefrontCountryChanged,
  sanitizeStorefrontCustomerNotice,
  setStoredStorefrontCountry,
  type StorefrontCountry,
} from "@/lib/storefrontCountry";

type ApiProduct = {
  id: number | string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  discount_price?: number | string | null;
  computed_final_price?: number | string | null;
  shipping_fee?: number | string | null;
  grouping_progress_label?: string | null;
  grouping_progress?: number | null;
  grouping_threshold?: number | null;
  grouping_remaining_value?: number | string | null;
  grouping_minimum_value?: number | string | null;
  grouping_current_value?: number | string | null;
  free_shipping_eligible?: boolean | null;
  delivery_estimate_label?: string | null;
  display_section?: string | null;
  type?: string | null;
  category?: string | null;
  accessory_category?: string | null;
  accessory_subcategory?: string | null;
  stock?: number | null;
  stock_quantity?: number | null;
  image_url?: string | null;
  cover?: string | null;
  banner?: string | null;
  images?: Array<{ url?: string | null; path?: string | null } | string> | null;
  tags?: Array<{ name?: string | null } | string> | string[] | string | null;
  details?: {
    description?: string | null;
    image?: string | null;
    cover?: string | null;
    banner?: string | null;
    brand?: string | null;
    stock?: number | null;
  } | null;
};

type CartProduct = {
  id: number | string;
  name: string;
  description?: string;
  price: number;
  priceLabel?: string;
  quantity: number;
  type?: string;
  displaySection?: string | null;
  deliveryEstimateLabel?: string | null;
  shippingFee?: number;
  groupingProgressLabel?: string;
  groupingRemainingValue?: number;
  groupingMinimumValue?: number;
  accessoryCategory?: string | null;
};

const normalizeTags = (product: ApiProduct | null): string[] => {
  if (!product?.tags) return [];
  if (Array.isArray(product.tags)) {
    return product.tags
      .map((entry) => (typeof entry === "string" ? entry : entry?.name))
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
  }

  return String(product.tags)
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const extractImages = (product: ApiProduct | null): string[] => {
  if (!product) return ["/file.svg"];

  const candidates: Array<string | null | undefined> = [
    product.banner,
    product.cover,
    product.image_url,
    product.details?.banner,
    product.details?.cover,
    product.details?.image,
  ];

  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      if (typeof image === "string") {
        candidates.push(image);
      } else {
        candidates.push(image?.url, image?.path);
      }
    }
  }

  const unique: string[] = [];
  for (const candidate of candidates) {
    const normalized = String(candidate ?? "").trim();
    if (normalized && !unique.includes(normalized)) unique.push(normalized);
  }

  return unique.length ? unique : ["/file.svg"];
};

const sanitizeDescription = (product: ApiProduct | null): string => {
  const description = String(product?.description ?? product?.details?.description ?? "").trim();
  return description || "Un accessoire gaming selectionne pour elever ton setup, avec groupage intelligent et livraison optimisee.";
};

export default function PremiumAccessoryDesktopPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { triggerFlight, overlay } = useCartFlight();
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const id = params?.id;
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [storefrontCountries, setStorefrontCountries] = useState<StorefrontCountry[]>([]);
  const [storefrontCountryCode, setStorefrontCountryCode] = useState("TG");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    setStorefrontCountryCode(getStoredStorefrontCountry());
    return onStorefrontCountryChanged(setStorefrontCountryCode);
  }, []);

  useEffect(() => {
    const syncViewport = () => setIsDesktop(typeof window !== "undefined" ? window.innerWidth >= 1280 : null);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      try {
        const res = await fetch(`${API_BASE}/storefront/countries`, { headers: { Accept: "application/json" } });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !active) return;
        setStorefrontCountries(Array.isArray(payload?.data) ? payload.data : []);
      } catch {
        if (active) setStorefrontCountries([]);
      }
    };

    loadCountries();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadProduct = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (storefrontCountryCode) query.set("country_code", storefrontCountryCode);
        const res = await fetch(`${API_BASE}/products/${id}${query.toString() ? `?${query.toString()}` : ""}`, {
          headers: { Accept: "application/json" },
        });
        const payload = await res.json().catch(() => null);
        if (!active) return;
        setProduct(res.ok ? payload : null);
        setActiveImageIndex(0);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) loadProduct();
    return () => {
      active = false;
    };
  }, [id, storefrontCountryCode]);

  useEffect(() => {
    if (isDesktop === null || loading || !id) return;

    const isAccessory = Boolean(product?.accessory_category) || (String(product?.type ?? "") === "item" && String(product?.category ?? "").toLowerCase() === "accessory");
    if (!isDesktop || !isAccessory) {
      setRedirecting(true);
      router.replace(`/produits/${id}`);
    }
  }, [id, isDesktop, loading, product?.accessory_category, product?.category, product?.type, router]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const images = useMemo(() => extractImages(product).map((image) => toDisplayImageSrc(image) ?? image), [product]);
  const activeImage = images[activeImageIndex] ?? images[0] ?? "/file.svg";
  const priceValue = useMemo(() => parseGroupedNumber(product?.computed_final_price ?? product?.discount_price ?? product?.price), [product?.computed_final_price, product?.discount_price, product?.price]);
  const stockValue = useMemo(() => parseGroupedNumber(product?.stock ?? product?.stock_quantity ?? product?.details?.stock), [product?.details?.stock, product?.stock, product?.stock_quantity]);
  const description = useMemo(() => sanitizeDescription(product), [product]);
  const tags = useMemo(() => normalizeTags(product), [product]);
  const progressLabel = useMemo(() => {
    if (product?.grouping_progress_label) return product.grouping_progress_label;
    const current = parseGroupedNumber(product?.grouping_progress);
    const required = Math.max(1, parseGroupedNumber(product?.grouping_threshold));
    return `${current}/${required}`;
  }, [product?.grouping_progress, product?.grouping_progress_label, product?.grouping_threshold]);
  const remainingValue = useMemo(() => {
    const direct = parseGroupedNumber(product?.grouping_remaining_value);
    if (direct > 0) return direct;
    return Math.max(0, parseGroupedNumber(product?.grouping_minimum_value) - parseGroupedNumber(product?.grouping_current_value));
  }, [product?.grouping_current_value, product?.grouping_minimum_value, product?.grouping_remaining_value]);
  const deliveryMessages = useMemo(
    () => buildGroupedDeliveryMessages({
      shippingFee: product?.shipping_fee,
      remainingValue,
      freeShippingEligible: product?.free_shipping_eligible,
    }),
    [product?.free_shipping_eligible, product?.shipping_fee, remainingValue],
  );
  const activeCountry = useMemo(
    () => storefrontCountries.find((country) => country.code === storefrontCountryCode) ?? null,
    [storefrontCountries, storefrontCountryCode],
  );
  const customerNotice = useMemo(() => sanitizeStorefrontCustomerNotice(activeCountry?.customer_notice), [activeCountry?.customer_notice]);
  const heroKicker = useMemo(() => {
    return product.details?.brand || product.accessory_subcategory || product.accessory_category || "Showroom edit";
  }, [product.accessory_category, product.accessory_subcategory, product.details?.brand]);
  const showroomNotes = useMemo(
    () => [
      {
        title: "Selection desktop",
        text: "Composition large, contraste fort et lecture instantanee pour mettre le produit en scene comme une piece centrale du setup.",
      },
      {
        title: "Narration commerciale",
        text: "Le client voit d'abord le benefice, ensuite la progression du lot, puis seulement les details logistiques utiles a la conversion.",
      },
      {
        title: "Signal de valeur",
        text: "Prix, image hero, reste a debloquer et livraison provisoire sont rendus visibles en un seul regard, sans saturation inutile.",
      },
    ],
    [],
  );

  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    if (!product || typeof window === "undefined") return;

    const raw = window.localStorage.getItem("bbshop_cart");
    let cart: CartProduct[] = [];
    try {
      cart = raw ? JSON.parse(raw) : [];
    } catch {
      cart = [];
    }

    const existing = cart.find((item) => String(item.id) === String(product.id));
    if (existing) {
      existing.quantity = Math.max(1, Number(existing.quantity ?? 1) + 1);
      existing.shippingFee = parseGroupedNumber(product.shipping_fee);
      existing.groupingProgressLabel = progressLabel;
      existing.groupingRemainingValue = remainingValue;
      existing.groupingMinimumValue = parseGroupedNumber(product.grouping_minimum_value);
    } else {
      cart.push({
        id: product.id,
        name: String(product.name ?? product.title ?? "Produit"),
        description,
        price: priceValue,
        priceLabel: formatGroupedFcfa(priceValue),
        quantity: 1,
        type: String(product.type ?? "item"),
        displaySection: product.display_section ?? null,
        deliveryEstimateLabel: product.delivery_estimate_label ?? null,
        shippingFee: parseGroupedNumber(product.shipping_fee),
        groupingProgressLabel: progressLabel,
        groupingRemainingValue: remainingValue,
        groupingMinimumValue: parseGroupedNumber(product.grouping_minimum_value),
        accessoryCategory: product.accessory_category ?? null,
      });
    }

    window.localStorage.setItem("bbshop_cart", JSON.stringify(cart));
    emitCartUpdated({ action: "add" });
    triggerFlight(event.currentTarget);
    setStatusMessage("Accessoire ajoute au panier");
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => setStatusMessage(null), 2200);
  };

  const handleBuyNow = () => {
    if (!user) {
      router.push(`/auth/login?next=/product/${id}`);
      return;
    }

    router.push(`/checkout?product=${encodeURIComponent(String(product?.id ?? id ?? ""))}`);
  };

  if (loading || redirecting || isDesktop === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
        {overlay}
        <div className="text-sm text-white/65">{redirecting ? "Redirection vers la fiche adaptee..." : "Chargement de l'experience premium..."}</div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
        {overlay}
        <div className="text-sm text-white/65">Produit introuvable.</div>
      </main>
    );
  }

  const editorialCards = [
    {
      icon: Monitor,
      title: "Setup ready",
      text: "Selectionne pour un bureau gaming propre, coherent et immediatement exploitable.",
    },
    {
      icon: Truck,
      title: "Groupage intelligent",
      text: deliveryMessages.detail,
    },
    {
      icon: ShieldCheck,
      title: "Achat rassurant",
      text: "Validation produit, suivi local et support humain avant la remise finale.",
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07111f] text-white">
      {overlay}

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_30%),radial-gradient(circle_at_75%_10%,rgba(34,211,238,0.16),transparent_30%),linear-gradient(180deg,#07111f_0%,#0c1627_45%,#060b15_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none fixed left-[-120px] top-[140px] h-[420px] w-[420px] rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none fixed right-[-80px] top-[260px] h-[320px] w-[320px] rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-120px] left-[28%] h-[260px] w-[520px] rounded-full bg-white/5 blur-3xl" />

      {statusMessage ? (
        <div className="fixed right-8 top-8 z-50 rounded-2xl border border-cyan-300/25 bg-[#081425]/95 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-[0_20px_60px_rgba(8,20,37,0.55)]">
          {statusMessage}
        </div>
      ) : null}

      <div className="relative mx-auto max-w-[1600px] px-10 pb-16 pt-10">
        <div className="mb-8 flex items-center justify-between gap-6 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/48">
            <span className="text-cyan-200">Gaming showroom</span>
            <span className="h-1 w-1 rounded-full bg-white/35" />
            <span>{heroKicker}</span>
            <span className="h-1 w-1 rounded-full bg-white/35" />
            <span>{deliveryMessages.short}</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/42">Desktop premium experience</div>
        </div>

        <div className="flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => router.push("/accessoires")}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Retour accessoires
          </button>

          <div className="flex items-center gap-3 rounded-full border border-white/12 bg-white/5 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
            <Gamepad2 className="h-4 w-4 text-cyan-300" />
            Accessoire gaming desktop edition
          </div>
        </div>

        <section className="mt-8 grid grid-cols-[1.18fr_0.82fr] gap-8">
          <div className="space-y-8">
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-5">
              <div className="space-y-4">
                {images.slice(0, 5).map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`group relative h-24 overflow-hidden rounded-[24px] border transition ${index === activeImageIndex ? "border-amber-300 shadow-[0_18px_45px_rgba(245,158,11,0.24)]" : "border-white/10 hover:border-white/25"}`}
                  >
                    <img src={image} alt="Apercu produit" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full border border-white/12 bg-black/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                      0{index + 1}
                    </div>
                  </button>
                ))}
              </div>

              <div className="relative overflow-hidden rounded-[44px] border border-white/10 bg-[#0b1422] shadow-[0_40px_120px_rgba(0,0,0,0.42)]">
                <div className="pointer-events-none absolute inset-0 rounded-[44px] ring-1 ring-white/10" />
                <img src={activeImage} alt={String(product.name ?? product.title ?? "Produit")} className="h-[720px] w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,22,0.02)_0%,rgba(5,11,22,0.18)_45%,rgba(5,11,22,0.88)_100%)]" />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#07111f]/45 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#07111f]/45 to-transparent" />

                <div className="absolute left-8 right-8 top-8 flex items-start justify-between gap-6">
                  <div className="max-w-xl space-y-4">
                    <div className="inline-flex items-center rounded-full border border-white/12 bg-black/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/90 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                      {product.accessory_category || product.category || "gaming gear"}
                    </div>
                    <div>
                      <h1 className="max-w-3xl text-6xl font-black leading-[0.94] tracking-[-0.04em] text-white">
                        {product.name ?? product.title ?? "Accessoire gaming"}
                      </h1>
                      <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">{description}</p>
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-white/12 bg-black/35 px-5 py-4 text-right backdrop-blur-md shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Prix observe</div>
                    <div className="mt-2 text-4xl font-black text-amber-200">{formatGroupedFcfa(priceValue)}</div>
                    <div className="mt-3 text-xs text-white/60">{deliveryMessages.feeLabel}</div>
                  </div>
                </div>

                <div className="absolute right-8 top-[190px] max-w-xs rounded-[28px] border border-cyan-300/15 bg-cyan-300/8 p-5 backdrop-blur-md shadow-[0_25px_60px_rgba(18,35,54,0.22)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-100/70">Showroom note</div>
                  <p className="mt-3 text-sm leading-7 text-cyan-50/90">Une piece choisie pour donner du relief au setup, tout en gardant un parcours d'achat simple et lisible.</p>
                </div>

                <div className="absolute inset-x-8 bottom-8 grid grid-cols-3 gap-4">
                  <div className="rounded-[28px] border border-white/12 bg-black/30 px-5 py-4 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
                    <div className="text-[11px] uppercase tracking-[0.26em] text-white/40">Progression lot</div>
                    <div className="mt-2 text-3xl font-black text-white">{progressLabel}</div>
                    <div className="mt-2 text-xs text-white/60">Palier client en cours</div>
                  </div>
                  <div className="rounded-[28px] border border-cyan-300/16 bg-cyan-300/7 px-5 py-4 backdrop-blur-md shadow-[0_16px_40px_rgba(12,27,45,0.22)]">
                    <div className="text-[11px] uppercase tracking-[0.26em] text-white/40">Reste a debloquer</div>
                    <div className="mt-2 text-3xl font-black text-cyan-200">{formatGroupedFcfa(remainingValue)}</div>
                    <div className="mt-2 text-xs text-white/60">Pour la Livraison Gratuite et rapide</div>
                  </div>
                  <div className="rounded-[28px] border border-white/12 bg-black/30 px-5 py-4 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
                    <div className="text-[11px] uppercase tracking-[0.26em] text-white/40">Disponibilite</div>
                    <div className="mt-2 text-3xl font-black text-white">{stockValue > 0 ? stockValue : "Sur commande"}</div>
                    <div className="mt-2 text-xs text-white/60">Stock local ou approvisionnement gere</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {editorialCards.map((card) => (
                <div key={card.title} className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-sm transition hover:border-white/16 hover:bg-white/[0.07]">
                  <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-200">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-white">{card.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/68">{card.text}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-8 rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] p-7 shadow-[0_32px_120px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-black/18 px-4 py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Curated signal</div>
                  <div className="mt-1 text-sm font-semibold text-white">{heroKicker}</div>
                </div>
                <div className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Showroom</div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/42">Edition premium</div>
                  <div className="mt-2 text-3xl font-black text-white">{formatGroupedFcfa(priceValue)}</div>
                </div>
                <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100">
                  {deliveryMessages.short}
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-[#09101b] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.26em] text-white/42">Pays de livraison</div>
                    <div className="mt-2 text-sm text-white/70">Choisis la zone client pour recalculer le lot et la livraison.</div>
                  </div>
                  <Headphones className="h-5 w-5 text-cyan-200" />
                </div>

                <select
                  value={storefrontCountryCode}
                  onChange={(event) => {
                    const next = event.target.value.toUpperCase();
                    setStorefrontCountryCode(next);
                    setStoredStorefrontCountry(next);
                  }}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  {storefrontCountries.map((country) => (
                    <option key={country.code} value={country.code} className="bg-slate-950 text-white">
                      {country.name}
                    </option>
                  ))}
                </select>

                {customerNotice ? <p className="mt-4 text-xs leading-6 text-white/58">{customerNotice}</p> : null}
              </div>

              <div className="mt-6 rounded-[28px] border border-cyan-300/18 bg-cyan-300/6 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/65">Message client</div>
                <p className="mt-3 text-sm leading-7 text-cyan-50">{deliveryMessages.detail}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-cyan-100/75">
                  <span>Frais actuels</span>
                  <span className="font-semibold">{deliveryMessages.feeLabel}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full rounded-[24px] bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_50%,#facc15_100%)] px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#201407] shadow-[0_20px_50px_rgba(249,115,22,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_26px_65px_rgba(249,115,22,0.34)]"
                >
                  Acheter maintenant
                </button>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex w-full items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <ShoppingCart className="h-4 w-4" /> Ajouter au panier
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-white/70">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Categorie</div>
                  <div className="mt-2 font-semibold text-white">{product.accessory_subcategory || product.accessory_category || product.category || "Gaming gear"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Valeur lot</div>
                  <div className="mt-2 font-semibold text-white">{formatGroupedFcfa(parseGroupedNumber(product.grouping_current_value))}</div>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-black/18 p-5">
                <div className="flex items-center gap-3 text-white">
                  <Headphones className="h-4 w-4 text-cyan-300" />
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Concierge gaming</div>
                </div>
                <p className="mt-3 text-sm leading-7 text-white/68">
                  Si tu veux optimiser plusieurs accessoires ensemble, le groupage continue automatiquement a s'ajuster pour proteger le meilleur cout de livraison possible.
                </p>
              </div>

              {tags.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {tags.slice(0, 8).map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>
        </section>

        <section className="mt-8 grid grid-cols-[0.86fr_1.14fr] gap-8">
          <div className="rounded-[34px] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">Pourquoi ce produit</div>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white">Une fiche orientee desktop, pour vendre un setup et pas juste un SKU.</h2>
            <p className="mt-5 text-sm leading-7 text-white/68">
              Cette experience met en avant la valeur percue du produit, la progression du lot et le benefice client sans exposer la complexite logistique. Elle est volontairement reservee au desktop pour garder une composition riche, editorialisee et premium.
            </p>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-7 backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Valeur minimum</div>
                <div className="mt-3 text-2xl font-black text-white">{formatGroupedFcfa(parseGroupedNumber(product.grouping_minimum_value))}</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Livraison actuelle</div>
                <div className="mt-3 text-2xl font-black text-cyan-200">{deliveryMessages.feeLabel}</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Etat lot</div>
                <div className="mt-3 text-2xl font-black text-white">{deliveryMessages.short}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur-sm">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">Showroom notes</div>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white">Un rendu plus luxe, plus net, plus memorisable.</h2>
            </div>
            <div className="max-w-xl text-sm leading-7 text-white/62">
              L'objectif ici n'est pas seulement de montrer un produit, mais de donner l'impression d'entrer dans un espace de selection premium pour setup gaming.
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-5">
            {showroomNotes.map((note) => (
              <div key={note.title} className="rounded-[28px] border border-white/10 bg-black/18 p-6">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">{note.title}</div>
                <p className="mt-4 text-sm leading-7 text-white/68">{note.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
