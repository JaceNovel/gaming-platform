"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductRow } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type Game = { id: number; name: string };

type Props = {
  products: ProductRow[];
  onRefresh: () => Promise<void>;
};

export function ProductManager({ products, onRefresh }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("account");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [gameId, setGameId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("bbshop_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const res = await fetch(`${API_BASE}/games`);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data?.data) ? data.data : data;
        setGames(list ?? []);
      } catch {
        // ignore
      }
    };

    loadGames();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        price: Number(price),
        discount_price: discountPrice ? Number(discountPrice) : undefined,
        stock: Number(stock),
        game_id: Number(gameId),
        is_active: isActive,
      };

      const res = await fetch(`${API_BASE}/admin/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setStatus(msg?.message ?? "Création impossible");
        return;
      }

      setName("");
      setPrice("");
      setDiscountPrice("");
      setStock("0");
      setGameId("");
      setIsActive(true);
      setStatus("Produit ajouté.");
      await onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    setStatus("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/products/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setStatus(msg?.message ?? "Suppression impossible");
        return;
      }
      setStatus("Produit supprimé.");
      await onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
      <div className="mb-4 text-sm font-semibold text-white">Gestion des articles</div>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-xs text-white/70">
          Nom
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            required
          />
        </label>

        <label className="text-xs text-white/70">
          Jeu
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            required
          >
            <option value="">Sélectionner</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-white/70">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="account">account</option>
            <option value="recharge">recharge</option>
            <option value="item">item</option>
          </select>
        </label>

        <label className="text-xs text-white/70">
          Stock
          <input
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            required
          />
        </label>

        <label className="text-xs text-white/70">
          Prix
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            required
          />
        </label>

        <label className="text-xs text-white/70">
          Prix promo
          <input
            type="number"
            min="0"
            step="0.01"
            value={discountPrice}
            onChange={(e) => setDiscountPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs text-white/70 flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-emerald-400"
          />
          Actif
        </label>

        <button
          type="submit"
          disabled={loading}
          className="md:col-span-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {loading ? "En cours..." : "Ajouter l'article"}
        </button>
      </form>

      {status && <p className="mt-3 text-xs text-emerald-200">{status}</p>}

      <div className="mt-5 space-y-2 text-sm text-white/80">
        {products.length === 0 && <div className="text-white/50">Aucun article.</div>}
        {products.map((product) => (
          <div key={product.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div>
              <div className="font-semibold text-white">{product.name}</div>
              <div className="text-xs text-white/50">{product.type} • Stock {product.stock ?? 0}</div>
            </div>
            <button
              onClick={() => handleDelete(product.id)}
              className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200"
            >
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
