"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ChevronRight, House, Search } from "lucide-react";
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
  account_region?: string | null;
  game?: { id: number; name?: string | null; image?: string | null } | null;
  category?: { id: number; name?: string | null } | null;
  seller_trust?: { badges?: string[]; successRate?: number; totalSales?: number } | null;
  seller_company_name?: string | null;
};

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  next_page_url?: string | null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (!Array.isArray(arr) || size <= 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

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

function MobileListingThumb({
  title,
  candidates,
}: {
  title: string;
  candidates: string[];
}) {
  const normalized = useMemo(
    () => candidates.map((src) => String(src ?? "").trim()).filter(Boolean),
    [candidates],
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [normalized.join("|")]);

  const current = normalized[idx] ?? null;

  if (!current) {
    return <div className="h-full w-full bg-white/10" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={title}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setIdx((prev) => (prev + 1 < normalized.length ? prev + 1 : prev));
      }}
    />
  );
}

export default function GamingAccountsByGamePage() {
  const params = useParams();
  const gameSlug = String((params?.gameSlug as string) ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<MenuGame | null>(null);
  const [rows, setRows] = useState<ListingRow[]>([]);
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
      setRows([]);
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
          setRows([]);
          setMeta(null);
          return;
        }

        const listRes = await fetch(`${API_BASE}/gaming-accounts/listings?gameId=${found.id}`, { cache: "no-store" });
        const listPayload = await listRes.json().catch(() => null);
        if (!active) return;
        if (!listRes.ok) throw new Error(listPayload?.message ?? "Impossible de charger les annonces");
        const parsed = parsePaginator<ListingRow>(listPayload);
        setRows(parsed.items);
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

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;

    const needleDigits = needle.replace(/\D+/g, "");
    return rows.filter(
      (row) => {
        const matchesText =
          String(row?.title ?? "").toLowerCase().includes(needle) ||
          String(row?.description ?? "").toLowerCase().includes(needle) ||
          String(row?.seller_company_name ?? "").toLowerCase().includes(needle);

        if (matchesText) return true;

        if (!needleDigits) return false;

        const rawPriceDigits = String(row?.price ?? "").replace(/\D+/g, "");
        if (rawPriceDigits && rawPriceDigits.includes(needleDigits)) return true;

        const n = Number(row?.price ?? NaN);
        const formattedDigits = Number.isFinite(n) ? formatNumber(Math.max(0, Math.round(n))).replace(/\D+/g, "") : "";
        return Boolean(formattedDigits && formattedDigits.includes(needleDigits));
      },
    );
  }, [rows, query]);

  const mobileRows = useMemo(() => chunkArray(items, 5), [items]);

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
      setRows((prev) => [...prev, ...parsed.items]);
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
            <p className="mt-1 text-sm text-white/60">🎮 Marketplace — annonces de vendeurs vérifiés.</p>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-black/40 p-4 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔎 Rechercher une annonce…"
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
            {/* Mobile: single horizontal row with scroll */}
            <div className="mt-8 sm:hidden">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, rowIdx) => (
                    <div key={rowIdx} className="flex gap-4 overflow-x-auto pb-2 scrollbar-soft">
                      {Array.from({ length: 5 }).map((__, idx) => (
                        <div
                          key={`${rowIdx}_${idx}`}
                          className="flex-none w-[240px] overflow-hidden rounded-[26px] border border-white/10 bg-white/5"
                        >
                          <div className="h-32 bg-white/10" />
                          <div className="p-4">
                            <div className="h-4 w-3/4 rounded bg-white/10" />
                            <div className="mt-2 h-3 w-5/6 rounded bg-white/10" />
                            <div className="mt-4 h-4 w-1/2 rounded bg-white/10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : items.length ? (
                <div className="space-y-4">
                  {mobileRows.map((rowItems, rowIdx) => (
                    <div key={rowIdx} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-soft">
                      {rowItems.map((row) => {
                        const rawId = (row as any)?.id;
                        const listingId = String(rawId ?? "").trim();
                        const priceValue = Number(row?.price ?? 0);
                        const safePrice = Number.isFinite(priceValue) ? Math.max(0, Math.round(priceValue)) : 0;
                        const title = String(row?.title ?? "Annonce").trim() || "Annonce";
                        const desc = String(row?.description ?? "").trim();
                        const imgCandidates = [
                          String(row?.image_url ?? "").trim(),
                          String(row?.game?.image ?? "").trim(),
                          String(game?.image ?? "").trim(),
                        ]
                          .map((raw) => (raw ? (toDisplayImageSrc(raw) ?? raw) : ""))
                          .filter(Boolean);
                        const badges = Array.isArray(row?.seller_trust?.badges) ? row.seller_trust.badges : [];
                        const server = String((row as any)?.account_region ?? "").trim();
                        const sellerCompany = String((row as any)?.seller_company_name ?? "").trim();

                        return (
                          <Link
                            key={listingId || title}
                            href={`/comptes-gaming/${encodeURIComponent(listingId)}`}
                            className="snap-start group flex-none w-[240px] overflow-hidden rounded-[26px] border border-white/10 bg-black/40 shadow-[0_25px_80px_rgba(4,6,35,0.6)] transition hover:border-fuchsia-300/40"
                          >
                            <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/5">
                              <MobileListingThumb title={title} candidates={imgCandidates} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent" />
                              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
                                  ⏱ Livraison 24H
                                </span>
                                {badges.includes("verified") ? (
                                  <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                                    ✅ Vérifié
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="p-4">
                              <p className="text-xs font-medium text-white/60">{String(row?.game?.name ?? game?.name ?? "Compte Gaming")}</p>
                              <h3 className="mt-1 text-base font-semibold leading-tight text-white line-clamp-2">{title}</h3>
                              {desc ? <p className="mt-1 text-xs text-white/70 line-clamp-2">{desc}</p> : null}
                              {sellerCompany ? (
                                <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-xl border border-fuchsia-300/35 bg-gradient-to-r from-fuchsia-500/20 via-violet-500/20 to-cyan-500/20 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100">
                                  <House className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                                  <span className="truncate">{sellerCompany}</span>
                                </div>
                              ) : null}
                              {server ? <p className="mt-1 text-[11px] text-white/55">🌍 Serveur : {server}</p> : null}
                              <div className="mt-3">
                                <p className="text-lg font-black text-fuchsia-200">{formatNumber(safePrice)} FCFA</p>
                                <p className="text-[11px] text-white/50">⏱ Livraison sous 24h</p>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-white/70">
                  Aucune annonce pour le moment.
                </div>
              )}
            </div>

            {/* Tablet/Desktop: keep grid */}
            <div className="mt-8 hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {loading ? (
                Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <div className="h-40 rounded-2xl bg-white/10" />
                    <div className="mt-4 h-4 w-3/4 rounded bg-white/10" />
                    <div className="mt-2 h-3 w-5/6 rounded bg-white/10" />
                  </div>
                ))
              ) : items.length ? (
                items.map((row) => {
                  const rawId = (row as any)?.id;
                  const listingId = String(rawId ?? "").trim();
                  const priceValue = Number(row?.price ?? 0);
                  const safePrice = Number.isFinite(priceValue) ? Math.max(0, Math.round(priceValue)) : 0;
                  const title = String(row?.title ?? "Annonce").trim() || "Annonce";
                  const desc = String(row?.description ?? "").trim();
                  const imgRaw = String(row?.image_url ?? "").trim() || String(row?.game?.image ?? game?.image ?? "").trim();
                  const img = imgRaw ? (toDisplayImageSrc(imgRaw) ?? imgRaw) : null;
                  const badges = Array.isArray(row?.seller_trust?.badges) ? row.seller_trust.badges : [];
                  const server = String((row as any)?.account_region ?? "").trim();
                  const sellerCompany = String((row as any)?.seller_company_name ?? "").trim();

                  return (
                    <Link
                      key={listingId || title}
                      href={`/comptes-gaming/${encodeURIComponent(listingId)}`}
                      className="group overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-5 shadow-[0_25px_80px_rgba(4,6,35,0.6)] transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/40"
                    >
                      <div className="relative h-40 w-full overflow-hidden rounded-2xl">
                        {img ? (
                          <Image
                            src={img}
                            alt={title}
                            fill
                            className="object-cover"
                            sizes="(min-width: 1024px) 360px, 90vw"
                            unoptimized
                          />
                        ) : (
                          <div className="h-full w-full bg-white/10" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent" />
                        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                            ⏱ Livraison 24H
                          </span>
                          {badges.includes("verified") ? (
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                              ✅ Vendeur vérifié
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-white/60">{String(row?.game?.name ?? game?.name ?? "Compte Gaming")}</p>
                        <h3 className="text-lg font-semibold leading-tight text-white line-clamp-2">{title}</h3>
                        {desc ? <p className="text-sm text-white/70 line-clamp-2">{desc}</p> : null}
                        {sellerCompany ? (
                          <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-fuchsia-300/35 bg-gradient-to-r from-fuchsia-500/20 via-violet-500/20 to-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-100">
                            <House className="h-4 w-4 shrink-0 text-cyan-200" />
                            <span className="truncate">{sellerCompany}</span>
                          </div>
                        ) : null}
                        {server ? <p className="text-xs text-white/55">🌍 Serveur : {server}</p> : null}
                      </div>

                      <div className="mt-4">
                        <p className="text-xl font-black text-fuchsia-200">{formatNumber(safePrice)} FCFA</p>
                        <p className="text-xs text-white/50">⏱ Livraison sous 24h</p>
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
