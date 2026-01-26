"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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

type MenuKey = "MesCommandes" | "Wallet" | "VIP" | "Principal" | "Parametres";

type WalletTransaction = {
  id: string;
  label: string;
  amount: number;
  currency: string;
  createdAt: string;
  type: "credit" | "debit";
  status: "success" | "pending";
};

type CurrencyInfo = {
  iso: string;
  label: string;
};

const DEFAULT_CURRENCY: CurrencyInfo = { iso: "XOF", label: "FCFA" };
const COUNTRY_CURRENCIES: Record<string, CurrencyInfo> = {
  CI: { iso: "XOF", label: "FCFA" },
  TG: { iso: "XOF", label: "FCFA" },
  BJ: { iso: "XOF", label: "FCFA" },
  SN: { iso: "XOF", label: "FCFA" },
  ML: { iso: "XOF", label: "FCFA" },
  FR: { iso: "EUR", label: "€" },
  BE: { iso: "EUR", label: "€" },
  DE: { iso: "EUR", label: "€" },
  US: { iso: "USD", label: "$" },
  GB: { iso: "GBP", label: "£" },
};

const getCurrencyInfo = (countryCode?: string | null): CurrencyInfo => {
  if (!countryCode) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCIES[countryCode.toUpperCase()] ?? DEFAULT_CURRENCY;
};

const formatCurrency = (amount: number, countryCode?: string | null) => {
  const info = getCurrencyInfo(countryCode);
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: info.iso,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return info.label === info.iso ? formatted : formatted.replace(info.iso, info.label);
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
    title: "Compte Légendaire Diamond",
    game: "Free Fire",
    priceFcfa: 18000,
    status: "COMPLÉTÉ",
    thumb: thumbs[0],
  },
  {
    id: "BB-9002",
    title: "Recharge Express 5 000",
    game: "Mobile Legends",
    priceFcfa: 5000,
    status: "EN_COURS",
    thumb: thumbs[1],
  },
  {
    id: "BB-9003",
    title: "Pack Accessoires Elite",
    game: "Globale",
    priceFcfa: 9500,
    status: "ÉCHOUÉ",
    thumb: thumbs[2],
  },
  {
    id: "BB-9004",
    title: "Boost Rang Mythique",
    game: "Mobile Legends",
    priceFcfa: 22000,
    status: "COMPLÉTÉ",
    thumb: thumbs[3 % thumbs.length],
  },
  {
    id: "BB-9005",
    title: "Carte Cadeau 10k",
    game: "BADBOYSHOP",
    priceFcfa: 10000,
    status: "COMPLÉTÉ",
    thumb: thumbs[4 % thumbs.length],
  },
];

