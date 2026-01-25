"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import AvatarPickerModal from "@/components/profile/AvatarPickerModal";
import { API_BASE } from "@/lib/config";

type Me = {
  username: string;
  countryCode: string | null;
  countryName?: string | null;
  avatarId: string;
  walletBalanceFcfa: number;
  premiumTier: "Bronze" | "Or" | "Platine" | string;
};

type Order = {
  id: string;
  title: string;
  game: string;
  priceFcfa: number;
  status: "COMPLÉTÉ" | "EN_COURS" | "ÉCHOUÉ";
  thumb: string;
};

const AVATARS = [
  { id: "shadow_default", name: "Shadow", src: "/avatars/shadow.png" },
  { id: "neon_assassin", name: "Neon Assassin", src: "/avatars/neon_assassin.png" },
  { id: "cyber_samurai", name: "Cyber Samurai", src: "/avatars/cyber_samurai.png" },
  { id: "space_valkyrie", name: "Space Valkyrie", src: "/avatars/space_valkyrie.png" },
  { id: "void_mage", name: "Void Mage", src: "/avatars/void_mage.png" },
  { id: "arc_reaper", name: "Arc Reaper", src: "/avatars/arc_reaper.png" },
  { id: "nova_ranger", name: "Nova Ranger", src: "/avatars/nova_ranger.png" },
  { id: "plasma_knight", name: "Plasma Knight", src: "/avatars/plasma_knight.png" },
  { id: "glitch_hunter", name: "Glitch Hunter", src: "/avatars/glitch_hunter.png" },
  { id: "star_merc", name: "Star Merc", src: "/avatars/star_merc.png" },
];

const thumbs = ["/thumbs/lol.png", "/thumbs/ml.png", "/thumbs/ff.png", "/thumbs/ff2.png"];
const HAS_API_ENV = Boolean(process.env.NEXT_PUBLIC_API_URL);

const DEFAULT_ORDERS: Order[] = [
  {
    id: "BB-9001",
    title: "Compte Légendaire",
    game: "Free Fire",
    priceFcfa: 18000,
    status: "COMPLÉTÉ",
    thumb: thumbs[0],
  },
  {
    id: "BB-9002",
    title: "Recharge Express 5k",
    game: "Mobile Legends",
    priceFcfa: 5000,
    status: "EN_COURS",
    thumb: thumbs[1],
  },
  {
    id: "BB-9003",
    title: "Pack Accessoires",
    game: "Globale",
    priceFcfa: 9500,
    status: "ÉCHOUÉ",
    thumb: thumbs[2],
  },
];

const normalizeMe = (payload: any, baseline: Me | null): Me => {
  const fallback =
    baseline ??
    ({
      username: "BADBOY",
      countryCode: "CI",
      countryName: "Côte d'Ivoire",
      avatarId: "shadow_default",
      walletBalanceFcfa: 0,
      premiumTier: "Bronze",
    } satisfies Me);

  return {
    username: payload?.username ?? payload?.name ?? fallback.username,
    countryCode: payload?.countryCode ?? payload?.country_code ?? fallback.countryCode ?? null,
    countryName: payload?.countryName ?? payload?.country_name ?? fallback.countryName ?? null,
    avatarId: payload?.avatarId ?? payload?.avatar_id ?? fallback.avatarId,
    walletBalanceFcfa:
      Number(
        payload?.walletBalanceFcfa ??
          payload?.wallet_balance_fcfa ??
          payload?.wallet_balance ??
          fallback.walletBalanceFcfa,
      ) || 0,
    premiumTier: payload?.premiumTier ?? payload?.premium_tier ?? payload?.premium_level ?? fallback.premiumTier,
  } satisfies Me;
};

const statusBadgeClass = (status: Order["status"]) => {
  if (status === "COMPLÉTÉ") return "bg-emerald-400/20 border-emerald-300/30 text-emerald-100";
  if (status === "ÉCHOUÉ") return "bg-rose-500/20 border-rose-400/30 text-rose-100";
  return "bg-amber-400/20 border-amber-300/30 text-amber-100";
};

function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#020109] text-white flex items-center justify-center">
      <div className="relative flex flex-col items-center gap-6">
        <div className="relative h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-amber-400 opacity-40 blur-2xl" />
          <div className="absolute inset-[8px] rounded-full border border-white/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-cyan-300 animate-[spin_6s_linear_infinite]" />
        </div>
        <div className="text-center">
          <p className="text-xs tracking-[0.4em] text-white/60">MON COMPTE</p>
          <p className="mt-3 text-lg font-semibold">Initialisation du cockpit joueur...</p>
        </div>
      </div>
    </div>
  );
}

const formatFcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const mapOrderStatus = (status?: string): Order["status"] => {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "paid" || normalized === "delivered" || normalized === "success") {
    return "COMPLÉTÉ";
  }
  if (normalized === "failed" || normalized === "canceled") {
    return "ÉCHOUÉ";
  }
  return "EN_COURS";
};

