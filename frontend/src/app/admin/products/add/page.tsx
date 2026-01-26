"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

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

export default function AdminProductsAddPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [gameId, setGameId] = useState("");
  const [type, setType] = useState("account");
  const [shippingRequired, setShippingRequired] = useState(false);
  const [deliveryType, setDeliveryType] = useState("in_stock");
  const [deliveryEtaDays, setDeliveryEtaDays] = useState("2");
  const [isActive, setIsActive] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => getAuthHeaders(), []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(buildUrl("/admin/categories"), {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      if (!res.ok) return;
      const payload = (await res.json()) as CategoriesResponse;
      setCategories(payload?.data ?? []);
    } catch {
      // ignore
    }
  }, [authHeaders]);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setImageFile(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        discount_price: discountPrice ? Number(discountPrice) : undefined,
        stock: Number(stock),
        category_id: categoryId ? Number(categoryId) : undefined,
        game_id: Number(gameId),
        type,
        is_active: isActive,
        shipping_required: shippingRequired,
        delivery_type: shippingRequired ? deliveryType : undefined,
        delivery_eta_days: shippingRequired ? Number(deliveryEtaDays) : undefined,
      };

      const res = await fetch(`${API_BASE}/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        setStatus(errorPayload?.message ?? "Création impossible");
        return;
      }

      const created = await res.json().catch(() => ({}));
      const productId = created?.id ?? created?.data?.id;

      if (productId && imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const upload = await fetch(`${API_BASE}/admin/products/${productId}/image`, {
          method: "POST",
          headers: {
            ...authHeaders,
          },
          body: formData,
        });
        if (!upload.ok) {
          setStatus("Produit ajouté, mais upload image échoué.");
        }
      }

      setName("");
      setDescription("");
      setPrice("");
      setDiscountPrice("");
      setStock("0");
      setCategoryId("");
      setGameId("");
      setType("account");
      setShippingRequired(false);
      setDeliveryType("in_stock");
      setDeliveryEtaDays("2");
      setIsActive(true);
      setImagePreview(null);
      setImageFile(null);
      setStatus("Produit ajouté.");
    } catch {
      setStatus("Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Créer un produit" subtitle="Ajouter un nouvel article à la boutique">
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
                />
              </div>
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
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Image du produit</h3>
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Prévisualisation"
                  className="h-32 w-32 rounded-2xl object-cover"
                />
              ) : (
                <div className="text-sm text-slate-400">Choisissez un fichier ou glissez-déposez</div>
              )}
              <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">
                Choose File
                <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
              </label>
              <p className="mt-4 text-xs text-slate-400">Formats acceptés : jpg, jpeg, png (max 4MB)</p>
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
                <label className="text-sm font-medium">Jeu *</label>
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  required
                >
                  <option value="">Sélectionner un jeu</option>
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
                >
                  <option value="account">account</option>
                  <option value="recharge">recharge</option>
                  <option value="item">item</option>
                  <option value="subscription">subscription</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={shippingRequired}
                  onChange={(e) => setShippingRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Livraison requise (article physique)
              </label>
              {shippingRequired && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Type de livraison</label>
                    <select
                      value={deliveryType}
                      onChange={(e) => setDeliveryType(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                    >
                      <option value="in_stock">in_stock</option>
                      <option value="preorder">preorder</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">ETA (jours)</label>
                    <input
                      value={deliveryEtaDays}
                      onChange={(e) => setDeliveryEtaDays(e.target.value)}
                      type="number"
                      min="1"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Actif
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
            >
              {loading ? "En cours..." : "Ajouter le produit"}
            </button>
            {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
