"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { User, Crown, Wallet, ShoppingBag, LogOut, Shield, Coins, Calendar, Receipt } from "lucide-react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import PremiumBadge from "@/components/ui/PremiumBadge";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type OrderItem = {
  id: number;
  quantity: number;
  price: number;
  product?: { id: number; name: string } | null;
};

type Order = {
  id: number;
  reference?: string | null;
  total_price: number;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
  orderItems?: OrderItem[];
};

function AccountScreen() {
  const { user, logout, authFetch } = useAuth();
  const router = useRouter();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState<{ expiration?: string | null } | null>(null);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("5000");
  const [topupError, setTopupError] = useState<string | null>(null);
  const [topupLoading, setTopupLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const daysRemaining = useMemo(() => {
    const expiration = premiumStatus?.expiration ?? user?.premium_expiration;
    if (!expiration) return null;
    const end = new Date(expiration).getTime();
    const now = Date.now();
    if (Number.isNaN(end)) return null;
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }, [premiumStatus?.expiration, user?.premium_expiration]);

  useEffect(() => {
    let active = true;
    const loadWallet = async () => {
      try {
        const res = await authFetch(`${API_BASE}/wallet`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setWalletBalance(data.balance ?? 0);
        setWalletStatus(data.status ?? null);
      } catch {
        if (!active) return;
        setWalletBalance(null);
      }
    };
    loadWallet();
    return () => {
      active = false;
    };
  }, [authFetch]);

  const handleOpenOrders = async () => {
    setShowOrders(true);
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await authFetch(`${API_BASE}/orders`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setOrdersError(err.message ?? "Impossible de charger les commandes.");
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setOrders(items);
    } catch {
      setOrdersError("Connexion au serveur impossible.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOpenPremium = async () => {
    setShowPremium(true);
    setPremiumLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/premium/status`);
      if (!res.ok) return;
      const data = await res.json();
      setPremiumStatus({ expiration: data.expiration ?? null });
    } finally {
      setPremiumLoading(false);
    }
  };

  const handleTopup = async () => {
    setTopupError(null);
    const amount = Number(topupAmount);
    if (!amount || amount < 100) {
      setTopupError("Montant invalide.");
      return;
    }
    setTopupLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/wallet/topup/init`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTopupError(err.message ?? "Impossible de lancer le paiement.");
        return;
      }
      const data = await res.json();
      if (data?.payment_url) {
        window.location.href = data.payment_url;
      } else {
        setTopupError("Lien de paiement indisponible.");
      }
    } catch {
      setTopupError("Connexion au serveur impossible.");
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 2xl:px-32 py-8 space-y-6">
        <header className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 text-black grid place-items-center shadow-[0_10px_30px_rgba(110,231,255,0.35)]">
            <User className="h-7 w-7" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">Mon compte</p>
            <h1 className="text-2xl font-bold">Profil BADBOY</h1>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5 border border-white/10 card-hover"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 grid place-items-center text-black shadow-[0_10px_30px_rgba(110,231,255,0.35)]">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg">{user?.name}</h3>
                {user?.is_premium && <PremiumBadge level={(user.premium_level ?? 1) >= 2 ? "Platine" : "Or"} />}
              </div>
              <p className="text-sm text-white/70">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
                <Shield className="h-4 w-4 text-cyan-200" /> Compte sécurisé Sanctum
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr,0.6fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-5 border border-white/10"
          >
            <SectionTitle eyebrow="Wallet" label="BD Wallet" />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/5 grid place-items-center text-emerald-200">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-white/70">Solde disponible</p>
                  <p className="text-2xl font-bold">
                    {walletBalance !== null ? `${walletBalance.toLocaleString()} FCFA` : "-- FCFA"}
                  </p>
                </div>
              </div>
              <GlowButton variant="secondary" className="px-3 py-2" onClick={() => setShowTopup(true)}>
                Recharger
              </GlowButton>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
              <Coins className="h-4 w-4 text-amber-200" /> Cashback premium activé
            </div>
            <div className="mt-1 text-xs text-white/50">
              Gains de parrainage crédités sur le BD Wallet.
            </div>
            <div className="mt-2 text-xs text-white/50">
              {walletStatus ? `Statut: ${walletStatus}` : "BD Wallet actif"}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-5 border border-white/10 space-y-3"
          >
            <SectionTitle eyebrow="Actions" label="Accès rapide" />
            <div className="grid grid-cols-1 gap-2">
              <GlowButton variant="secondary" className="w-full justify-start" onClick={handleOpenOrders}>
                <ShoppingBag className="h-5 w-5" />
                Mes Commandes
              </GlowButton>
              <GlowButton variant="secondary" className="w-full justify-start" onClick={handleOpenPremium}>
                <Crown className="h-5 w-5" />
                Gérer Premium
              </GlowButton>
              <GlowButton
                variant="ghost"
                className="w-full justify-start text-red-300 hover:text-red-200"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                Déconnexion
              </GlowButton>
            </div>
          </motion.div>
        </div>
      </div>

      {showOrders && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border border-white/10 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Historique des commandes</h3>
              <button className="text-xs text-white/50 hover:text-white" onClick={() => setShowOrders(false)}>
                Fermer
              </button>
            </div>
            {ordersLoading ? (
              <p className="text-sm text-white/60">Chargement...</p>
            ) : ordersError ? (
              <p className="text-sm text-amber-200">{ordersError}</p>
            ) : orders.length ? (
              <div className="space-y-3">
                {orders.map((order) => {
                  const items = order.orderItems ?? order.order_items ?? [];
                  return (
                    <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">
                            {order.reference ?? `Commande #${order.id}`}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
                          {order.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <div className="text-white/70">Articles: {items.length}</div>
                        <div className="font-bold text-cyan-200">
                          {Number(order.total_price).toLocaleString()} FCFA
                        </div>
                      </div>
                      {items.length > 0 && (
                        <div className="mt-2 text-xs text-white/60">
                          {items.slice(0, 3).map((item) => item.product?.name ?? "Produit").join(" • ")}
                          {items.length > 3 ? "…" : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                Aucune commande pour l'instant.
              </div>
            )}
          </div>
        </div>
      )}

      {showPremium && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border border-white/10 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Gérer Premium</h3>
              <button className="text-xs text-white/50 hover:text-white" onClick={() => setShowPremium(false)}>
                Fermer
              </button>
            </div>
            {premiumLoading ? (
              <p className="text-sm text-white/60">Chargement...</p>
            ) : user?.is_premium ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/70">Statut premium actif</p>
                  <p className="text-lg font-bold text-cyan-200 mt-1">
                    {daysRemaining !== null ? `${daysRemaining} jours restants` : "Expiration inconnue"}
                  </p>
                </div>
                <GlowButton variant="secondary" className="w-full justify-center" disabled>
                  Résilier (bientôt)
                </GlowButton>
                <p className="text-xs text-white/50">
                  Tu peux résilier à tout moment. L'abonnement reste actif jusqu'à la date d'expiration.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                Tu n'es pas encore premium.
              </div>
            )}
          </div>
        </div>
      )}

      {showTopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border border-white/10 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Recharger BD Wallet</h3>
              <button className="text-xs text-white/50 hover:text-white" onClick={() => setShowTopup(false)}>
                Fermer
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-white/70">Montant (FCFA)</label>
              <input
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
              />
              {topupError && <p className="text-xs text-amber-200">{topupError}</p>}
            </div>
            <GlowButton className="w-full justify-center" onClick={handleTopup} disabled={topupLoading}>
              <Receipt className="h-4 w-4" />
              {topupLoading ? "Paiement..." : "Payer maintenant"}
            </GlowButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Account() {
  return (
    <RequireAuth>
      <AccountScreen />
    </RequireAuth>
  );
}