function AccountClient() {
  const { authFetch, user, loading: authLoading } = useAuth();
  const fallbackProfile = useMemo<Me | null>(() => {
    if (!user) return null;
    return {
      username: user.name ?? "BADBOY",
      countryCode: "CI",
      countryName: "Côte d'Ivoire",
      avatarId: user.is_premium ? "cyber_samurai" : "neon_assassin",
      walletBalanceFcfa: user.is_premium ? 150000 : 42000,
      premiumTier: user.is_premium ? "Platine" : "Bronze",
    } satisfies Me;
  }, [user]);

  const [me, setMe] = useState<Me | null>(fallbackProfile);
  const [orders, setOrders] = useState<Order[]>(DEFAULT_ORDERS);
  const [activeMenu, setActiveMenu] = useState<
    "MesCommandes" | "Wallet" | "VIP" | "Principal" | "Parametres"
  >("Principal");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState<string>("shadow_default");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(HAS_API_ENV);
  const [loadingOrders, setLoadingOrders] = useState(HAS_API_ENV);

  const avatar = useMemo(() => {
    const id = me?.avatarId || "shadow_default";
    return AVATARS.find((a) => a.id === id) || AVATARS[0];
  }, [me?.avatarId]);

  useEffect(() => {
    if (fallbackProfile && !me) {
      setMe(fallbackProfile);
    }
  }, [fallbackProfile, me]);

  useEffect(() => {
    let active = true;
    if (!HAS_API_ENV) {
      setLoadingProfile(false);
      return () => {
        active = false;
      };
    }
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/me`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        if (data?.me || data) {
          setMe(normalizeMe(data?.me ?? data, fallbackProfile));
        }
      } catch (error) {
        console.warn("Profil indisponible", error);
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch, fallbackProfile]);

  useEffect(() => {
    let active = true;
    if (!HAS_API_ENV) {
      setLoadingOrders(false);
      return () => {
        active = false;
      };
    }
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/orders`);
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        if (!active) return;
        const mapped = items.map((order: any, idx: number) => {
          const orderItems = order.orderItems ?? order.order_items ?? [];
          const title = orderItems[0]?.product?.name ?? order.reference ?? `Commande ${order.id}`;
          return {
            id: String(order.reference ?? order.id),
            title,
            game: orderItems[0]?.product?.name ? "BADBOYSHOP" : "BADBOYSHOP",
            priceFcfa: Number(order.total_price ?? 0),
            status: mapOrderStatus(order.status),
            thumb: thumbs[idx % thumbs.length],
          } as Order;
        });
        setOrders(mapped);
      } catch (error) {
        console.warn("Commandes indisponibles", error);
      } finally {
        if (active) setLoadingOrders(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch]);

  useEffect(() => {
    if (me?.avatarId) setPendingAvatarId(me.avatarId);
  }, [me?.avatarId]);

  async function saveAvatar() {
    if (!me) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: pendingAvatarId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMe(data.me);
        setPickerOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!me || authLoading || loadingProfile) {
    return <ProfileLoading />;
  }

  const missingCountry = !me.countryCode;

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[url('/backgrounds/profile.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.35),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.25),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.2),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.9))]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
      </div>

      <main className="w-full px-5 md:px-10 lg:px-12 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          <ProfileSidebar
            username={me.username}
            premiumTier={me.premiumTier}
            countryCode={me.countryCode}
            activeMenu={activeMenu}
            onChangeMenu={setActiveMenu}
          />

          <section className="space-y-8">
            {missingCountry && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                Pays manquant. Merci de compléter ton pays dans le profil pour afficher le drapeau.
              </div>
            )}
            <ProfileHeader
              username={me.username}
              countryCode={me.countryCode}
              premiumTier={me.premiumTier}
              avatar={avatar}
              walletBalance={me.walletBalanceFcfa}
              onChangeAvatar={() => setPickerOpen(true)}
              onAddFunds={() => setPickerOpen(false)}
              onUseFunds={() => setPickerOpen(false)}
            />

            <div className="rounded-[32px] bg-black/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Mes commandes</h2>
                <button className="text-sm opacity-70 hover:opacity-100">Voir tout →</button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-[1fr_140px_140px] gap-3 px-4 py-3 text-xs uppercase tracking-wider opacity-70 bg-white/5">
                  <div>Commande</div>
                  <div className="text-right">Prix</div>
                  <div className="text-right">Status</div>
                </div>

                <div className="divide-y divide-white/10">
                  {(loadingOrders ? DEFAULT_ORDERS : orders).map((o) => (
                    <div
                      key={o.id}
                      className={`grid grid-cols-[1fr_140px_140px] gap-3 px-4 py-4 items-center ${
                        loadingOrders ? "opacity-60 animate-pulse" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                          <Image src={o.thumb} alt="" fill className="object-cover" />
                        </div>
                        <div>
                          <div className="font-semibold">
                            {o.title} <span className="opacity-70 font-normal">/ {o.game}</span>
                          </div>
                          <div className="text-xs opacity-60">Commande {o.id}</div>
                        </div>
                      </div>
                      <div className="text-right font-semibold">{formatFcfa(o.priceFcfa)}</div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center justify-center px-3 py-1 rounded-full border text-xs font-semibold ${
                            statusBadgeClass(o.status)
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {activeMenu === "Parametres" && (
                <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="font-semibold">Paramètres</div>
                  <div className="text-sm opacity-75 mt-1">
                    Personnage actuel: <span className="font-semibold">{avatar.name}</span>
                  </div>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="mt-3 px-4 py-2 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/15 transition text-sm"
                  >
                    Choisir un personnage
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <AvatarPickerModal
        open={pickerOpen}
        avatars={AVATARS}
        pendingAvatarId={pendingAvatarId}
        onSelect={setPendingAvatarId}
        onClose={() => setPickerOpen(false)}
        onSave={saveAvatar}
        saving={saving}
      />
    </div>
  );
}

export default function Account() {
  return (
    <RequireAuth>
      <AccountClient />
    </RequireAuth>
  );
}