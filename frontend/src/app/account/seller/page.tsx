"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Crown,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Shield,
  ShoppingBag,
  UploadCloud,
  Wallet as WalletIcon,
} from "lucide-react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";

type Seller = {
  id: number;
  status: "pending_verification" | "approved" | "suspended" | "banned";
  statusReason?: string | null;
  whatsappNumber?: string | null;
  kycFullName?: string | null;
  kycDob?: string | null;
  kycCountry?: string | null;
  kycCity?: string | null;
  kycAddress?: string | null;
  kycIdType?: string | null;
  kycIdNumber?: string | null;
  kycSubmittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  suspendedAt?: string | null;
  bannedAt?: string | null;
  partnerWalletFrozen?: boolean;
  partnerWalletFrozenAt?: string | null;
  kycFiles?: { idFront: boolean; selfie: boolean };
};

type SellerMeResponse = {
  seller: Seller | null;
};

type PartnerWalletResponse = {
  sellerStatus?: string | null;
  partnerWalletFrozen?: boolean;
  partnerWallet?: {
    currency?: string | null;
    available_balance?: number | string | null;
    pending_balance?: number | string | null;
    reserved_withdraw_balance?: number | string | null;
  } | null;
  withdrawRequests?: any[];
};

type CategoryOption = { id: number; name: string; slug?: string | null };
type GameOption = { id: number; name: string };

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
};

type Listing = {
  id: number;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  status?: "active" | "disabled" | "sold" | string;
  status_reason?: string | null;
  delivery_window_hours?: number | string | null;
  has_email_access?: boolean | null;
  account_level?: string | null;
  account_rank?: string | null;
  account_region?: string | null;
  game?: GameOption | null;
  category?: CategoryOption | null;
  created_at?: string | null;
  sold_at?: string | null;
  order_id?: number | null;
};

type MarketplaceOrderRow = {
  id: number;
  status?: string | null;
  price?: number | string | null;
  commission_amount?: number | string | null;
  seller_earnings?: number | string | null;
  delivery_deadline_at?: string | null;
  delivered_at?: string | null;
  dispute_id?: number | null;
  delivery_proof?: any;
  created_at?: string | null;
  order?: { id?: number | null; reference?: string | null; status?: string | null; created_at?: string | null } | null;
  listing?: { id?: number | null; title?: string | null; price?: number | string | null } | null;
};

type ToastTone = "success" | "error" | "info";
type ToastState = { message: string; tone: ToastTone } | null;

const formatMoney = (value: any) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `${new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(safe)))} FCFA`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const safeList = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.partnerWallet)) return payload.partnerWallet;
  return [];
};

const safePaginator = <T,>(payload: any): { items: T[]; meta: Paginated<T> | null } => {
  const boxed = payload?.data ?? payload;
  if (boxed && typeof boxed === "object" && Array.isArray(boxed.data)) {
    return { items: boxed.data as T[], meta: boxed as Paginated<T> };
  }
  if (boxed && typeof boxed === "object" && boxed.data && typeof boxed.data === "object" && Array.isArray(boxed.data.data)) {
    return { items: boxed.data.data as T[], meta: boxed.data as Paginated<T> };
  }
  return { items: [], meta: null };
};

const statusLabel = (status: Seller["status"]) => {
  switch (status) {
    case "approved":
      return "Validé";
    case "pending_verification":
      return "En validation";
    case "suspended":
      return "Suspendu";
    case "banned":
      return "Banni";
    default:
      return status;
  }
};

