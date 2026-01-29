"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type Category = {
  id: number;
  name: string;
};

type Game = {
  id: number;
  name: string;
};

type CategoriesResponse = {
  data: Category[];
};

type GamesResponse = {
  data: Game[];
} | Game[];

type ApiProduct = {
  id: number;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  discount_price?: number | string | null;
  stock?: number | null;
  category_id?: number | null;
  game_id?: number | null;
  type?: string | null;
  is_active?: boolean | null;
  shipping_required?: boolean | null;
  delivery_type?: string | null;
  delivery_eta_days?: number | null;
  delivery_estimate_label?: string | null;
  display_section?: string | null;
  images?: Array<{ url?: string | null; path?: string | null; position?: number | null } | string> | null;
  details?: {
    image?: string | null;
    banner?: string | null;
    mobile_section?: string | null;
  } | null;
  tags?: Array<{ name?: string | null } | string> | string[] | string | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const buildUrl = (path: string, params: Record<string, string> = {}) => {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

const isLikelyImageUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed);
};

export default function AdminProductsEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = params?.id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serverTags, setServerTags] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [gameId, setGameId] = useState("");
  const [type, setType] = useState("account");
  const [shippingRequired, setShippingRequired] = useState(false);
  const [deliveryType, setDeliveryType] = useState("in_stock");
  const [deliveryEtaDays, setDeliveryEtaDays] = useState("2");
  const [deliveryEstimateLabel, setDeliveryEstimateLabel] = useState("");
  const [displaySection, setDisplaySection] = useState("none");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [accountImages, setAccountImages] = useState<string[]>([""]);
  const [uploadingAccountImages, setUploadingAccountImages] = useState(false);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [bannerPreviewError, setBannerPreviewError] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(buildUrl("/admin/categories"), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) return;
      const payload = (await res.json()) as CategoriesResponse;
      setCategories(payload?.data ?? []);
    } catch {
      // ignore
    }
  }, []);

  const loadGames = useCallback(async () => {
    try {
      const res = await fetch(buildUrl("/games"));
      if (!res.ok) return;
      const payload = (await res.json()) as GamesResponse;
      const list = Array.isArray(payload) ? payload : payload?.data ?? [];
      setGames(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadGames();
  }, [loadCategories, loadGames]);

  useEffect(() => {
    let active = true;
    const loadProduct = async () => {
      if (!productId) return;
      setLoadingProduct(true);
      try {
        const res = await fetch(`${API_BASE}/products/${productId}`);
        if (!res.ok) return;
        const product = (await res.json()) as ApiProduct;
        if (!active) return;
        setName(product?.name ?? "");
        setDescription(product?.description ?? "");
        const rawTags = product?.tags;
        const tagNames = Array.isArray(rawTags)
          ? rawTags
            .map((t) => (typeof t === "string" ? t : t?.name))
            .map((t) => String(t ?? "").trim())
            .filter(Boolean)
          : String(rawTags ?? "")
            .split(/[,;]+/)
            .map((t) => t.trim())
            .filter(Boolean);
        setServerTags(tagNames.join(", "));
        setPrice(product?.price ? String(product.price) : "");
        setDiscountPrice(product?.discount_price ? String(product.discount_price) : "");
        setStock(product?.stock ? String(product.stock) : "0");
        setCategoryId(product?.category_id ? String(product.category_id) : "");
        setGameId(product?.game_id ? String(product.game_id) : "");
        setType(product?.type ?? "account");
        setIsActive(Boolean(product?.is_active ?? true));
        setShippingRequired(Boolean(product?.shipping_required ?? false));
        setDeliveryType(product?.delivery_type ?? "in_stock");
        setDeliveryEtaDays(product?.delivery_eta_days ? String(product.delivery_eta_days) : "2");
        setDeliveryEstimateLabel(String(product?.delivery_estimate_label ?? ""));
        setDisplaySection(product?.display_section ?? "none");
        setImageUrl(product?.details?.image ?? "");
        setBannerUrl(product?.details?.banner ?? "");

        const rawImages = Array.isArray(product?.images) ? product.images : [];
        const normalized = rawImages
          .map((entry) => {
            if (typeof entry === "string") return entry;
            return entry?.url ?? entry?.path ?? "";
          })
          .map((v) => String(v ?? "").trim())
          .filter(Boolean);

        setAccountImages(normalized.length ? normalized.slice(0, 10) : [""]);
      } catch {
        // ignore
      } finally {
        if (active) setLoadingProduct(false);
      }
    };

    loadProduct();
    return () => {
      active = false;
    };
  }, [productId]);

  const uploadAccountImages = useCallback(
    async (files: File[]) => {
      if (!productId) return;
      if (!files.length) return;
      setStatus("");
      setUploadingAccountImages(true);
      try {
        const remaining = Math.max(0, 10 - accountImages.filter((v) => v.trim()).length);
        const limited = files.slice(0, remaining);
        for (const file of limited) {
          const form = new FormData();
          form.append("image", file);
          const res = await fetch(`${API_BASE}/admin/products/${productId}/image`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "X-Requested-With": "XMLHttpRequest",
              ...getAuthHeaders(),
            },
            body: form,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.message ?? "Upload image impossible");
          }
          const payload = await res.json().catch(() => ({}));
          const url = String(payload?.data?.url ?? "").trim();
          if (url) {
            setAccountImages((prev) => {
              const cleaned = prev.map((v) => v.trim()).filter(Boolean);
              const next = [...cleaned, url].slice(0, 10);
              return next.length ? next : [""];
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload image impossible";
        setStatus(message || "Upload image impossible");
      } finally {
        setUploadingAccountImages(false);
      }
    },
    [accountImages, productId]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!productId) return;
    setStatus("");
    setLoading(true);

    try {
      const cleanedAccountImages = accountImages
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 10);

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        server_tags: serverTags.trim() || undefined,
        price: Number(price),
        discount_price: discountPrice ? Number(discountPrice) : undefined,
        stock: Number(stock),
        category_id: categoryId ? Number(categoryId) : undefined,
        game_id: gameId ? Number(gameId) : undefined,
        type,
        is_active: isActive,
        shipping_required: shippingRequired,
        delivery_type: shippingRequired ? deliveryType : undefined,
        delivery_eta_days: deliveryEtaDays.trim() ? Number(deliveryEtaDays) : undefined,
        delivery_estimate_label:
          type === "item" && displaySection !== "emote_skin" && deliveryEstimateLabel.trim()
            ? deliveryEstimateLabel.trim()
            : undefined,
        display_section: displaySection === "none" ? undefined : displaySection,
        image_url: imageUrl.trim() || undefined,
        banner_url: bannerUrl.trim() || undefined,
        images: type === "account" ? cleanedAccountImages : undefined,
      };

      const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        let message = "Modification impossible";
        if (contentType.includes("application/json")) {
          const parsed = await res.json().catch(() => null);
          message = parsed?.message ?? message;
          if (parsed?.errors) {
            const firstKey = Object.keys(parsed.errors)[0];
            const firstError = firstKey ? parsed.errors[firstKey]?.[0] : null;
            if (firstError) message = firstError;
          }
        } else {
          const text = await res.text().catch(() => "");
          if (text) message = text;
        }
        setStatus(`${message} (HTTP ${res.status})`);
        return;
      }

      setStatus("Produit mis à jour.");
      router.refresh();
    } catch {
      setStatus("Modification impossible");
    } finally {
      setLoading(false);
    }
  };

  const previewGrid = useMemo(() => imageUrl || bannerUrl, [imageUrl, bannerUrl]);

  return (
    <AdminShell title="Modifier un produit" subtitle="Mettre à jour un article">
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Informations de base</h3>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Nom du produit *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="Entrez le nom du produit"
                  disabled={loadingProduct}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={6}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="Écrivez votre contenu en Markdown ici..."
                  disabled={loadingProduct}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Tags serveur (séparés par virgules)</label>
                <input
                  value={serverTags}
                  onChange={(e) => setServerTags(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="ex: garantie, full-access, instant"
                  disabled={loadingProduct}
                />
              </div>

              {type === "account" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="text-sm font-semibold">Images du compte (carousel)</label>
                      <p className="mt-1 text-xs text-slate-500">
                        Ajoute plusieurs URLs (max 10). Elles vont défiler horizontalement sur la fiche produit.
                      </p>
                      <div className="mt-3">
                        <label className="text-xs font-semibold text-slate-700">Uploader depuis la galerie</label>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={loadingProduct || uploadingAccountImages}
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            if (files.length) void uploadAccountImages(files);
                            e.currentTarget.value = "";
                          }}
                          className="mt-2 block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                        />
                        {uploadingAccountImages && (
                          <p className="mt-2 text-xs text-slate-500">Upload en cours…</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                      onClick={() => setAccountImages((prev) => [...prev, ""]) }
                      disabled={loadingProduct || uploadingAccountImages}
                    >
                      + Ajouter
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {accountImages.map((value, idx) => {
                      const canPreview = isLikelyImageUrl(value);
                      const previewSrc = canPreview ? (toDisplayImageSrc(value) ?? value) : null;
                      return (
                        <div key={idx} className="grid gap-3 md:grid-cols-[1fr,150px]">
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-slate-600">Image #{idx + 1}</label>
                              <button
                                type="button"
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                onClick={() => setAccountImages((prev) => prev.filter((_, i) => i !== idx))}
                                disabled={loadingProduct || accountImages.length <= 1}
                                title={accountImages.length <= 1 ? "Au moins 1 champ" : "Supprimer"}
                              >
                                Supprimer
                              </button>
                            </div>
                            <input
                              value={value}
                              onChange={(e) =>
                                setAccountImages((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                              }
                              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                              placeholder="https://..."
                              disabled={loadingProduct}
                            />
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-2">
                            {previewSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={previewSrc} alt="" className="h-24 w-full rounded-lg object-cover" />
                            ) : (
                              <div className="grid h-24 place-items-center text-xs text-slate-400">Aperçu</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Tarification</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Prix *</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min="0"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="0.00"
                  disabled={loadingProduct}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Prix promo</label>
                <input
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="0.00"
                  disabled={loadingProduct}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Stock *</label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  min="0"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  disabled={loadingProduct}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Visuels du produit</h3>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Image principale (URL)</label>
                <input
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImagePreviewError(false);
                  }}
                  type="url"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="https://..."
                  disabled={loadingProduct}
                />
                <p className="mt-2 text-xs text-slate-500">Astuce: utiliser un lien HTTPS direct vers une image (jpg/png).</p>
              </div>
              <div>
                <label className="text-sm font-medium">Bannière (URL)</label>
                <input
                  value={bannerUrl}
                  onChange={(e) => {
                    setBannerUrl(e.target.value);
                    setBannerPreviewError(false);
                  }}
                  type="url"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="https://..."
                  disabled={loadingProduct}
                />
              </div>
              {previewGrid && (
                <div className="grid gap-4 rounded-2xl border border-dashed border-slate-200 p-4 text-center md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Image principale</p>
                    <div className="mt-2 flex items-center justify-center">
                      {!imageUrl || imagePreviewError || !isLikelyImageUrl(imageUrl) ? (
                        <div className="h-32 w-32 rounded-2xl bg-slate-100 text-xs text-slate-400 flex items-center justify-center">
                          Prévisualisation indisponible
                        </div>
                      ) : (
                        <img
                          src={toDisplayImageSrc(imageUrl) ?? imageUrl}
                          alt="Prévisualisation"
                          referrerPolicy="no-referrer"
                          onError={() => setImagePreviewError(true)}
                          className="h-32 w-32 rounded-2xl object-cover"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Bannière</p>
                    <div className="mt-2 flex items-center justify-center">
                      {!bannerUrl || bannerPreviewError || !isLikelyImageUrl(bannerUrl) ? (
                        <div className="h-32 w-full max-w-[240px] rounded-2xl bg-slate-100 text-xs text-slate-400 flex items-center justify-center">
                          Prévisualisation indisponible
                        </div>
                      ) : (
                        <img
                          src={toDisplayImageSrc(bannerUrl) ?? bannerUrl}
                          alt="Prévisualisation bannière"
                          referrerPolicy="no-referrer"
                          onError={() => setBannerPreviewError(true)}
                          className="h-32 w-full max-w-[240px] rounded-2xl object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Attribut</h3>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Catégorie *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  required
                  disabled={loadingProduct}
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Jeu (optionnel)</label>
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  disabled={loadingProduct}
                >
                  <option value="">Aucun jeu</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  disabled={loadingProduct}
                >
                  <option value="account">account</option>
                  <option value="recharge">recharge</option>
                  <option value="item">item</option>
                  <option value="subscription">subscription</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Section boutique (optionnel)</label>
                <select
                  value={displaySection}
                  onChange={(e) => setDisplaySection(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  disabled={loadingProduct}
                >
                  <option value="none">Aucune</option>
                   <option value="recharge_direct">Recharge Direct</option>
                  <option value="popular">Produits populaires</option>
                  <option value="emote_skin">Emote && Skin</option>
                  <option value="cosmic_promo">Promotions cosmiques</option>
                  <option value="latest">Derniers ajouts</option>
                  <option value="gaming_accounts">Compte Gaming</option>
                </select>
              </div>

              {type === "item" && displaySection !== "emote_skin" && (
                <div>
                  <label className="text-sm font-medium">Délai de livraison estimé (accessoire)</label>
                  <input
                    value={deliveryEstimateLabel}
                    onChange={(e) => setDeliveryEstimateLabel(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                    placeholder="ex: 7–10 jours"
                    disabled={loadingProduct}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Optionnel. S'affiche sur la carte produit et la page détail.
                  </p>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={shippingRequired}
                  onChange={(e) => setShippingRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                  disabled={loadingProduct}
                />
                Livraison requise (article physique)
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                {shippingRequired && (
                  <div>
                    <label className="text-sm font-medium">Type de livraison</label>
                    <select
                      value={deliveryType}
                      onChange={(e) => setDeliveryType(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                      disabled={loadingProduct}
                    >
                      <option value="in_stock">in_stock</option>
                      <option value="preorder">preorder</option>
                    </select>
                  </div>
                )}
                <div className={shippingRequired ? "" : "md:col-span-2"}>
                  <label className="text-sm font-medium">Estimation de livraison (jours)</label>
                  <input
                    value={deliveryEtaDays}
                    onChange={(e) => setDeliveryEtaDays(e.target.value)}
                    type="number"
                    min="1"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                    disabled={loadingProduct}
                  />
                  <p className="mt-1 text-xs text-slate-500">Laissez vide pour utiliser la valeur par défaut.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                  disabled={loadingProduct}
                />
                Actif
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <button
              type="submit"
              disabled={loading || loadingProduct}
              className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
            >
              {loading ? "En cours..." : "Enregistrer les modifications"}
            </button>
            {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
