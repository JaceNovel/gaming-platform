"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import ImmersiveBackground from "@/components/layout/ImmersiveBackground";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type MenuGame = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  image?: string | null;
};

type CategoryKey = "recharges" | "abonnements" | "accessoires";

const FIXED_BG = "/images/WhatsApp%20Image%202026-02-06%20at%2003.44.47.jpeg";

const CATEGORIES: Array<{
  key: CategoryKey;
  title: string;
  emoji: string;
  needsGame: boolean;
}> = [
  { key: "recharges", title: "Recharges", emoji: "🎮", needsGame: true },
  { key: "abonnements", title: "Abonnements", emoji: "👑", needsGame: true },
  { key: "accessoires", title: "Accessoires", emoji: "🛒", needsGame: false },
];

const emojiForGame = (g: MenuGame): string | null => {
  const name = String(g?.name ?? "").toLowerCase();
  const slug = String(g?.slug ?? "").toLowerCase();
  if (name.includes("free fire") || slug.includes("free-fire") || slug === "freefire") return "🔥";
  return null;
};

const parseGamesPayload = (payload: any): MenuGame[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as MenuGame[];
  if (Array.isArray(payload?.data)) return payload.data as MenuGame[];
  if (Array.isArray(payload?.data?.data)) return payload.data.data as MenuGame[];
  return [];
};

const contextForCategory = (key: CategoryKey) => {
  if (key === "recharges") return "recharge";
  if (key === "abonnements") return "subscription";
  return null;
};

const hrefForSelection = (key: CategoryKey, gameSlug?: string) => {
  if (key === "accessoires") return "/accessoires";
  if (!gameSlug) return "/shop";
  if (key === "recharges") return `/recharges/${encodeURIComponent(gameSlug)}`;
  if (key === "abonnements") return `/abonnements/${encodeURIComponent(gameSlug)}`;
  return "/shop";
};

export default function ShopPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<MenuGame[]>([]);
  const [query, setQuery] = useState("");

  const copy = useMemo(
    () =>
      language === "fr"
        ? {
            redirecting: "Redirection...",
            title: "Catégorie",
            subtitle: "Sélectionne le type d'achat que tu souhaites.",
            loadGames: "Impossible de charger les jeux",
            loadGeneric: "Impossible de charger",
            gameFallback: "Jeux",
            categories: {
              recharges: "Recharges",
              abonnements: "Abonnements",
              accessoires: "Accessoires",
            },
            helpPrefix: "Besoin d’aide ? Va sur",
            helpLink: "Aide",
            chooseGame: "Choisir un jeu",
            close: "Fermer",
            search: "Rechercher un jeu...",
            offers: "Voir les offres",
            empty: "Aucun jeu trouvé.",
          }
        : {
            redirecting: "Redirecting...",
            title: "Category",
            subtitle: "Select the type of purchase you want.",
            loadGames: "Unable to load games",
            loadGeneric: "Unable to load",
            gameFallback: "Games",
            categories: {
              recharges: "Top-ups",
              abonnements: "Subscriptions",
              accessoires: "Accessories",
            },
            helpPrefix: "Need help? Go to",
            helpLink: "Help",
            chooseGame: "Choose a game",
            close: "Close",
            search: "Search a game...",
            offers: "View offers",
            empty: "No game found.",
          },
    [language],
  );

  const categories = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        ...category,
        title: copy.categories[category.key],
      })),
    [copy.categories],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(Boolean(mq.matches));
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    router.replace("/recharges");
  }, [isDesktop, router]);

  const openCategory = (key: CategoryKey) => {
    if (key === "accessoires") {
      router.push("/accessoires");
      return;
    }
    setActiveCategory(key);
    setModalOpen(true);
    setQuery("");
  };

  useEffect(() => {
    if (!modalOpen) return;
    if (!activeCategory) return;
    const ctx = contextForCategory(activeCategory);
    if (!ctx) return;

    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/games?active=1&context=${encodeURIComponent(ctx)}&per_page=200`, {
          headers: { Accept: "application/json" },
        });
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) throw new Error(payload?.message ?? copy.loadGames);
        setGames(parseGamesPayload(payload));
      } catch (e: any) {
        if (!active) return;
        setGames([]);
        setError(e?.message ?? copy.loadGeneric);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeCategory, copy.loadGames, copy.loadGeneric, modalOpen]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return games;
    return games.filter((g) => String(g?.name ?? "").toLowerCase().includes(needle));
  }, [games, query]);

  const activeTitle = useMemo(() => {
    const found = categories.find((c) => c.key === activeCategory);
    return found?.title ?? copy.gameFallback;
  }, [activeCategory, categories, copy.gameFallback]);

  if (isDesktop) {
    return (
      <main className="min-h-[100dvh] bg-[#04020c] text-white grid place-items-center px-6">
        <p className="text-sm text-white/70">{copy.redirecting}</p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-transparent text-white">
      <ImmersiveBackground imageSrc={FIXED_BG} overlayClassName="bg-black/70" />

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="text-sm text-white/60">{copy.subtitle}</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => openCategory(c.key)}
              className="group text-left overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-5 transition hover:border-cyan-300/30"
            >
              <div className="min-w-0">
                <p className="text-lg font-black text-white">{c.title}</p>
              </div>

              <div className="relative mt-6 h-28 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="absolute inset-0 grid place-items-center text-6xl leading-none text-white/90">
                  <span className="select-none">{c.emoji}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              </div>
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/45">
          {copy.helpPrefix} <Link className="underline hover:text-white" href="/help">{copy.helpLink}</Link>
        </p>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/75"
            onClick={() => {
              setModalOpen(false);
              setActiveCategory(null);
            }}
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-black/70 backdrop-blur shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">{copy.chooseGame}</p>
                <p className="mt-1 text-base font-semibold text-white">{activeTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setActiveCategory(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:text-white"
                aria-label={copy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={copy.search}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-cyan-300/40"
                />
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <div className="mt-4 max-h-[56vh] space-y-2 overflow-y-auto pr-1 scrollbar-soft">
                {loading
                  ? Array.from({ length: 7 }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="h-10 w-10 rounded-xl bg-white/10" />
                        <div className="h-3 w-2/3 rounded bg-white/10" />
                      </div>
                    ))
                  : filtered.map((g) => {
                      const img = g.image ?? g.icon ?? null;
                      const imageSrc = img ? (toDisplayImageSrc(img) ?? img) : null;
                      const emoji = emojiForGame(g);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            if (!activeCategory) return;
                            const href = hrefForSelection(activeCategory, g.slug);
                            setModalOpen(false);
                            setActiveCategory(null);
                            router.push(href);
                          }}
                          className="w-full text-left flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-cyan-300/30"
                        >
                          <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                            {imageSrc ? (
                              <Image src={imageSrc} alt={g.name} fill className="object-cover" sizes="44px" />
                            ) : (
                              <div className="grid h-full w-full place-items-center bg-white/10 text-lg text-white/80">
                                {emoji ?? "🎮"}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                            <p className="text-xs text-white/55">{copy.offers}</p>
                          </div>
                        </button>
                      );
                    })}

                {!loading && !error && filtered.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
                    {copy.empty}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
