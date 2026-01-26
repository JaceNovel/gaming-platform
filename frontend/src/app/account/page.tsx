"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Globe, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import AvatarPickerModal from "@/components/profile/AvatarPickerModal";
import PlayerProfileCard from "@/components/profile/PlayerProfileCard";
import type { DashboardMenuId } from "@/components/profile/dashboardMenu";
import { API_BASE } from "@/lib/config";

const HAS_API_ENV = Boolean(process.env.NEXT_PUBLIC_API_URL);

type MenuKey = DashboardMenuId;

type Me = {
  username: string;
  countryCode: string | null;
  countryName: string | null;
  avatarId: string;
  walletBalanceFcfa: number;
  premiumTier: string;
};

type OrderStatus = "COMPLÉTÉ" | "ÉCHOUÉ" | "EN_COURS";

type Order = {
  id: string;
  title: string;
  game: string;
  priceFcfa: number;
  status: OrderStatus;
  thumb: string;
  shippingStatus?: string | null;
  shippingEtaDays?: number | null;
  shippingEstimatedDate?: string | null;
  hasPhysicalItems?: boolean;
};

type WalletTransaction = {
  id: string;
  label: string;
  amount: number;
  currency: string;
  createdAt: string;
  type: "credit" | "debit";
  status: "success" | "pending" | "failed";
};

type Avatar = {
  id: string;
  name: string;
  src: string;
};

type VipPlan = {
  level: string;
  label: string;
};

const AVATARS: Avatar[] = [
  { id: "nova_ghost", name: "Nova Ghost", src: "/images/badboyshop-logo.png" },
  { id: "stellar_viper", name: "Stellar Viper", src: "/images/badboyshop-logo.png" },
  { id: "neon_rider", name: "Neon Rider", src: "/images/badboyshop-logo.png" },
];

const VIP_PLANS: VipPlan[] = [];

const getCurrencyInfo = (code?: string | null) => {
  const normalized = (code ?? "CI").toUpperCase();
  if (["FR", "BE"].includes(normalized)) return { label: "EUR", locale: "fr-FR" };
  if (normalized === "US") return { label: "USD", locale: "en-US" };
  return { label: "FCFA", locale: "fr-FR" };
};

const formatCurrency = (value: number, code?: string | null) => {
  const info = getCurrencyInfo(code);
  const currency = info.label === "FCFA" ? "XOF" : info.label;
  const formatted = new Intl.NumberFormat(info.locale, { style: "currency", currency }).format(value);
  return info.label === "FCFA" ? formatted.replace("XOF", "FCFA") : formatted;
};

const mapOrderStatus = (status?: string | null): OrderStatus => {
  const normalized = String(status ?? "").toLowerCase();
  if (["paid", "complete", "completed", "success", "delivered"].includes(normalized)) return "COMPLÉTÉ";
  if (["failed", "cancelled", "canceled", "error", "refused"].includes(normalized)) return "ÉCHOUÉ";
  return "EN_COURS";
};