function SellerPageClient() {
  const { authFetch, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [wallet, setWallet] = useState<PartnerWalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "kyc" | "listings" | "sales" | "wallet">("overview");

  const [games, setGames] = useState<GameOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [orders, setOrders] = useState<MarketplaceOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);

  const [listingModal, setListingModal] = useState<null | { mode: "create" | "edit"; listing?: Listing }>(null);
  const [deliveryModal, setDeliveryModal] = useState<null | { order: MarketplaceOrderRow }>(null);
  const toastTimer = useRef<number | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    whatsappNumber: "",
    dob: "",
    country: "",
    city: "",
    address: "",
    idType: "CNI",
    idNumber: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || user.name || "",
    }));
  }, [user]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), tone === "error" ? 4200 : 2600);
  }, []);

  const fetchJson = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const res = await authFetch(`${API_BASE}${path}`, { cache: "no-store", ...init });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(payload?.message ?? `Erreur ${res.status}`);
      }
      return payload as T;
    },
    [authFetch]
  );

  const loadGamesAndCategories = useCallback(async () => {
    try {
      const [gRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/games?active=1&per_page=200`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/categories?active_only=1`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      const gList = safeList(gRes) as GameOption[];
      const cList = safeList(cRes) as CategoryOption[];
      setGames(Array.isArray(gList) ? gList : []);
      setCategories(Array.isArray(cList) ? cList : []);
    } catch {
      // best effort
    }
  }, []);

  const loadCore = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<SellerMeResponse>("/gaming-accounts/seller/me");
      setSeller(payload?.seller ?? null);

      // Load partner wallet when a seller exists (any status)
      if (payload?.seller) {
        const wPayload = await fetchJson<PartnerWalletResponse>("/gaming-accounts/partner-wallet").catch(() => null);
        setWallet(wPayload);
      } else {
        setWallet(null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger l'espace vendeur");
      setSeller(null);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  };

  const loadListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const payload = await fetchJson<{ data: Paginated<Listing> }>("/gaming-accounts/listings/mine");
      const { items } = safePaginator<Listing>(payload);
      setListings(items);
    } catch {
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  }, [fetchJson]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const payload = await fetchJson<{ data: Paginated<MarketplaceOrderRow> }>("/gaming-accounts/seller/orders");
      const { items } = safePaginator<MarketplaceOrderRow>(payload);
      setOrders(items);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [fetchJson]);

  const loadAll = useCallback(async () => {
    await loadCore();
    await Promise.all([loadListings(), loadOrders(), loadGamesAndCategories()]);
  }, [loadCore, loadListings, loadOrders, loadGamesAndCategories]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canApply = useMemo(() => {
    if (!seller) return true;
    return seller.status !== "approved";
  }, [seller]);

  const canSell = Boolean(seller && seller.status === "approved" && !seller.partnerWalletFrozen);

  const listingsStats = useMemo(() => {
    const counts = { approved: 0, inReview: 0, draft: 0, sold: 0 };
    for (const l of listings) {
      const s = String(l.status ?? "");
      if (s === "approved") counts.approved++;
      else if (s === "pending_review" || s === "pending_review_update") counts.inReview++;
      else if (s === "sold") counts.sold++;
      else counts.draft++;
    }
    return counts;
  }, [listings]);

  const orderStats = useMemo(() => {
    const counts = { paid: 0, delivered: 0, disputed: 0, resolved: 0 };
    for (const o of orders) {
      const s = String(o.status ?? "");
      if (s === "paid") counts.paid++;
      else if (s === "delivered") counts.delivered++;
      else if (s === "disputed") counts.disputed++;
      else if (s.startsWith("resolved")) counts.resolved++;
    }
    return counts;
  }, [orders]);

  const submitApply = async () => {
    setError(null);
    setToast(null);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        whatsappNumber: form.whatsappNumber.trim(),
        dob: form.dob || null,
        country: form.country.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        idType: form.idType.trim(),
        idNumber: form.idNumber.trim(),
      };

      const res = await authFetch(`${API_BASE}/gaming-accounts/seller/apply`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as SellerMeResponse | null;
      if (!res.ok) {
        throw new Error((data as any)?.message ?? "Impossible d'envoyer la demande");
      }

      setSeller(data?.seller ?? null);
      pushToast("Demande envoyée. Ajoute tes photos KYC.", "success");
    } catch (e: any) {
      setError(e?.message ?? "Erreur inattendue");
      pushToast(e?.message ?? "Erreur inattendue", "error");
    }
  };

  const uploadFile = async (endpoint: string, fieldName: string, file: File) => {
    setError(null);
    setToast(null);
    try {
      const fd = new FormData();
      fd.append(fieldName, file);
      const res = await authFetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        body: fd,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message ?? "Upload impossible");
      }
      pushToast("Fichier envoyé", "success");
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Erreur upload");
      pushToast(e?.message ?? "Erreur upload", "error");
    }
  };

  const saveListing = async (payload: {
    mode: "create" | "edit";
    id?: number;
    values: {
      gameId?: number | null;
      categoryId?: number | null;
      title: string;
      description?: string | null;
      price: number;
      accountLevel?: string | null;
      accountRank?: string | null;
      accountRegion?: string | null;
      hasEmailAccess?: boolean;
      deliveryWindowHours?: number;
    };
  }) => {
    try {
      const body = JSON.stringify(payload.values);
      if (payload.mode === "create") {
        await fetchJson("/gaming-accounts/listings", { method: "POST", body });
        pushToast("Annonce créée et soumise à validation.", "success");
      } else {
        await fetchJson(`/gaming-accounts/listings/${payload.id}`, { method: "PATCH", body });
        pushToast("Annonce mise à jour (revalidation si nécessaire).", "success");
      }
      setListingModal(null);
      await loadListings();
    } catch (e: any) {
      pushToast(e?.message ?? "Impossible d'enregistrer", "error");
    }
  };

  const setListingStatus = async (listingId: number, next: "active" | "disabled", reason?: string) => {
    try {
      await fetchJson(`/gaming-accounts/listings/${listingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, reason: reason?.trim() || null }),
      });
      pushToast(next === "active" ? "Annonce soumise à validation." : "Annonce retirée (brouillon).", "success");
      await loadListings();
    } catch (e: any) {
      pushToast(e?.message ?? "Action impossible", "error");
    }
  };

  const requestWithdraw = async (payload: { amount: number; payoutDetails: any }) => {
    setWalletBusy(true);
    try {
      await fetchJson("/gaming-accounts/partner-wallet/withdraw", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      pushToast("Demande de retrait envoyée.", "success");
      const w = await fetchJson<PartnerWalletResponse>("/gaming-accounts/partner-wallet").catch(() => null);
      setWallet(w);
    } catch (e: any) {
      pushToast(e?.message ?? "Retrait impossible", "error");
    } finally {
      setWalletBusy(false);
    }
  };

  const markDelivered = async (orderId: number, note: string, proof?: File | null) => {
    try {
      const fd = new FormData();
      if (note.trim()) fd.append("note", note.trim());
      if (proof) fd.append("proof", proof);

      const res = await authFetch(`${API_BASE}/gaming-accounts/seller/orders/${orderId}/delivered`, {
        method: "POST",
        body: fd,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message ?? "Action impossible");
      }
      pushToast("Marqué comme livré.", "success");
      setDeliveryModal(null);
      await loadOrders();
    } catch (e: any) {
      pushToast(e?.message ?? "Action impossible", "error");
    }
  };

  const Badge = ({ tone, children }: { tone: "green" | "amber" | "rose" | "slate"; children: React.ReactNode }) => {
    const map = {
      green: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
      amber: "border-amber-300/20 bg-amber-400/10 text-amber-100",
      rose: "border-rose-300/20 bg-rose-400/10 text-rose-100",
      slate: "border-white/10 bg-white/5 text-white/80",
    } as const;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${map[tone]}`}>
        {children}
      </span>
    );
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
      {children}
    </div>
  );

  const TabButton = ({
    id,
    label,
    icon,
  }: {
    id: "overview" | "kyc" | "listings" | "sales" | "wallet";
    label: string;
    icon: React.ReactNode;
  }) => {
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={
          "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition " +
          (active
            ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
            : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10")
        }
      >
        <span className={active ? "text-cyan-200" : "text-white/70"}>{icon}</span>
        {label}
      </button>
    );
  };

  const ListingModal = () => {
    const isOpen = Boolean(listingModal);
    const isEdit = listingModal?.mode === "edit";
    const base = listingModal?.listing;

    const [values, setValues] = useState(() => ({
      gameId: base?.game?.id ?? null,
      categoryId: base?.category?.id ?? null,
      title: String(base?.title ?? ""),
      description: String(base?.description ?? ""),
      price: Number(base?.price ?? 0) || 0,
      accountLevel: String(base?.account_level ?? ""),
      accountRank: String(base?.account_rank ?? ""),
      accountRegion: String(base?.account_region ?? ""),
      hasEmailAccess: Boolean(base?.has_email_access ?? false),
      deliveryWindowHours: Number(base?.delivery_window_hours ?? 24) || 24,
    }));

    useEffect(() => {
      if (!isOpen) return;
      setValues({
        gameId: base?.game?.id ?? null,
        categoryId: base?.category?.id ?? null,
        title: String(base?.title ?? ""),
        description: String(base?.description ?? ""),
        price: Number(base?.price ?? 0) || 0,
        accountLevel: String(base?.account_level ?? ""),
        accountRank: String(base?.account_rank ?? ""),
        accountRegion: String(base?.account_region ?? ""),
        hasEmailAccess: Boolean(base?.has_email_access ?? false),
        deliveryWindowHours: Number(base?.delivery_window_hours ?? 24) || 24,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, base?.id, listingModal?.mode]);

    if (!listingModal) return null;

    const disable = !canSell;

    const submitDisabled =
      disable ||
      !values.title.trim() ||
      values.title.trim().length > 140 ||
      !Number.isFinite(Number(values.price)) ||
      Number(values.price) < 1 ||
      !Number.isFinite(Number(values.deliveryWindowHours)) ||
      Number(values.deliveryWindowHours) < 1;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 backdrop-blur sm:items-center">
        <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#05020f] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Annonces</p>
              <h3 className="mt-1 text-xl font-semibold text-white">{isEdit ? "Modifier l'annonce" : "Créer une annonce"}</h3>
              <p className="mt-1 text-sm text-white/60">
                L'annonce est <span className="text-white/80">soumise</span> à validation. Après approbation, elle devient visible sur le marketplace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setListingModal(null)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Fermer
            </button>
          </div>

          <div className="px-6 py-6">
            {!canSell ? (
              <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                Ton compte vendeur doit être <span className="font-semibold">validé</span> (et wallet non gelé) pour créer/modifier/activer des annonces.
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-white/70">
                Jeu (optionnel)
                <select
                  value={values.gameId ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, gameId: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  disabled={disable}
                >
                  <option value="">—</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-white/70">
                Catégorie (optionnel)
                <select
                  value={values.categoryId ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, categoryId: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  disabled={disable}
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-white/70 sm:col-span-2">
                Titre *
                <input
                  value={values.title}
                  onChange={(e) => setValues((p) => ({ ...p, title: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  placeholder="Ex: Compte Valorant - Rank Ascendant"
                  disabled={disable}
                />
                <p className="mt-1 text-xs text-white/45">{values.title.trim().length}/140</p>
              </label>

              <label className="text-sm text-white/70 sm:col-span-2">
                Description
                <textarea
                  value={values.description}
                  onChange={(e) => setValues((p) => ({ ...p, description: e.target.value }))}
                  className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  placeholder="Détails importants: skins, niveau, région, email..."
                  disabled={disable}
                />
              </label>

              <label className="text-sm text-white/70">
                Prix * (FCFA)
                <input
                  type="number"
                  value={values.price}
                  onChange={(e) => setValues((p) => ({ ...p, price: Number(e.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  min={1}
                  disabled={disable}
                />
              </label>

              <label className="text-sm text-white/70">
                Délai livraison (heures)
                <input
                  type="number"
                  value={values.deliveryWindowHours}
                  onChange={(e) => setValues((p) => ({ ...p, deliveryWindowHours: Number(e.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  min={1}
                  max={168}
                  disabled={disable}
                />
                <p className="mt-1 text-xs text-white/45">Max 168h (7 jours)</p>
              </label>

              <label className="text-sm text-white/70">
                Niveau (optionnel)
                <input
                  value={values.accountLevel}
                  onChange={(e) => setValues((p) => ({ ...p, accountLevel: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  placeholder="Ex: 153"
                  disabled={disable}
                />
              </label>
              <label className="text-sm text-white/70">
                Rang (optionnel)
                <input
                  value={values.accountRank}
                  onChange={(e) => setValues((p) => ({ ...p, accountRank: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  placeholder="Ex: Diamond"
                  disabled={disable}
                />
              </label>
              <label className="text-sm text-white/70 sm:col-span-2">
                Région (optionnel)
                <input
                  value={values.accountRegion}
                  onChange={(e) => setValues((p) => ({ ...p, accountRegion: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                  placeholder="EU / NA / AFR..."
                  disabled={disable}
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={values.hasEmailAccess}
                  onChange={(e) => setValues((p) => ({ ...p, hasEmailAccess: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-black/30"
                  disabled={disable}
                />
                Email inclus (accès / changement)
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-white/55">
              Commission marketplace appliquée à la vente. Les gains sont <span className="text-white/80">en attente</span> jusqu'à libération manuelle.
            </div>
            <button
              type="button"
              disabled={submitDisabled}
              onClick={() =>
                void saveListing({
                  mode: listingModal.mode,
                  id: base?.id,
                  values: {
                    gameId: values.gameId,
                    categoryId: values.categoryId,
                    title: values.title.trim(),
                    description: values.description.trim() || null,
                    price: Math.round(Number(values.price)),
                    accountLevel: values.accountLevel.trim() || null,
                    accountRank: values.accountRank.trim() || null,
                    accountRegion: values.accountRegion.trim() || null,
                    hasEmailAccess: Boolean(values.hasEmailAccess),
                    deliveryWindowHours: Math.max(1, Math.min(168, Math.round(Number(values.deliveryWindowHours) || 24))),
                  },
                })
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DeliveryModal = () => {
    const dm = deliveryModal;

    const [note, setNote] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      if (!dm) return;
      setNote("");
      setFile(null);
      setBusy(false);
    }, [dm?.order?.id]);

    if (!dm) return null;

    const title = String(dm.order?.listing?.title ?? "Commande marketplace");
    const ref = String(dm.order?.order?.reference ?? "");

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 backdrop-blur sm:items-center">
        <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-[#05020f] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Livraison</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Preuve de livraison</h3>
              <p className="mt-1 text-sm text-white/60">
                {title}
                {ref ? <span className="text-white/50"> · Ref {ref}</span> : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeliveryModal(null)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Fermer
            </button>
          </div>

          <div className="px-6 py-6">
            <label className="text-sm text-white/70">
              Note (optionnel)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                placeholder="Ce que tu as livré / infos utiles"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Preuve (image)</p>
              <p className="mt-2 text-sm text-white/60">Optionnel, mais recommandé (max 5MB).</p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-black/40">
                <ImageIcon className="h-4 w-4" />
                {file ? "Changer" : "Importer"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {file ? <p className="mt-3 text-xs text-white/60">{file.name}</p> : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-5">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await markDelivered(dm.order.id, note, file);
                setBusy(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmer livré
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#02010a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,0.18),transparent_40%),radial-gradient(circle_at_40%_90%,rgba(249,115,22,0.12),transparent_45%)]" />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-10">
        <SectionTitle
          eyebrow="Marketplace"
          label="Espace vendeur — Gaming Accounts"
          action={
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualiser
            </button>
          }
        />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <TabButton id="overview" label="Aperçu" icon={<Crown className="h-4 w-4" />} />
          <TabButton id="kyc" label="KYC" icon={<Shield className="h-4 w-4" />} />
          <TabButton id="listings" label="Mes annonces" icon={<ClipboardList className="h-4 w-4" />} />
          <TabButton id="sales" label="Mes ventes" icon={<ShoppingBag className="h-4 w-4" />} />
          <TabButton id="wallet" label="Wallet" icon={<WalletIcon className="h-4 w-4" />} />
        </div>

        {loading && <p className="mt-6 text-sm text-white/60">Chargement...</p>}
        {!loading && error && (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}
        {!loading && toast && (
          <div
            className={
              "mt-6 rounded-2xl border p-4 text-sm " +
              (toast.tone === "success"
                ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                : toast.tone === "error"
                  ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
                  : "border-white/10 bg-white/5 text-white/80")
            }
          >
            {toast.message}
          </div>
        )}

        {!loading && (
          <>
            {activeTab === "overview" && (
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Compte vendeur</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">{seller ? statusLabel(seller.status) : "Pas encore vendeur"}</h2>
                        <p className="mt-2 text-sm text-white/60">
                          {seller
                            ? "Gère tes annonces, tes ventes et ton wallet en un seul endroit."
                            : "Deviens vendeur: complète le formulaire KYC, puis envoie tes pièces (CNI + selfie)."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!seller ? <Badge tone="amber"><AlertTriangle className="h-3.5 w-3.5" /> Profil vendeur manquant</Badge> : null}
                        {seller?.status === "approved" ? (
                          <Badge tone={seller.partnerWalletFrozen ? "rose" : "green"}>
                            {seller.partnerWalletFrozen ? <AlertTriangle className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                            {seller.partnerWalletFrozen ? "Wallet gelé" : "Vendeur vérifié"}
                          </Badge>
                        ) : seller ? (
                          <Badge tone="amber"><Shield className="h-3.5 w-3.5" /> KYC en validation</Badge>
                        ) : null}
                      </div>
                    </div>

                    {seller?.statusReason ? (
                      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                        {seller.statusReason}
                      </div>
                    ) : null}

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs text-white/50">Annonces approuvées</p>
                        <p className="mt-2 text-2xl font-semibold">{listingsStats.approved}</p>
                        <p className="mt-1 text-xs text-white/55">
                          En validation: {listingsStats.inReview} · Brouillons: {listingsStats.draft}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs text-white/50">Ventes (payées)</p>
                        <p className="mt-2 text-2xl font-semibold">{orderStats.paid}</p>
                        <p className="mt-1 text-xs text-white/55">Livrées: {orderStats.delivered}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs text-white/50">Litiges</p>
                        <p className="mt-2 text-2xl font-semibold">{orderStats.disputed}</p>
                        <p className="mt-1 text-xs text-white/55">Résolus: {orderStats.resolved}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab("kyc")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        <Shield className="h-4 w-4" />
                        Finaliser KYC
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("listings")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        <ClipboardList className="h-4 w-4" />
                        Gérer mes annonces
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("wallet")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        <WalletIcon className="h-4 w-4" />
                        Voir wallet
                      </button>
                    </div>
                  </Card>
                </div>

                <Card>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Wallet Partenaire</p>
                  {wallet?.partnerWallet ? (
                    <>
                      <p className="mt-2 text-3xl font-semibold">{formatMoney(wallet.partnerWallet.available_balance)}</p>
                      <p className="mt-1 text-xs text-white/60">Disponible</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-white/50">En attente</p>
                          <p className="mt-1 font-semibold">{formatMoney(wallet.partnerWallet.pending_balance)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-white/50">Réservé retrait</p>
                          <p className="mt-1 font-semibold">{formatMoney(wallet.partnerWallet.reserved_withdraw_balance)}</p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                        <p className="font-semibold text-white/85">Libération manuelle</p>
                        <p className="mt-1 text-white/60">Les gains restent en attente jusqu'à validation admin.</p>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-white/60">Le wallet partenaire apparaît après la création du compte vendeur.</p>
                  )}
                </Card>
              </div>
            )}

            {activeTab === "kyc" && (
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="rounded-[32px] border border-white/10 bg-black/40 p-6">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Inscription</p>
                    <h3 className="mt-1 text-2xl font-semibold">Formulaire vendeur</h3>
                    <p className="mt-2 text-sm text-white/60">Ces infos servent à la conformité et au contact WhatsApp après paiement.</p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-white/70">
                  Nom complet
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                    placeholder="Nom + Prénom"
                    disabled={!canApply}
                  />
                </label>
                <label className="text-sm text-white/70">
                  WhatsApp
                  <input
                    value={form.whatsappNumber}
                    onChange={(e) => setForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                    placeholder="Ex: +225 07 00 00 00 00"
                    disabled={!canApply}
                  />
                </label>
                <label className="text-sm text-white/70">
                  Pays
                  <input
                    value={form.country}
                    onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                    placeholder="Côte d'Ivoire"
                    disabled={!canApply}
                  />
                </label>
                <label className="text-sm text-white/70">
                  Ville
                  <input
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                    placeholder="Abidjan"
                    disabled={!canApply}
                  />
                </label>
                <label className="text-sm text-white/70 md:col-span-2">
                  Adresse
                  <input
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                    placeholder="Quartier / Rue / repère"
                    disabled={!canApply}
                  />
                </label>
                <label className="text-sm text-white/70">
                  Type ID
                  <input
                    value={form.idType}
                    onChange={(e) => setForm((p) => ({ ...p, idType: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                    placeholder="CNI, Passeport..."
                    disabled={!canApply}
                  />
                </label>
                <label className="text-sm text-white/70">
                  Numéro ID
                  <input
                    value={form.idNumber}
                    onChange={(e) => setForm((p) => ({ ...p, idNumber: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
                    placeholder="Numéro CNI"
                    disabled={!canApply}
                  />
                </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => void submitApply()}
                      disabled={!canApply}
                      className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      Envoyer la demande
                    </button>

                    {seller && (
                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50">CNI recto</p>
                          <p className="mt-2 text-sm text-white/60">Fichier image (max 5MB).</p>
                          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-black/40">
                            <UploadCloud className="h-4 w-4" />
                            Importer
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                void uploadFile("/gaming-accounts/seller/kyc/id-front", "file", f);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Selfie</p>
                          <p className="mt-2 text-sm text-white/60">Prends la photo (caméra) ou importe.</p>
                          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-black/40">
                            <UploadCloud className="h-4 w-4" />
                            Capturer / Importer
                            <input
                              type="file"
                              accept="image/*"
                              capture="user"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                void uploadFile("/gaming-accounts/seller/kyc/selfie", "image", f);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Card>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Statut</p>
                    {!seller ? (
                      <div className="mt-3">
                        <Badge tone="amber"><AlertTriangle className="h-3.5 w-3.5" /> Pas encore vendeur</Badge>
                        <p className="mt-3 text-sm text-white/60">Envoie le formulaire pour créer ton profil vendeur.</p>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-white/70">Statut vendeur</div>
                          <Badge tone={seller.status === "approved" ? "green" : seller.status === "pending_verification" ? "amber" : "rose"}>
                            {seller.status === "approved" ? <BadgeCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                            {statusLabel(seller.status)}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-white/70">
                          <div className="flex items-center justify-between gap-3">
                            <span>KYC ID recto</span>
                            <span className={seller.kycFiles?.idFront ? "text-emerald-300" : "text-rose-300"}>
                              {seller.kycFiles?.idFront ? "OK" : "Manquant"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Selfie</span>
                            <span className={seller.kycFiles?.selfie ? "text-emerald-300" : "text-rose-300"}>
                              {seller.kycFiles?.selfie ? "OK" : "Manquant"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Wallet gelé</span>
                            <span className={seller.partnerWalletFrozen ? "text-rose-300" : "text-emerald-300"}>
                              {seller.partnerWalletFrozen ? "Oui" : "Non"}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                          <p className="font-semibold text-white/85">Conseil</p>
                          <p className="mt-1 text-white/60">Plus vite tu livres, meilleur est ton score de confiance.</p>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "listings" && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Annonces</p>
                    <h3 className="mt-1 text-2xl font-semibold">Mes annonces</h3>
                    <p className="mt-2 text-sm text-white/60">Crée, modifie et active tes annonces (validation requise).</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setListingModal({ mode: "create" })}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-3 text-sm font-semibold text-black"
                  >
                    <Plus className="h-4 w-4" />
                    Nouvelle annonce
                  </button>
                </div>

                {!canSell ? (
                  <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    Création / activation bloquée tant que ton compte n'est pas <span className="font-semibold">validé</span> ou si le wallet est gelé.
                  </div>
                ) : null}

                <div className="mt-6 grid gap-4">
                  {listingsLoading ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                      <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
                      Chargement des annonces...
                    </div>
                  ) : null}

                  {!listingsLoading && listings.length === 0 ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center">
                      <ClipboardList className="mx-auto h-8 w-8 text-white/60" />
                      <p className="mt-3 text-sm text-white/70">Aucune annonce pour le moment.</p>
                      <p className="mt-1 text-xs text-white/50">Crée ta première annonce, puis soumets-la pour validation.</p>
                    </div>
                  ) : null}

                  {listings.map((l) => {
                    const status = String(l.status ?? "disabled");

                    const statusUi = (() => {
                      if (status === "approved") return { label: "Approuvée", tone: "green" as const };
                      if (status === "pending_review") return { label: "En validation", tone: "amber" as const };
                      if (status === "pending_review_update") return { label: "Maj en validation", tone: "amber" as const };
                      if (status === "rejected") return { label: "Refusée", tone: "amber" as const };
                      if (status === "suspended") return { label: "Suspendue", tone: "slate" as const };
                      if (status === "sold") return { label: "Vendue", tone: "slate" as const };
                      return { label: "Brouillon", tone: "amber" as const };
                    })();

                    const tone = statusUi.tone;
                    return (
                      <div key={l.id} className="rounded-[28px] border border-white/10 bg-black/40 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-lg font-semibold text-white">{String(l.title ?? "Annonce")}</h4>
                              <Badge tone={tone as any}>
                                {status === "approved" ? (
                                  <BadgeCheck className="h-3.5 w-3.5" />
                                ) : status === "sold" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <Shield className="h-3.5 w-3.5" />
                                )}
                                {statusUi.label}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-white/60 line-clamp-2">{String(l.description ?? "").trim() || "—"}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Prix: <span className="text-white/80">{formatMoney(l.price)}</span>
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Délai: <span className="text-white/80">{Number(l.delivery_window_hours ?? 24)}h</span>
                              </span>
                              {l.game?.name ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                  Jeu: <span className="text-white/80">{l.game.name}</span>
                                </span>
                              ) : null}
                              {l.category?.name ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                  Catégorie: <span className="text-white/80">{l.category.name}</span>
                                </span>
                              ) : null}
                            </div>
                            {l.status_reason ? (
                              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                                {l.status_reason}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setListingModal({ mode: "edit", listing: l })}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                            >
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </button>
                            {status !== "sold" ? (
                              status === "approved" ? (
                                <button
                                  type="button"
                                  onClick={() => void setListingStatus(l.id, "disabled", "Désactivé par le vendeur")}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                                >
                                  Retirer
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void setListingStatus(l.id, "active")}
                                  disabled={!canSell || status === "pending_review" || status === "pending_review_update"}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                                >
                                  Soumettre
                                </button>
                              )
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "sales" && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Ventes</p>
                    <h3 className="mt-1 text-2xl font-semibold">Mes ventes</h3>
                    <p className="mt-2 text-sm text-white/60">Suis les commandes et ajoute une preuve de livraison.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadOrders()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Rafraîchir
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  {ordersLoading ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                      <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
                      Chargement des ventes...
                    </div>
                  ) : null}

                  {!ordersLoading && orders.length === 0 ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center">
                      <ShoppingBag className="mx-auto h-8 w-8 text-white/60" />
                      <p className="mt-3 text-sm text-white/70">Aucune vente pour le moment.</p>
                      <p className="mt-1 text-xs text-white/50">Active des annonces pour recevoir des commandes.</p>
                    </div>
                  ) : null}

                  {orders.map((o) => {
                    const s = String(o.status ?? "");
                    const tone = s === "paid" ? "amber" : s === "delivered" ? "green" : s === "disputed" ? "rose" : "slate";
                    const title = String(o.listing?.title ?? "Commande marketplace");
                    const ref = String(o.order?.reference ?? "");
                    const deadline = o.delivery_deadline_at ? new Date(o.delivery_deadline_at) : null;
                    const overdue = deadline ? deadline.getTime() < Date.now() && s === "paid" : false;
                    return (
                      <div key={o.id} className="rounded-[28px] border border-white/10 bg-black/40 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-lg font-semibold text-white">{title}</h4>
                              <Badge tone={tone as any}>
                                {s === "delivered" ? <CheckCircle2 className="h-3.5 w-3.5" /> : s === "disputed" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                                {s === "paid"
                                  ? "À livrer"
                                  : s === "delivered"
                                    ? "Livrée"
                                    : s === "disputed"
                                      ? "Litige"
                                      : s.startsWith("resolved")
                                        ? "Résolue"
                                        : s || "—"}
                              </Badge>
                              {overdue ? <Badge tone="rose"><AlertTriangle className="h-3.5 w-3.5" /> En retard</Badge> : null}
                            </div>
                            <div className="mt-2 grid gap-2 text-sm text-white/65 sm:grid-cols-2">
                              <div>
                                <span className="text-white/45">Référence:</span> <span className="text-white/80">{ref || "—"}</span>
                              </div>
                              <div>
                                <span className="text-white/45">Montant:</span> <span className="text-white/80">{formatMoney(o.price)}</span>
                              </div>
                              <div>
                                <span className="text-white/45">Deadline:</span> <span className="text-white/80">{formatDateTime(o.delivery_deadline_at)}</span>
                              </div>
                              <div>
                                <span className="text-white/45">Livrée:</span> <span className="text-white/80">{formatDateTime(o.delivered_at)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {s === "paid" || s === "delivered" ? (
                              <button
                                type="button"
                                onClick={() => setDeliveryModal({ order: o })}
                                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-2 text-sm font-semibold text-black"
                              >
                                <ImageIcon className="h-4 w-4" />
                                {s === "delivered" ? "Mettre à jour" : "Marquer livré"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "wallet" && (
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Retrait</p>
                    <h3 className="mt-1 text-2xl font-semibold">Demander un retrait</h3>
                    <p className="mt-2 text-sm text-white/60">Les retraits utilisent le solde disponible (pas le solde en attente).</p>

                    <WithdrawForm
                      disabled={!seller || seller.status !== "approved" || Boolean(seller.partnerWalletFrozen)}
                      busy={walletBusy}
                      available={wallet?.partnerWallet?.available_balance ?? 0}
                      onSubmit={(amount, payoutDetails) => void requestWithdraw({ amount, payoutDetails })}
                    />

                    {!seller ? (
                      <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                        Crée d'abord ton compte vendeur.
                      </div>
                    ) : seller.status !== "approved" ? (
                      <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                        Retrait disponible une fois le vendeur validé.
                      </div>
                    ) : seller.partnerWalletFrozen ? (
                      <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                        Wallet gelé: retraits bloqués.
                      </div>
                    ) : null}
                  </Card>

                  <div className="mt-6">
                    <Card>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Historique</p>
                      <h3 className="mt-1 text-xl font-semibold">Dernières demandes</h3>
                      <div className="mt-4 grid gap-3">
                        {(wallet?.withdrawRequests ?? []).length === 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                            Aucune demande de retrait.
                          </div>
                        ) : (
                          (wallet?.withdrawRequests ?? []).map((w: any) => (
                            <div key={String(w?.id ?? Math.random())} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-white/80">
                                  <span className="font-semibold">{formatMoney(w?.amount)}</span>
                                  <span className="text-white/45"> · {formatDateTime(w?.created_at ?? null)}</span>
                                </div>
                                <Badge tone={String(w?.status) === "paid" ? "green" : String(w?.status) === "rejected" ? "rose" : "amber"}>
                                  <Banknote className="h-3.5 w-3.5" />
                                  {String(w?.status ?? "requested") === "paid"
                                    ? "Payé"
                                    : String(w?.status ?? "requested") === "rejected"
                                      ? "Rejeté"
                                      : "Demandé"}
                                </Badge>
                              </div>
                              {w?.admin_note ? <p className="mt-2 text-sm text-white/60">Note: {String(w.admin_note)}</p> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>
                </div>

                <Card>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Solde</p>
                  {wallet?.partnerWallet ? (
                    <>
                      <p className="mt-2 text-3xl font-semibold">{formatMoney(wallet.partnerWallet.available_balance)}</p>
                      <p className="mt-1 text-xs text-white/60">Disponible</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-white/50">En attente</p>
                          <p className="mt-1 font-semibold">{formatMoney(wallet.partnerWallet.pending_balance)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-white/50">Réservé retrait</p>
                          <p className="mt-1 font-semibold">{formatMoney(wallet.partnerWallet.reserved_withdraw_balance)}</p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                        <p className="font-semibold text-white/85">Important</p>
                        <p className="mt-1 text-white/60">Les gains passent d'abord en attente, puis sont libérés manuellement par l'admin.</p>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-white/60">Wallet non disponible.</p>
                  )}
                </Card>
              </div>
            )}

            <ListingModal />
            <DeliveryModal />
          </>
        )}
      </div>
    </div>
  );
}

function WithdrawForm({
  disabled,
  busy,
  available,
  onSubmit,
}: {
  disabled: boolean;
  busy: boolean;
  available: any;
  onSubmit: (amount: number, payoutDetails: any) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("wave");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  const availNum = Number(available ?? 0);
  const avail = Number.isFinite(availNum) ? availNum : 0;

  const parsedAmount = Number(amount);
  const canSubmit =
    !disabled &&
    !busy &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= 1 &&
    parsedAmount <= avail &&
    phone.trim().length >= 6;

  return (
    <div className="mt-5 rounded-[28px] border border-white/10 bg-white/5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/70">
          Montant (FCFA)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min={1}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
            placeholder={`Max ${Math.max(0, Math.round(avail))}`}
            disabled={disabled}
          />
          <p className="mt-1 text-xs text-white/45">Disponible: {new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(avail)))} FCFA</p>
        </label>
        <label className="text-sm text-white/70">
          Méthode
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
            disabled={disabled}
          >
            <option value="wave">Wave</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_mobile_money">MTN MoMo</option>
            <option value="moov_money">Moov Money</option>
            <option value="bank">Banque</option>
          </select>
        </label>
        <label className="text-sm text-white/70">
          Numéro / Compte
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
            placeholder="Ex: +225..."
            disabled={disabled}
          />
        </label>
        <label className="text-sm text-white/70">
          Nom bénéficiaire (optionnel)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm focus:border-cyan-300 focus:outline-none"
            placeholder="Nom complet"
            disabled={disabled}
          />
        </label>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          const amountNum = Math.round(Number(amount));
          onSubmit(amountNum, { method, phone: phone.trim(), name: name.trim() || null });
          setAmount("");
        }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
        Demander le retrait
      </button>

      {disabled ? (
        <p className="mt-3 text-xs text-white/50">Action indisponible selon ton statut vendeur.</p>
      ) : parsedAmount > avail ? (
        <p className="mt-3 text-xs text-rose-200">Montant supérieur au solde disponible.</p>
      ) : null}
    </div>
  );
}

export default function SellerPage() {
  return (
    <RequireAuth>
      <SellerPageClient />
    </RequireAuth>
  );
}
