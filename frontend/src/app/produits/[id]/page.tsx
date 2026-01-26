"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { useCartFlight } from "@/hooks/useCartFlight";

type ApiProduct = {
  id: number | string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  details?: {
    description?: string | null;
    tags?: string[] | string | null;
    image?: string | null;
    brand?: string | null;
    stock?: number | null;
  } | null;
  price?: number | string | null;
  discount_price?: number | string | null;
  image_url?: string | null;
  cover?: string | null;
  banner?: string | null;
  media?: Array<{ url?: string | null } | string>;
  images?: Array<{ url?: string | null; path?: string | null } | string> | null;
  category?: string | null;
  category_entity?: { name?: string | null } | null;
  brand?: string | null;
  stock?: number | null;
  stock_quantity?: number | null;
  stockType?: string | null;
  stock_type?: string | null;
  tags?: string[] | string | null;
};

const formatPrice = (value: number) => `${new Intl.NumberFormat("fr-FR").format(Math.max(0, value))} FCFA`;

const extractImage = (product: ApiProduct | null): string | null => {
  if (!product) return null;
  if (product.image_url) return product.image_url;
  if (Array.isArray(product.images) && product.images.length) {
    const first = product.images[0];
    if (typeof first === "string") return first;
    return first?.url ?? first?.path ?? null;
  }
  if (product.cover) return product.cover;
  if (product.banner) return product.banner;
  if (product.details?.image) return product.details.image;
  if (Array.isArray(product.media) && product.media.length) {
    const entry = product.media[0];
    if (typeof entry === "string") return entry;
    return entry?.url ?? null;
  }
  return null;
};

const normalizeTags = (product: ApiProduct | null): string[] => {
  if (!product) return [];
  const raw = product.tags ?? product.details?.tags;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((tag) => String(tag)).filter(Boolean);
  }
  return String(raw)
    .split(/[,;]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { triggerFlight, overlay } = useCartFlight();
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const id = params?.id;

  useEffect(() => {
    let active = true;
    const loadProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/products/${id}`);
        if (!active) return;
        if (res.status === 404) {
          setError("Produit introuvable");
          setProduct(null);
          return;
        }
        if (!res.ok) {
          setError("Impossible de charger le produit.");
          setProduct(null);
          return;
        }
        const payload = await res.json();
        if (!active) return;
        setProduct(payload);
      } catch (err) {
        if (!active) return;
        setError("Erreur réseau, réessaie plus tard.");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) {
      loadProduct();
    }

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const mainImage = useMemo(() => extractImage(product), [product]);
  const tags = useMemo(() => normalizeTags(product), [product]);
  const priceValue = useMemo(
    () => Number(product?.discount_price ?? product?.price ?? 0) || 0,
    [product]
  );
  const description =
    product?.description ?? product?.details?.description ??
    "Offre spéciale disponible dans la boutique BADBOYSHOP.";
  const categoryLabel = product?.category_entity?.name ?? product?.category ?? "—";
  const brandLabel = product?.brand ?? product?.details?.brand ?? "N/A";
  const stockCount = useMemo(() => {
    if (!product) return 0;
    const value =
      product.stock ??
      product.stock_quantity ??
      product.details?.stock ??
      (product.stockType === "IN_STOCK" || product.stock_type === "IN_STOCK" ? 5 : 0);
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  }, [product]);
  const tagsLabel = tags.length ? tags.join(", ") : "Aucun tag";

  const persistToCart = () => {
    if (!product || typeof window === "undefined") return;
    const cartRaw = window.localStorage.getItem("bbshop_cart");
    let cart: Array<{ id: number | string; name: string; price: number; priceLabel: string; description?: string; quantity: number }>; // eslint-disable-line max-len
    try {
      cart = cartRaw ? JSON.parse(cartRaw) : [];
    } catch {
      cart = [];
    }
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = Number(existing.quantity ?? 0) + 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name ?? product.title ?? "Produit",
        price: priceValue,
        priceLabel: formatPrice(priceValue),
        description,
        quantity: 1,
      });
    }
    window.localStorage.setItem("bbshop_cart", JSON.stringify(cart));
    setStatusMessage("Produit ajouté au panier");
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => setStatusMessage(null), 2200);
  };

  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    persistToCart();
    triggerFlight(event.currentTarget);
  };

  const handleBuyNow = (event: MouseEvent<HTMLButtonElement>) => {
    persistToCart();
    triggerFlight(event.currentTarget);
    router.push("/checkout");
  };

  const renderImage = () => {
    if (mainImage) {
      return (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <Image src={mainImage} alt={product?.name ?? "Produit"} fill sizes="(min-width:1024px) 60vw, 100vw" className="object-cover" />
        </div>
      );
    }
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 text-base font-semibold text-white/60 shadow-inner">
        Aucune image
      </div>
    );
  };

  const infoRows = [
    { label: "Catégorie", value: categoryLabel },
    { label: "Marque", value: brandLabel ?? "N/A" },
    { label: "Stock", value: `${stockCount} unité${stockCount > 1 ? "s" : ""}` },
    { label: "Tags", value: tagsLabel },
  ];

  return (
    <main className="min-h-screen bg-[#05030d] text-white">
      {overlay}
      {statusMessage && (
        <div className="fixed right-4 top-[88px] z-50 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
          <ShoppingCart className="h-4 w-4 text-rose-400" />
          <span>{statusMessage}</span>
        </div>
      )}
      <div className="mx-auto w-full max-w-6xl px-4 py-10 lg:px-8 lg:py-16">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-white/70 transition hover:text-white"
          >
            ← Retour boutique
          </button>
          <Link href="/shop" className="text-sm text-rose-300 transition hover:text-rose-200">
            Voir toutes les offres
          </Link>
        </div>

        {loading && (
          <div className="mt-20 rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            Chargement du produit...
          </div>
        )}

        {!loading && error && (
          <div className="mt-20 rounded-3xl border border-rose-500/40 bg-rose-500/10 p-10 text-center text-rose-100">
            {error}
            <div className="mt-6">
              <Link href="/shop" className="text-sm font-semibold text-rose-200 underline">
                Retourner à la boutique
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && product && (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            {renderImage()}

            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                <h1 className="text-3xl font-bold text-white">{product.name ?? product.title ?? "Produit"}</h1>
                <p className="mt-3 text-3xl font-bold text-[#ff4b63]">{formatPrice(priceValue)}</p>
                <p className="mt-4 text-base text-white/70">{description}</p>

                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-white">Informations</h2>
                  <div className="mt-4 divide-y divide-white/10 text-sm">
                    {infoRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-3">
                        <span className="text-white/60">{row.label}</span>
                        <span className="text-right font-semibold text-white">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="rounded-full bg-[#d71933] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:bg-[#b51229]"
                  >
                    Ajouter au panier
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-700"
                  >
                    Acheter maintenant
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  <p>
                    <span className="font-semibold text-white">Livraison estimée :</span> 7-10 jours ouvrés. Vous serez notifié par email et SMS à
                    l&apos;arrivée de votre commande.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