function ProfileLoading() {
  return (
    <div className="min-h-screen px-5 py-12 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-white/10" />
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
          <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}

const DEFAULT_ORDERS: Order[] = [];
const DEFAULT_WALLET_TRANSACTIONS: WalletTransaction[] = [];

const COUNTRY_OPTIONS = [
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Bénin" },
  { code: "SN", name: "Sénégal" },
  { code: "CM", name: "Cameroun" },
  { code: "GN", name: "Guinée" },
  { code: "ML", name: "Mali" },
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgique" },
  { code: "US", name: "États-Unis" },
];

const normalizeMe = (payload: any, baseline: Me | null): Me => {
  const fallback =
    baseline ??
    ({
      username: "BADBOY",
      countryCode: "CI",
      countryName: "Côte d'Ivoire",
      avatarId: "nova_ghost",
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

function AccountClient() {
  const { authFetch, user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const fallbackProfile = useMemo<Me | null>(() => {
    if (!user) return null;
    const legacyUser =
      user as typeof user & {
        username?: string;
        country_code?: string;
        country?: string;
        country_name?: string;
        wallet_balance?: number;
        walletBalance?: number;
        premiumTier?: string;
        premium_tier?: string;
        premium_level?: string;
        is_premium?: boolean;
      };
    const countryCode =
      (typeof legacyUser.country_code === "string" && legacyUser.country_code.length > 0
        ? legacyUser.country_code
        : typeof legacyUser.country === "string"
          ? legacyUser.country
          : null) ?? null;
    const walletRaw = Number(legacyUser.wallet_balance ?? legacyUser.walletBalance ?? 0);
    const walletBalance = Number.isFinite(walletRaw) ? walletRaw : 0;
    const premiumTierRaw = legacyUser.premiumTier ?? legacyUser.premium_tier ?? legacyUser.premium_level;
    const premiumTierResolved = premiumTierRaw
      ? String(premiumTierRaw)
      : legacyUser.is_premium
        ? "Platine"
        : "Basic";
    return {
      username: user.name ?? legacyUser.username ?? "BADBOY",
      countryCode,
      countryName: legacyUser.country_name ?? null,
      avatarId: legacyUser.is_premium ? "stellar_viper" : "nova_ghost",
      walletBalanceFcfa: walletBalance,
      premiumTier: premiumTierResolved,
    } satisfies Me;
  }, [user]);

  const [me, setMe] = useState<Me | null>(fallbackProfile);
  const [orders, setOrders] = useState<Order[]>(DEFAULT_ORDERS);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("Principal");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState<string>("nova_ghost");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(HAS_API_ENV);
  const [loadingOrders, setLoadingOrders] = useState(HAS_API_ENV);
  const [passwordForm, setPasswordForm] = useState({ current: "", password: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "success" | "error">("idle");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const disablePasswordForm = !HAS_API_ENV;
  const disableCountryForm = !HAS_API_ENV;
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(DEFAULT_WALLET_TRANSACTIONS);
  const [walletHistoryLoading, setWalletHistoryLoading] = useState(HAS_API_ENV);
  const [walletBalanceState, setWalletBalanceState] = useState(me?.walletBalanceFcfa ?? 0);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeProcessing, setRechargeProcessing] = useState(false);
  const [rechargeStatus, setRechargeStatus] = useState<"idle" | "success" | "error">("idle");
  const [rechargeMessage, setRechargeMessage] = useState("");
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [countryFormCode, setCountryFormCode] = useState(me?.countryCode ?? "CI");
  const [countrySubmitting, setCountrySubmitting] = useState(false);
  const [countryStatus, setCountryStatus] = useState<"idle" | "success" | "error">("idle");
  const [countryMessage, setCountryMessage] = useState("");

  const avatar = useMemo(() => {
    const id = me?.avatarId || "nova_ghost";
    return AVATARS.find((a) => a.id === id) || AVATARS[0];
  }, [me?.avatarId]);
  const currentTier = (me?.premiumTier ?? "").toLowerCase();
  const vipActive = Boolean(currentTier && currentTier !== "aucun" && currentTier !== "none");
  const currentPlan = VIP_PLANS.find(
    (plan) => plan.level === currentTier || plan.label.toLowerCase() === currentTier,
  );

  useEffect(() => {
    if (fallbackProfile && !me) {
      setMe(fallbackProfile);
    }
  }, [fallbackProfile, me]);

  useEffect(() => {
    if (me?.countryCode) {
      setCountryFormCode(me.countryCode);
    }
  }, [me?.countryCode]);

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
        const mapped = items.map((order: any) => {
          const orderItems = order.orderItems ?? order.order_items ?? [];
          const title = orderItems[0]?.product?.name ?? order.reference ?? `Commande ${order.id}`;
          const hasPhysicalItems = orderItems.some(
            (item: any) => item?.is_physical || item?.product?.shipping_required,
          );
          const product = orderItems[0]?.product ?? {};
          const thumb =
            product?.image_url ??
            product?.imageUrl ??
            product?.cover ??
            product?.details?.cover ??
            product?.game?.cover ??
            "/images/badboyshop-logo.png";
          return {
            id: String(order.reference ?? order.id),
            title,
            game: orderItems[0]?.product?.name ? "BADBOYSHOP" : "BADBOYSHOP",
            priceFcfa: Number(order.total_price ?? 0),
            status: mapOrderStatus(order.status),
            thumb,
            shippingStatus: order.shipping_status ?? null,
            shippingEtaDays: order.shipping_eta_days ?? null,
            shippingEstimatedDate: order.shipping_estimated_date ?? null,
            hasPhysicalItems,
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const updateMatches = () => setIsDesktop(media.matches);
    updateMatches();
    const listener = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, []);

  useEffect(() => {
    if (me?.countryCode) {
      setCountryFormCode(me.countryCode);
    }
  }, [me?.countryCode]);

  useEffect(() => {
    setWalletBalanceState(me?.walletBalanceFcfa ?? 0);
  }, [me?.walletBalanceFcfa]);

  useEffect(() => {
    let active = true;
    if (!HAS_API_ENV) {
      setWalletHistoryLoading(false);
      return () => {
        active = false;
      };
    }

    const loadWalletSummary = async () => {
      try {
        const res = await authFetch(`${API_BASE}/wallet`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const balanceValue =
          typeof data?.balance === "number" ? data.balance : Number(data?.balance ?? 0);
        const normalized = Number.isFinite(balanceValue) ? balanceValue : 0;
        setWalletBalanceState(normalized);
        setMe((prev) => (prev ? { ...prev, walletBalanceFcfa: normalized } : prev));
      } catch (error) {
        console.warn("Wallet indisponible", error);
      }
    };

    const loadWalletTransactions = async () => {
      setWalletHistoryLoading(true);
      try {
        const res = await authFetch(`${API_BASE}/wallet/transactions?limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const rows = Array.isArray(data?.transactions)
          ? data.transactions
          : Array.isArray(data)
            ? data
            : [];
        if (rows.length) {
          setWalletTransactions(
            rows.slice(0, 10).map((tx: any, index: number) => {
              const amountValue = Number(tx.amount ?? 0);
              return {
                id: String(tx.id ?? index),
                label: tx.label ?? tx.description ?? "Transaction wallet",
                amount: amountValue,
                currency: tx.currency ?? getCurrencyInfo(me?.countryCode).label,
                createdAt: tx.created_at ?? tx.createdAt ?? new Date().toISOString(),
                type: amountValue >= 0 ? "credit" : "debit",
                status: tx.status ?? "success",
              } satisfies WalletTransaction;
            }),
          );
        }
      } catch (error) {
        console.warn("Transactions wallet indisponibles", error);
      } finally {
        if (active) setWalletHistoryLoading(false);
      }
    };

    loadWalletSummary();
    loadWalletTransactions();
    return () => {
      active = false;
    };
  }, [authFetch, me?.countryCode]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disablePasswordForm) {
      setPasswordStatus("error");
      setPasswordMessage("API indisponible : impossible de modifier le mot de passe.");
      return;
    }
    setPasswordSubmitting(true);
    setPasswordStatus("idle");
    setPasswordMessage("");
    try {
      const res = await authFetch(`${API_BASE}/auth/password/update`, {
        method: "POST",
        body: JSON.stringify({
          current_password: passwordForm.current,
          password: passwordForm.password,
          password_confirmation: passwordForm.confirm,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = payload?.message ?? "Impossible de mettre à jour le mot de passe";
        throw new Error(msg);
      }
      setPasswordStatus("success");
      setPasswordMessage(payload?.message ?? "Mot de passe mis à jour");
      setPasswordForm({ current: "", password: "", confirm: "" });
    } catch (error: any) {
      setPasswordStatus("error");
      setPasswordMessage(error?.message ?? "Erreur inattendue");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleCountrySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!me) return;
    if (disableCountryForm) {
      setCountryStatus("error");
      setCountryMessage("API indisponible : impossible de changer le pays.");
      return;
    }
    setCountrySubmitting(true);
    setCountryStatus("idle");
    setCountryMessage("");
    try {
      const selected = COUNTRY_OPTIONS.find((opt) => opt.code === countryFormCode);
      const res = await authFetch(`${API_BASE}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: countryFormCode,
          countryName: selected?.name ?? countryFormCode,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = payload?.message ?? "Impossible de mettre à jour le pays.";
        throw new Error(msg);
      }
      setCountryStatus("success");
      setCountryMessage(payload?.message ?? "Pays mis à jour.");
      setMe((prev) =>
        prev
          ? {
              ...prev,
              countryCode: countryFormCode,
              countryName: selected?.name ?? prev.countryName,
            }
          : prev,
      );
    } catch (error: any) {
      setCountryStatus("error");
      setCountryMessage(error?.message ?? "Erreur inattendue");
    } finally {
      setCountrySubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const handleVipEntry = () => {
    if (isDesktop) {
      router.push("/premium");
      return;
    }
    setVipModalOpen(true);
  };

  const handleMenuChange = (menu: MenuKey) => {
    if (menu === "VIP") {
      handleVipEntry();
      return;
    }
    if (menu === "Wallet") {
      setWalletModalOpen(true);
      return;
    }
    if (menu === "MesCommandes") {
      setOrdersModalOpen(true);
      return;
    }
    setActiveMenu(menu);
  };

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

  const closeVipModal = () => {
    setVipModalOpen(false);
  };

  const closeOrdersModal = () => {
    setOrdersModalOpen(false);
  };

  const handleUseFunds = () => {
    router.push("/shop");
  };

  const closeWalletModal = () => {
    setWalletModalOpen(false);
  };

  const handleAddFundsClick = () => {
    setRechargeModalOpen(true);
    setRechargeAmount("");
    setRechargeStatus("idle");
    setRechargeMessage("");
  };

  const closeRechargeModal = () => {
    setRechargeModalOpen(false);
    setRechargeStatus("idle");
    setRechargeMessage("");
    setRechargeAmount("");
  };

  const handleRechargeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountValue = Number(rechargeAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setRechargeStatus("error");
      setRechargeMessage("Montant invalide.");
      return;
    }
    setRechargeProcessing(true);
    setRechargeStatus("idle");
    setRechargeMessage("Connexion à CinetPay...");
    try {
      if (!HAS_API_ENV) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setRechargeStatus("success");
        setRechargeMessage(
          `CinetPay activé pour ${formatCurrency(amountValue, me?.countryCode)} (mode démo).`,
        );
        setWalletBalanceState((prev) => prev + amountValue);
        setMe((prev) => (prev ? { ...prev, walletBalanceFcfa: prev.walletBalanceFcfa + amountValue } : prev));
        return;
      }
      const res = await authFetch(`${API_BASE}/wallet/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountValue }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = payload?.message ?? "Impossible de lancer CinetPay";
        throw new Error(msg);
      }
      setRechargeStatus("success");
      setRechargeMessage(
        payload?.message ?? "CinetPay activé, valider la transaction dans la fenêtre sécurisée.",
      );
      const newBalance =
        typeof payload?.balance === "number"
          ? payload.balance
          : walletBalanceState + amountValue;
      setWalletBalanceState(newBalance);
      setMe((prev) => (prev ? { ...prev, walletBalanceFcfa: newBalance } : prev));
    } catch (error: any) {
      setRechargeStatus("error");
      setRechargeMessage(error?.message ?? "Erreur inattendue");
    } finally {
      setRechargeProcessing(false);
    }
  };

  if (!me || authLoading || loadingProfile) {
    return <ProfileLoading />;
  }

  const missingCountry = !me.countryCode;
  const orderSource = loadingOrders ? DEFAULT_ORDERS : orders;
  const recentOrders = orderSource.slice(0, 4);
  const tierLabel = vipActive ? currentPlan?.label ?? me.premiumTier : "Basic";
  const sidebarTierLabel = vipActive ? me.premiumTier : "Basic";
  const walletDisplay = formatCurrency(walletBalanceState, me.countryCode);
  const walletCurrencyLabel = getCurrencyInfo(me.countryCode).label;
  const countryTag = (me?.countryCode ?? "CI").toUpperCase();
  const lastWalletTransaction = walletTransactions[0];
  const isTogoPlayer = (me.countryCode ?? "").toUpperCase() === "TG";

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
            premiumTier={sidebarTierLabel}
            countryCode={me.countryCode}
            activeMenu={activeMenu}
            onChangeMenu={handleMenuChange}
          />

          <section className="space-y-8">
            {missingCountry && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                Pays manquant. Merci de compléter ton pays dans le profil pour afficher le drapeau.
              </div>
            )}
            <div className="hidden md:block">
              <ProfileHeader
                username={me.username}
                countryCode={me.countryCode}
                tierLabel={tierLabel}
                avatar={avatar}
                walletDisplay={walletDisplay}
                walletCurrencyLabel={walletCurrencyLabel}
                onChangeAvatar={() => setPickerOpen(true)}
                onAddFunds={handleAddFundsClick}
                onUseFunds={handleUseFunds}
              />
            </div>
            {activeMenu !== "Parametres" && (
              <div className="md:hidden">
                <PlayerProfileCard
                  username={me.username}
                  countryTag={countryTag}
                  tierLabel={tierLabel}
                />
              </div>
            )}
            {activeMenu === "Parametres" && (
              <div className="rounded-[32px] border border-white/10 bg-black/50 p-6 backdrop-blur">
                <div className="hidden flex-col gap-1 md:flex">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Centre paramètres</p>
                  <h2 className="text-2xl font-semibold">Gestion du compte</h2>
                  <p className="text-sm text-white/60">Pays, sécurité et session depuis cette page.</p>
                </div>

                <div className="md:hidden space-y-4">
                  <PlayerProfileCard
                    username={me.username}
                    countryTag={countryTag}
                    tierLabel={tierLabel}
                  />
                  <form onSubmit={handleCountrySubmit} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Changer de pays</p>
                      <Globe className="h-4 w-4 text-white/60" />
                    </div>
                    <select
                      value={countryFormCode}
                      onChange={(e) => setCountryFormCode(e.target.value)}
                      disabled={disableCountryForm || countrySubmitting}
                      className="mt-3 w-full rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-sm focus:border-cyan-300 focus:outline-none"
                    >
                      {COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    {countryMessage && (
                      <p className={`mt-2 text-xs ${countryStatus === "success" ? "text-emerald-300" : "text-rose-300"}`}>
                        {countryMessage}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={disableCountryForm || countrySubmitting}
                      className="mt-3 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {countrySubmitting ? "Mise à jour..." : "Valider"}
                    </button>
                  </form>

                  <form onSubmit={handlePasswordSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                    <p className="font-semibold">Changer mot de passe</p>
                    <div className="mt-3 space-y-3">
                      <input
                        type="password"
                        placeholder="Actuel"
                        className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2 focus:border-cyan-300 focus:outline-none"
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                        disabled={disablePasswordForm || passwordSubmitting}
                        required
                        autoComplete="current-password"
                      />
                      <input
                        type="password"
                        placeholder="Nouveau"
                        className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2 focus:border-cyan-300 focus:outline-none"
                        value={passwordForm.password}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
                        disabled={disablePasswordForm || passwordSubmitting}
                        required
                        autoComplete="new-password"
                        minLength={8}
                      />
                      <input
                        type="password"
                        placeholder="Confirmer"
                        className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2 focus:border-cyan-300 focus:outline-none"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                        disabled={disablePasswordForm || passwordSubmitting}
                        required
                        autoComplete="new-password"
                        minLength={8}
                      />
                    </div>
                    {passwordMessage && (
                      <p className={`mt-3 text-xs ${passwordStatus === "success" ? "text-emerald-300" : "text-rose-300"}`}>
                        {passwordMessage}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={disablePasswordForm || passwordSubmitting}
                      className="mt-3 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {passwordSubmitting ? "Mise à jour..." : "Valider"}
                    </button>
                  </form>

                  <button
                    onClick={handleLogout}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Se déconnecter
                  </button>
                </div>

                <div className="mt-6 hidden grid-cols-2 gap-5 md:grid">
                  <form onSubmit={handleCountrySubmit} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Profil joueur</p>
                        <h3 className="text-lg font-semibold">Changer de pays</h3>
                      </div>
                      <Globe className="h-5 w-5 text-white/60" />
                    </div>
                    <label className="mt-4 flex flex-col gap-2 text-white/70">
                      Pays principal
                      <select
                        value={countryFormCode}
                        onChange={(e) => setCountryFormCode(e.target.value)}
                        disabled={disableCountryForm || countrySubmitting}
                        className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                      >
                        {COUNTRY_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {countryMessage && (
                      <p className={`mt-3 text-sm ${countryStatus === "success" ? "text-emerald-300" : "text-rose-300"}`}>
                        {countryMessage}
                      </p>
                    )}
                    {disableCountryForm && (
                      <p className="mt-2 text-xs text-amber-200">API non configurée, modification désactivée en local.</p>
                    )}
                    <button
                      type="submit"
                      disabled={disableCountryForm || countrySubmitting}
                      className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {countrySubmitting ? "Mise à jour..." : "Mettre à jour"}
                    </button>
                  </form>

                  <form onSubmit={handlePasswordSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Sécurité</p>
                        <h3 className="text-lg font-semibold">Mot de passe</h3>
                      </div>
                      <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-white/60">🔐</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Actuel"
                        className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 focus:outline-none focus:border-cyan-300"
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                        disabled={disablePasswordForm || passwordSubmitting}
                        required
                      />
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Nouveau"
                        className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 focus:outline-none focus:border-cyan-300"
                        value={passwordForm.password}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
                        disabled={disablePasswordForm || passwordSubmitting}
                        required
                        minLength={8}
                      />
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirmer"
                        className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 focus:outline-none focus:border-cyan-300"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                        disabled={disablePasswordForm || passwordSubmitting}
                        required
                        minLength={8}
                      />
                    </div>
                    {passwordMessage && (
                      <p className={`mt-3 text-sm ${passwordStatus === "success" ? "text-emerald-300" : "text-rose-300"}`}>
                        {passwordMessage}
                      </p>
                    )}
                    {disablePasswordForm && (
                      <p className="mt-2 text-xs text-amber-200">API non configurée, modification désactivée en local.</p>
                    )}
                    <button
                      type="submit"
                      disabled={disablePasswordForm || passwordSubmitting}
                      className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {passwordSubmitting ? "Mise à jour..." : "Mettre à jour"}
                    </button>
                  </form>
                </div>

                <div className="mt-6 hidden rounded-2xl border border-white/10 bg-gradient-to-r from-rose-500/20 to-orange-500/10 p-5 md:block">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">Session</p>
                  <p className="mt-2 text-sm text-white/70">Déconnexion immédiate sur tous les appareils.</p>
                  <button
                    onClick={handleLogout}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {walletModalOpen && (
        isDesktop ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeWalletModal} />
            <div className="relative z-10 w-full max-w-lg rounded-[28px] border border-white/15 bg-black/90 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.85)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/80">Wallet express</p>
                  <h2 className="mt-1 text-2xl font-bold">BADBOY Wallet</h2>
                  <p className="text-sm text-white/60">Pilotage rapide sans quitter le dashboard.</p>
                </div>
                <button
                  className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:text-white"
                  onClick={closeWalletModal}
                >
                  Fermer
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Solde actif</p>
                  <p className="mt-2 text-4xl font-semibold">{walletDisplay}</p>
                  <p className="mt-1 text-xs text-white/60">Libellé: {walletCurrencyLabel}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        closeWalletModal();
                        handleAddFundsClick();
                      }}
                      className="rounded-2xl border border-yellow-300/30 bg-yellow-500/20 px-4 py-2.5 text-sm font-semibold hover:bg-yellow-500/30"
                    >
                      Recharger via CinetPay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeWalletModal();
                        handleUseFunds();
                      }}
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20"
                    >
                      Aller à la boutique
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.4em] text-white/50">Dernière opération</p>
                      {lastWalletTransaction && (
                        <p className="text-xs text-white/60">
                          {new Date(lastWalletTransaction.createdAt).toLocaleString("fr-FR")}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] rounded-full border border-white/15 px-3 py-1 text-white/60">Temps réel</span>
                  </div>
                  {walletHistoryLoading && (
                    <div className="mt-4 space-y-3">
                      {Array.from({ length: 2 }).map((_, idx) => (
                        <div key={idx} className="h-12 w-full animate-pulse rounded-2xl bg-white/5" />
                      ))}
                    </div>
                  )}
                  {!walletHistoryLoading && lastWalletTransaction && (
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-semibold text-white/90">{lastWalletTransaction.label}</p>
                          <p className="text-xs text-white/60">{lastWalletTransaction.currency}</p>
                        </div>
                        <p
                          className={`text-base font-semibold ${
                            lastWalletTransaction.type === "credit" ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {lastWalletTransaction.type === "credit" ? "+" : "-"}
                          {formatCurrency(Math.abs(lastWalletTransaction.amount), me.countryCode)}
                        </p>
                      </div>
                      <p className="text-xs text-white/60">
                        {lastWalletTransaction.status === "success" ? "Transaction validée" : "En cours de validation"}
                      </p>
                    </div>
                  )}
                  {!walletHistoryLoading && !lastWalletTransaction && (
                    <p className="mt-4 text-sm text-white/60">Aucune transaction enregistrée pour l'instant.</p>
                  )}
                </div>

                <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p>Utilise ton solde pour des comptes, recharges et drops exclusifs.</p>
                  <p className="mt-2 text-xs">
                    Les accessoires physiques restent livrés uniquement au TOGO.
                    {!isTogoPlayer && " Mets ton pays sur TOGO pour les débloquer."}
                  </p>
                </div>

                <p className="text-center text-xs text-white/50">
                  Historique complet disponible depuis l'entrée Wallet du menu latéral.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeWalletModal} />
            <div className="relative z-10 w-full max-w-lg max-h-[80vh] rounded-[28px] border border-white/10 bg-[#05030d] p-5 text-white shadow-[0_30px_120px_rgba(0,0,0,0.85)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">Wallet BD</p>
                  <h2 className="text-xl font-semibold">Hub mobile</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70"
                  onClick={closeWalletModal}
                >
                  Fermer
                </button>
              </div>
              <div className="mt-5 space-y-4 overflow-y-auto pr-1">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">BADBOY Wallet</p>
                  <p className="mt-2 text-3xl font-black">{walletDisplay}</p>
                  <p className="text-xs text-white/60">En {walletCurrencyLabel}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        closeWalletModal();
                        handleAddFundsClick();
                      }}
                      className="rounded-2xl border border-yellow-300/30 bg-yellow-500/20 px-4 py-2 text-sm font-semibold"
                    >
                      Recharger
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeWalletModal();
                        handleUseFunds();
                      }}
                      className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold"
                    >
                      Utiliser
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWalletModalOpen(false);
                      setOrdersModalOpen(true);
                    }}
                    className="mt-4 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold"
                  >
                    Mes commandes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {ordersModalOpen && (
        isDesktop ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur" onClick={closeOrdersModal} />
            <div className="relative z-10 w-full max-w-4xl rounded-[32px] border border-white/15 bg-black/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.9)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Historique commandes</p>
                  <h2 className="mt-2 text-2xl font-semibold">Mes commandes</h2>
                  <p className="text-sm text-white/60">Dernières commandes consolidées depuis ton cockpit.</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/70 hover:text-white"
                  onClick={closeOrdersModal}
                >
                  Fermer
                </button>
              </div>
              <div className="mt-6 max-h-[70vh] space-y-4 overflow-y-auto pr-2">
                {orderSource.length === 0 && (
                  <p className="text-sm text-white/60">Aucune commande n'a été détectée pour le moment.</p>
                )}
                {orderSource.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/80"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex flex-1 items-center gap-3">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                          <img src={order.thumb} alt={order.title} className="h-full w-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-white/40">{order.id}</p>
                          <p className="text-base font-semibold text-white">{order.title}</p>
                          <p className="text-xs text-white/60">{order.game}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}
                        >
                          {order.status}
                        </span>
                        <p className="mt-2 text-lg font-semibold text-amber-200">
                          {formatCurrency(order.priceFcfa, me.countryCode)}
                        </p>
                        {order.hasPhysicalItems && (
                          <p className="mt-2 text-xs text-white/60">
                            Livraison estimée: {order.shippingEtaDays ? `${order.shippingEtaDays} jours` : "—"}
                            {order.shippingEstimatedDate ? ` • ${order.shippingEstimatedDate}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur" onClick={closeOrdersModal} />
            <div className="relative z-10 w-full max-w-lg max-h-[80vh] rounded-[32px] border border-white/10 bg-[#05030d] p-5 text-white shadow-[0_30px_120px_rgba(0,0,0,0.85)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">Mes commandes</p>
                  <h2 className="text-xl font-semibold">4 dernières opérations</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70"
                  onClick={closeOrdersModal}
                >
                  Fermer
                </button>
              </div>
              <div className="mt-4 space-y-3 overflow-y-auto pr-1">
                {recentOrders.length === 0 && (
                  <p className="text-sm text-white/60">Aucune commande détectée.</p>
                )}
                {recentOrders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/40">{order.id}</p>
                        <p className="text-sm font-semibold text-white">{order.title}</p>
                        <p className="text-[11px] text-white/60">{order.game}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(order.status)}`}
                        >
                          {order.status}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-amber-200">{formatCurrency(order.priceFcfa, me.countryCode)}</p>
                        {order.hasPhysicalItems && (
                          <p className="mt-1 text-[11px] text-white/60">
                            Livraison estimée: {order.shippingEtaDays ? `${order.shippingEtaDays} jours` : "—"}
                            {order.shippingEstimatedDate ? ` • ${order.shippingEstimatedDate}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}


      {rechargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeRechargeModal} />
          <div className="relative z-10 w-full max-w-md rounded-[28px] border border-white/20 bg-black/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.85)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Recharge wallet</p>
                <h2 className="mt-2 text-2xl font-semibold">Choisir un montant</h2>
                <p className="mt-1 text-sm text-white/70">Une fois validé, CinetPay s'active automatiquement.</p>
              </div>
              <button
                className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:text-white"
                onClick={closeRechargeModal}
              >
                Fermer
              </button>
            </div>
            <form onSubmit={handleRechargeSubmit} className="mt-6 space-y-4">
              <label className="text-sm text-white/80">
                Montant ({walletCurrencyLabel})
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={rechargeAmount}
                  onChange={(event) => setRechargeAmount(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base focus:border-cyan-300 focus:outline-none"
                  placeholder="1000"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={rechargeProcessing}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
              >
                {rechargeProcessing ? "Connexion..." : "Lancer CinetPay"}
              </button>
            </form>
            {rechargeMessage && (
              <p
                className={`mt-4 text-sm ${
                  rechargeStatus === "success"
                    ? "text-emerald-300"
                    : rechargeStatus === "error"
                      ? "text-rose-300"
                      : "text-white/70"
                }`}
              >
                {rechargeMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {vipModalOpen && !isDesktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeVipModal} />
          <div className="relative z-10 w-full max-w-md rounded-[28px] border border-white/15 bg-black/90 p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.8)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-fuchsia-200/80">BADBOY VIP</p>
                <h2 className="mt-2 text-2xl font-semibold">Section réservée desktop</h2>
              </div>
              <button
                className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:text-white"
                onClick={closeVipModal}
              >
                Fermer
              </button>
            </div>
            <div className="mt-5 space-y-4 text-sm text-white/70">
              <p className="text-base text-white">
                Cette section est disponible sur ordinateur. Merci d’utiliser un PC.
              </p>
            </div>
            <button
              className="mt-6 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
              onClick={closeVipModal}
            >
              Compris
            </button>
          </div>
        </div>
      )}

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