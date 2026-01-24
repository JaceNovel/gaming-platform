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
  const { authFetch } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeMenu, setActiveMenu] = useState<
    "MesCommandes" | "Wallet" | "VIP" | "Principal" | "Parametres"
  >("Principal");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState<string>("shadow_default");
  const [saving, setSaving] = useState(false);

  const avatar = useMemo(() => {
    const id = me?.avatarId || "shadow_default";
    return AVATARS.find((a) => a.id === id) || AVATARS[0];
  }, [me?.avatarId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await authFetch(`${API_BASE}/me`);
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setMe(data.me);
    })();
    return () => {
      active = false;
    };
  }, [authFetch]);

  useEffect(() => {
    let active = true;
    (async () => {
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

  if (!me) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse opacity-70">Chargement...</div>
      </div>
    );
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
                  {orders.map((o) => (
                    <div key={o.id} className="grid grid-cols-[1fr_140px_140px] gap-3 px-4 py-4 items-center">
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
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-300/20 text-xs font-semibold">
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