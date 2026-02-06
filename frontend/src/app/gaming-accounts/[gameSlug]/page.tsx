"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ChevronRight, Search } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type MenuGame = { id: number; name: string; slug: string; image?: string | null; icon?: string | null };

type ListingRow = {
  id: number;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  delivery_window_hours?: number | string | null;
  image_url?: string | null;
  game?: { id: number; name?: string | null; image?: string | null } | null;
  category?: { id: number; name?: string | null } | null;
  seller_trust?: { badges?: string[]; successRate?: number; totalSales?: number } | null;
};

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  next_page_url?: string | null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

const parseGamesPayload = (payload: any): MenuGame[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as MenuGame[];
  if (Array.isArray(payload?.data)) return payload.data as MenuGame[];
  if (Array.isArray(payload?.data?.data)) return payload.data.data as MenuGame[];
  return [];
};

const parsePaginator = <T,>(payload: any): { items: T[]; meta: Paginated<T> | null } => {
  const boxed = payload?.data ?? payload;
  if (boxed && typeof boxed === "object" && boxed.data && typeof boxed.data === "object" && Array.isArray(boxed.data.data)) {
    return { items: boxed.data.data as T[], meta: boxed.data as Paginated<T> };
  }
  if (boxed && typeof boxed === "object" && Array.isArray(boxed.data)) {
    return { items: boxed.data as T[], meta: boxed as Paginated<T> };
  }
  return { items: [], meta: null };
};

export default function GamingAccountsByGamePage() {
  const params = useParams();
  const gameSlug = String((params?.gameSlug as string) ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<MenuGame | null>(null);
  const [items, setItems] = useState<ListingRow[]>([]);
  const [meta, setMeta] = useState<Paginated<ListingRow> | null>(null);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<number | null>(null);

  const canLoadMore = Boolean(meta && (meta.current_page ?? 1) < (meta.last_page ?? 1));

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setItems([]);
      setMeta(null);
      setGame(null);

      try {
        const gamesRes = await fetch(`${API_BASE}/games?active=1&context=marketplace&per_page=200`, {
          headers: { Accept: "application/json" },
        });
        const gamesPayload = await gamesRes.json().catch(() => null);
        const games = parseGamesPayload(gamesPayload);
        const found = games.find((g) => String(g.slug ?? "").toLowerCase() === gameSlug.toLowerCase()) ?? null;
        if (!active) return;
        setGame(found);
        if (!found) {
          setItems([]);
          setMeta(null);
          return;
        }

        const listRes = await fetch(`${API_BASE}/gaming-accounts/listings?gameId=${found.id}`, { cache: "no-store" });
        const listPayload = await listRes.json().catch(() => null);
        if (!active) return;
        if (!listRes.ok) throw new Error(listPayload?.message ?? "Impossible de charger les annonces");
        const parsed = parsePaginator<ListingRow>(listPayload);
        const filtered = parsed.items.filter((row) => {
          if (!query.trim()) return true;
          const needle = query.trim().toLowerCase();
          return String(row?.title ?? "").toLowerCase().includes(needle) || String(row?.description ?? "").toLowerCase().includes(needle);
        });
        setItems(filtered);
        setMeta(parsed.meta);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Impossible de charger");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [gameSlug]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      // Client-side filtering only (API doesn't support q here).
      setItems((prev) => {
        if (!query.trim()) return prev;
        const needle = query.trim().toLowerCase();
        return prev.filter(
          (row) =>
            String(row?.title ?? "").toLowerCase().includes(needle) ||
            String(row?.description ?? "").toLowerCase().includes(needle)
        );
      });
    }, 250);
  }, [query]);

  const loadMore = async () => {
    if (!game) return;
    if (!meta) return;
    if (loadingMore) return;
    const nextPage = (meta.current_page ?? 1) + 1;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/gaming-accounts/listings?gameId=${game.id}&page=${nextPage}`, { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger la suite");
      const parsed = parsePaginator<ListingRow>(payload);
      setMeta(parsed.meta);
      setItems((prev) => [...prev, ...parsed.items]);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger la suite");
    } finally {
      setLoadingMore(false);
    }
  };

  const headerTitle = useMemo(() => {
    const suffix = game?.name ? ` • ${game.name}` : gameSlug ? ` • ${gameSlug}` : "";
    return `Comptes Gaming${suffix}`;
  }, [game?.name, gameSlug]);

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white bg-[radial-gradient(circle_at_top,_#1b0d3f,_#04020c_70%)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
          <Link href="/" className="hover:text-white">
            Accueil
          </Link>
          <ChevronRight className="h-4 w-4 text-white/30" />
          <span className="text-white/70">Comptes Gaming</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
          <span className="text-white/80">{game?.name ?? gameSlug}</span>
        </div>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{headerTitle}</h1>
            <p className="mt-1 text-sm text-white/60">Marketplace — annonces de vendeurs vérifiés.</p>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-black/40 p-4 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans les annonces (client)…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-fuchsia-300/40"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && gameSlug && !game ? (
          <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-white/70">
            Jeu introuvable.
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <div className="h-40 rounded-2xl bg-white/10" />
                    <div className="mt-4 h-4 w-3/4 rounded bg-white/10" />
                    <div className="mt-2 h-3 w-5/6 rounded bg-white/10" />
                    <div className="mt-6 h-10 w-full rounded-xl bg-white/10" />
                  </div>
                ))
              ) : items.length ? (
                items.map((row) => {
                  const priceValue = Number(row?.price ?? 0);
                  const safePrice = Number.isFinite(priceValue) ? Math.max(0, Math.round(priceValue)) : 0;
                  const title = String(row?.title ?? "Annonce").trim() || "Annonce";
                  const desc = String(row?.description ?? "").trim();
                  const imgRaw = String(row?.image_url ?? "").trim() || String(row?.game?.image ?? game?.image ?? "").trim();
                  const img = imgRaw ? (toDisplayImageSrc(imgRaw) ?? imgRaw) : null;
                  const badges = Array.isArray(row?.seller_trust?.badges) ? row.seller_trust.badges : [];

                  return (
                    <Link
                      key={row.id}
                      href={`/comptes-gaming/${row.id}`}
                      className="group overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-5 shadow-[0_25px_80px_rgba(4,6,35,0.6)] transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/40"
                    >
                      <div className="relative h-40 w-full overflow-hidden rounded-2xl">
                        {img ? (
                          <Image src={img} alt={title} fill className="object-cover" sizes="(min-width: 1024px) 360px, 90vw" />
                        ) : (
                          <div className="h-full w-full bg-white/10" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent" />
                        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                          {row?.category?.name ? (
                            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                              {String(row.category.name)}
                            </span>
                          ) : null}
                          {badges.includes("verified") ? (
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                              Vendeur vérifié
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-white/60">{String(row?.game?.name ?? game?.name ?? "Compte Gaming")}</p>
                        <h3 className="text-lg font-semibold leading-tight text-white line-clamp-2">{title}</h3>
                        {desc ? <p className="text-sm text-white/70 line-clamp-2">{desc}</p> : null}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <p className="text-xl font-black text-fuchsia-200">{formatNumber(safePrice)} FCFA</p>
                          {row?.delivery_window_hours ? (
                            <p className="text-xs text-white/50">Livraison sous {Number(row.delivery_window_hours)}h</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5">
                        <span className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white/80 transition group-hover:border-fuchsia-300/40 group-hover:bg-white/10">
                          Voir l'annonce
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="col-span-full rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-white/70">
                  Aucune annonce pour le moment.
                </div>
              )}
            </div>

            {!loading && canLoadMore ? (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingMore ? "Chargement..." : "Charger plus"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