const DEFAULT_WALLET_TRANSACTIONS: WalletTransaction[] = [
  {
    id: "TX-001",
    label: "Recharge CinetPay",
    amount: 15000,
    currency: "FCFA",
    createdAt: "2026-01-22T14:30:00Z",
    type: "credit",
    status: "success",
  },
  {
    id: "TX-002",
    label: "Commande #BB-9001",
    amount: -18000,
    currency: "FCFA",
    createdAt: "2026-01-21T18:10:00Z",
    type: "debit",
    status: "success",
  },
  {
    id: "TX-003",
    label: "Cashback BADBOY VIP",
    amount: 1200,
    currency: "FCFA",
    createdAt: "2026-01-20T09:12:00Z",
    type: "credit",
    status: "success",
  },
  {
    id: "TX-004",
    label: "Recharge Mobile Legends",
    amount: -5000,
    currency: "FCFA",
    createdAt: "2026-01-19T20:45:00Z",
    type: "debit",
    status: "success",
  },
  {
    id: "TX-005",
    label: "Bonus parrainage",
    amount: 2500,
    currency: "FCFA",
    createdAt: "2026-01-18T16:20:00Z",
    type: "credit",
    status: "success",
  },
  {
    id: "TX-006",
    label: "Accessoires gaming (TG)",
    amount: -12000,
    currency: "FCFA",
    createdAt: "2026-01-17T12:15:00Z",
    type: "debit",
    status: "success",
  },
  {
    id: "TX-007",
    label: "Recharge CinetPay",
    amount: 8000,
    currency: "FCFA",
    createdAt: "2026-01-15T10:05:00Z",
    type: "credit",
    status: "success",
  },
  {
    id: "TX-008",
    label: "Commande #BB-9002",
    amount: -5000,
    currency: "FCFA",
    createdAt: "2026-01-14T22:00:00Z",
    type: "debit",
    status: "pending",
  },
  {
    id: "TX-009",
    label: "Cashback drop exclusif",
    amount: 900,
    currency: "FCFA",
    createdAt: "2026-01-13T08:00:00Z",
    type: "credit",
    status: "success",
  },
  {
    id: "TX-010",
    label: "Carte cadeau BADBOY",
    amount: -10000,
    currency: "FCFA",
    createdAt: "2026-01-12T19:30:00Z",
    type: "debit",
    status: "success",
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

const VIP_PLANS = [
  {
    level: "or",
    label: "Or",
    price: "10 000 FCFA",
    perks: ["Cashback 5%", "Support 24/7", "Badge doré"],
  },
  {
    level: "platine",
    label: "Platine",
    price: "13 000 FCFA",
    perks: ["Cashback 7%", "Conciergerie", "Drop exclusifs"],
  },
];

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
  const { authFetch, user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const fallbackProfile = useMemo<Me | null>(() => {
    if (!user) return null;
    const legacyUser =
      user as typeof user & {
        country_code?: string;
        country?: string;
        country_name?: string;
        wallet_balance?: number;
        walletBalance?: number;
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
      username: user.name ?? user.username ?? "BADBOY",
      countryCode,
      countryName: legacyUser.country_name ?? null,
      avatarId: legacyUser.is_premium ? "cyber_samurai" : "neon_assassin",
      walletBalanceFcfa: walletBalance,
      premiumTier: premiumTierResolved,
    } satisfies Me;
  }, [user]);

  const [me, setMe] = useState<Me | null>(fallbackProfile);
  const [orders, setOrders] = useState<Order[]>(DEFAULT_ORDERS);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("Principal");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState<string>("shadow_default");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(HAS_API_ENV);
  const [loadingOrders, setLoadingOrders] = useState(HAS_API_ENV);
  const [passwordForm, setPasswordForm] = useState({ current: "", password: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "success" | "error">("idle");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const disablePasswordForm = !HAS_API_ENV;
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [vipProcessing, setVipProcessing] = useState(false);
  const [vipMessage, setVipMessage] = useState("");
  const [vipStatus, setVipStatus] = useState<"idle" | "success" | "error">("idle");
  const [vipForm, setVipForm] = useState({ level: "or", gameId: "", gameUsername: "" });
  const vipDisabled = !HAS_API_ENV;
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(DEFAULT_WALLET_TRANSACTIONS);
  const [walletHistoryLoading, setWalletHistoryLoading] = useState(HAS_API_ENV);
  const [walletBalanceState, setWalletBalanceState] = useState(me?.walletBalanceFcfa ?? 0);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeProcessing, setRechargeProcessing] = useState(false);
  const [rechargeStatus, setRechargeStatus] = useState<"idle" | "success" | "error">("idle");
  const [rechargeMessage, setRechargeMessage] = useState("");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const avatar = useMemo(() => {
    const id = me?.avatarId || "shadow_default";
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

  useEffect(() => {
    if (currentPlan) {
      setVipForm((prev) => ({ ...prev, level: currentPlan.level }));
    }
  }, [currentPlan]);

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

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const handleMenuChange = (menu: MenuKey) => {
    setActiveMenu(menu);
    if (menu === "VIP") {
      setVipModalOpen(true);
    }
    if (menu === "Wallet") {
      setWalletModalOpen(true);
    }
    if (menu === "Parametres") {
      setSettingsModalOpen(true);
    } else {
      setSettingsModalOpen(false);
    }
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
    setVipStatus("idle");
    setVipMessage("");
  };

  const handleVipSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (vipDisabled) {
      setVipStatus("error");
      setVipMessage("API indisponible : impossible d'activer BADBOY VIP.");
      return;
    }
    setVipProcessing(true);
    setVipStatus("idle");
    setVipMessage("");
    try {
      const res = await authFetch(`${API_BASE}/premium/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: vipForm.level,
          game_id: vipForm.gameId,
          game_username: vipForm.gameUsername,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = payload?.message ?? "Impossible d'activer BADBOY VIP";
        throw new Error(msg);
      }
      setVipStatus("success");
      setVipMessage(payload?.message ?? "Bienvenue dans BADBOY VIP");
      setMe((prev) =>
        prev
          ? {
              ...prev,
              premiumTier: vipForm.level === "platine" ? "Platine" : "Or",
            }
          : prev,
      );
    } catch (error: any) {
      setVipStatus("error");
      setVipMessage(error?.message ?? "Erreur inattendue");
    } finally {
      setVipProcessing(false);
    }
  };

  const handleVipCancel = async () => {
    if (vipDisabled) {
      setVipStatus("error");
      setVipMessage("API indisponible : impossible de résilier.");
      return;
    }
    const confirmed = window.confirm(
      "Résilier BADBOY VIP immédiatement ? Aucun remboursement ne sera effectué.",
    );
    if (!confirmed) return;
    setVipProcessing(true);
    setVipStatus("idle");
    setVipMessage("");
    try {
      const res = await authFetch(`${API_BASE}/premium/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = payload?.message ?? "Impossible de résilier BADBOY VIP";
        throw new Error(msg);
      }
      setVipStatus("success");
      setVipMessage(payload?.message ?? "Abonnement BADBOY VIP résilié");
      setMe((prev) => (prev ? { ...prev, premiumTier: "Bronze" } : prev));
    } catch (error: any) {
      setVipStatus("error");
      setVipMessage(error?.message ?? "Erreur inattendue");
    } finally {
      setVipProcessing(false);
    }
  };

  const handleUseFunds = () => {
    router.push("/shop");
  };

  const closeWalletModal = () => {
    setWalletModalOpen(false);
  };

  const closeSettingsModal = () => {
    setSettingsModalOpen(false);
    if (activeMenu === "Parametres") {
      setActiveMenu("Principal");
    }
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
  const hasMoreOrders = orderSource.length > 4;
  const tierLabel = vipActive ? currentPlan?.label ?? me.premiumTier : "Basic";
  const sidebarTierLabel = vipActive ? me.premiumTier : "Basic";
  const walletDisplay = formatCurrency(walletBalanceState, me.countryCode);
  const walletCurrencyLabel = getCurrencyInfo(me.countryCode).label;
  const walletHistory = walletTransactions.slice(0, 10);
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
            onVipClick={() => setVipModalOpen(true)}
            onWalletClick={() => setWalletModalOpen(true)}
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
              tierLabel={tierLabel}
              avatar={avatar}
              walletDisplay={walletDisplay}
              walletCurrencyLabel={walletCurrencyLabel}
              onChangeAvatar={() => setPickerOpen(true)}
              onAddFunds={handleAddFundsClick}
              onUseFunds={handleUseFunds}
            />

            <div className="rounded-[32px] bg-black/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">Historique rapide</p>
                  <h2 className="text-lg font-bold">Mes commandes (4 dernières)</h2>
                </div>
                <button
                  className="text-sm opacity-70 hover:opacity-100"
                  onClick={() => handleMenuChange("MesCommandes")}
                >
                  Voir plus →
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-[1fr_140px_140px] gap-3 px-4 py-3 text-xs uppercase tracking-wider opacity-70 bg-white/5">
                  <div>Commande</div>
                  <div className="text-right">Prix</div>
                  <div className="text-right">Status</div>
                </div>

                <div className="divide-y divide-white/10">
                  {(recentOrders.length ? recentOrders : orderSource).map((o) => (
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
                      <div className="text-right font-semibold">{formatCurrency(o.priceFcfa, me.countryCode)}</div>
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
              {!hasMoreOrders && (
                <p className="mt-3 text-xs text-white/60">
                  En attente de nouvelles commandes pour alimenter cet aperçu.
                </p>
              )}

            </div>

            {activeMenu === "MesCommandes" && (
              <div className="rounded-[32px] border border-white/15 bg-black/60 p-6 backdrop-blur-xl">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/40">Historique complet</p>
                    <h2 className="text-2xl font-semibold">Toutes mes commandes</h2>
                    <p className="text-sm text-white/70">
                      {orderSource.length} opération{orderSource.length > 1 ? "s" : ""} enregistrée{orderSource.length > 1 ? "s" : ""} sur BADBOYSHOP.
                    </p>
                  </div>
                  <button
                    className="text-sm text-white/70 hover:text-white"
                    onClick={() => handleMenuChange("Principal")}
                  >
                    Retour dashboard →
                  </button>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <div className="grid grid-cols-[140px_1fr_140px_120px] gap-3 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/60 bg-white/5">
                    <div>ID</div>
                    <div>Produit</div>
                    <div className="text-right">Montant</div>
                    <div className="text-right">Status</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {orderSource.map((order) => (
                      <div key={order.id} className="grid grid-cols-[140px_1fr_140px_120px] gap-3 px-4 py-4 items-center">
                        <div className="text-sm font-semibold text-white/70">{order.id}</div>
                        <div>
                          <div className="font-semibold">{order.title}</div>
                          <div className="text-xs text-white/60">{order.game}</div>
                        </div>
                        <div className="text-right font-semibold">{formatCurrency(order.priceFcfa, me.countryCode)}</div>
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1 rounded-full border text-xs font-semibold ${
                              statusBadgeClass(order.status)
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {!orderSource.length && (
                  <p className="mt-4 text-sm text-white/60">Aucune commande pour le moment.</p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {walletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeWalletModal} />
          <div className="relative z-10 w-full max-w-3xl rounded-[32px] border border-white/20 bg-black/85 p-6 md:p-10 shadow-[0_40px_120px_rgba(0,0,0,0.85)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-cyan-200/80">Wallet BADBOY</p>
                <h2 className="mt-2 text-3xl font-bold">Dernières transactions</h2>
                <p className="mt-2 text-sm text-white/70">Synchronisé avec le montant affiché dans le navbar.</p>
              </div>
              <button
                className="self-end rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:text-white"
                onClick={closeWalletModal}
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_240px]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Solde actuel</p>
                <p className="mt-2 text-3xl font-semibold">{walletDisplay}</p>
                <p className="mt-2 text-xs text-white/60">Unité: {walletCurrencyLabel}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      closeWalletModal();
                      handleAddFundsClick();
                    }}
                    className="flex-1 rounded-2xl border border-yellow-300/20 bg-yellow-500/20 px-4 py-2 text-sm font-semibold hover:bg-yellow-500/30"
                  >
                    Recharger via CinetPay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeWalletModal();
                      handleUseFunds();
                    }}
                    className="flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                  >
                    Aller à la boutique
                  </button>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
                <p>Utilise ton solde pour des comptes, recharges et drops exclusifs.</p>
                <p className="mt-3 text-xs text-amber-200">
                  NB: Les accessoires gaming BADBOY sont uniquement disponibles pour le TOGO.
                </p>
                {!isTogoPlayer && (
                  <p className="mt-2 text-xs text-amber-300">
                    Passe ton pays sur TOGO pour accéder à ces accessoires exclusifs.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-black/40">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">10 dernières opérations</p>
                <span className="text-xs text-white/60">Actualisé en temps réel</span>
              </div>
              <div className="max-h-[45vh] overflow-y-auto divide-y divide-white/10">
                {walletHistoryLoading && (
                  <div className="space-y-3 px-5 py-4">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className="h-12 w-full animate-pulse rounded-2xl bg-white/5" />
                    ))}
                  </div>
                )}
                {!walletHistoryLoading && walletHistory.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-white/60">
                    Aucune transaction pour le moment.
                  </div>
                )}
                {!walletHistoryLoading &&
                  walletHistory.map((tx) => (
                    <div key={tx.id} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 text-sm">
                      <div>
                        <p className="font-semibold text-white/90">{tx.label}</p>
                        <p className="text-xs text-white/60">
                          {new Date(tx.createdAt).toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div
                        className={`text-right text-base font-semibold ${
                          tx.type === "credit" ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {tx.type === "credit" ? "+" : "-"}
                        {formatCurrency(Math.abs(tx.amount), me.countryCode)}
                      </div>
                      <div className="col-span-2 flex items-center justify-between text-xs text-white/60">
                        <span>{tx.currency}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 border text-[11px] ${
                            tx.status === "success"
                              ? "border-emerald-400/40 text-emerald-200"
                              : "border-amber-300/40 text-amber-200"
                          }`}
                        >
                          {tx.status === "success" ? "Validé" : "En cours"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeSettingsModal} />
          <div className="relative z-10 w-full max-w-2xl rounded-[28px] border border-white/20 bg-[#05030c]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Paramètres</p>
                <h2 className="mt-2 text-2xl font-semibold">Mini cockpit sécurité</h2>
                <p className="mt-1 text-sm text-white/60">Gère ton mot de passe et tes sessions depuis cette fenêtre.</p>
              </div>
              <button
                className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:text-white"
                onClick={closeSettingsModal}
              >
                Fermer
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <form
                onSubmit={handlePasswordSubmit}
                className="rounded-2xl bg-black/50 border border-white/10 p-5 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">Sécurité</p>
                    <h3 className="text-lg font-semibold">Changer mon mot de passe</h3>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-white/60">🔐 Compte</span>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-white/70">Mot de passe actuel</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 focus:outline-none focus:border-cyan-300"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                      disabled={disablePasswordForm || passwordSubmitting}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-white/70">Nouveau mot de passe</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 focus:outline-none focus:border-cyan-300"
                      value={passwordForm.password}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
                      disabled={disablePasswordForm || passwordSubmitting}
                      required
                      minLength={8}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-white/70">Confirmer</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 focus:outline-none focus:border-cyan-300"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                      disabled={disablePasswordForm || passwordSubmitting}
                      required
                      minLength={8}
                    />
                  </label>
                </div>
                {passwordMessage && (
                  <p
                    className={`mt-3 text-sm ${
                      passwordStatus === "success" ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {passwordMessage}
                  </p>
                )}
                {disablePasswordForm && (
                  <p className="mt-2 text-xs text-amber-200">API non configurée, modification désactivée en local.</p>
                )}
                <button
                  type="submit"
                  disabled={disablePasswordForm || passwordSubmitting}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {passwordSubmitting ? "Mise à jour..." : "Mettre à jour"}
                </button>
              </form>

              <div className="rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/10 border border-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Session</p>
                <h3 className="mt-2 text-xl font-semibold">Déconnexion rapide</h3>
                <p className="mt-2 text-sm text-white/70">
                  Déconnecte-toi sur tous les appareils et sécurise ton compte avant de changer de poste.
                </p>
                <button
                  onClick={handleLogout}
                  className="mt-5 w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {vipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeVipModal} />
          <div className="relative z-10 w-full max-w-5xl rounded-[32px] border border-white/20 bg-black/85 p-6 md:p-10 shadow-[0_40px_120px_rgba(0,0,0,0.8)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-fuchsia-300/80">BADBOY VIP</p>
                <h2 className="mt-2 text-3xl font-bold">Mini cockpit des abonnements</h2>
                <p className="mt-2 text-sm text-white/70">
                  Choisis ton palier, profites des boosts cashback et résilie quand tu veux (sans remboursement).
                </p>
              </div>
              <button
                className="self-end rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:text-white"
                onClick={closeVipModal}
              >
                Fermer
              </button>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Statut actuel</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {vipActive ? `VIP ${currentPlan?.label ?? me.premiumTier}` : "Standard"}
                  </p>
                </div>
                <div className="text-sm text-white/70">
                  {vipActive
                    ? "Tes avantages sont actifs tant que le prélèvement reste valide."
                    : "Active BADBOY VIP pour débloquer les remises immédiates et priorités support."}
                </div>
                <button
                  type="button"
                  onClick={handleVipCancel}
                  disabled={!vipActive || vipProcessing}
                  className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10"
                >
                  Résilier BADBOY VIP
                </button>
                {!vipActive && (
                  <p className="text-xs text-white/60">
                    Pas encore membre ? Choisis ton plan pour rejoindre le cercle BADBOY.
                  </p>
                )}
              </div>

              <form
                onSubmit={handleVipSubscribe}
                className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#120018] via-[#050312] to-[#02020a] p-5 space-y-6"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {VIP_PLANS.map((plan) => {
                    const selected = vipForm.level === plan.level;
                    return (
                      <label
                        key={plan.level}
                        className={`rounded-2xl border px-4 py-4 text-left text-sm transition cursor-pointer ${
                          selected ? "border-fuchsia-400 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="radio"
                          name="vip-level"
                          value={plan.level}
                          className="hidden"
                          checked={selected}
                          onChange={() => setVipForm((prev) => ({ ...prev, level: plan.level }))}
                        />
                        <div className="text-xs uppercase tracking-[0.3em] text-white/60">{plan.label}</div>
                        <div className="mt-2 text-lg font-semibold">{plan.price}</div>
                        <ul className="mt-3 space-y-1 text-white/70">
                          {plan.perks.map((perk) => (
                            <li key={perk}>• {perk}</li>
                          ))}
                        </ul>
                      </label>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-white/70">
                    ID de jeu / UID
                    <input
                      type="text"
                      value={vipForm.gameId}
                      onChange={(e) => setVipForm((prev) => ({ ...prev, gameId: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 focus:border-cyan-300 focus:outline-none"
                      placeholder="123456789"
                      required
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    Pseudo in-game
                    <input
                      type="text"
                      value={vipForm.gameUsername}
                      onChange={(e) =>
                        setVipForm((prev) => ({ ...prev, gameUsername: e.target.value }))
                      }
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 focus:border-cyan-300 focus:outline-none"
                      placeholder="BADBOY_225"
                      required
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={vipProcessing}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {vipProcessing ? "Traitement..." : "Activer / mettre à jour BADBOY VIP"}
                </button>
                {vipDisabled && (
                  <p className="text-xs text-amber-300">
                    API hors-ligne : la souscription est simulée uniquement sur cette preview.
                  </p>
                )}
              </form>
            </div>

            {vipMessage && (
              <p
                className={`mt-4 text-sm ${
                  vipStatus === "success" ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {vipMessage}
              </p>
            )}
            <p className="mt-4 text-xs text-amber-200">
              ⚠️ Résiliation immédiate, aucun remboursement n’est émis même si la période n’est pas terminée.
            </p>
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