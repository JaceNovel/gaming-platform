"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type OrderItem = {
  id: number;
  product?: { name?: string | null } | null;
};

type Order = {
  id: number;
  reference?: string | null;
  total_price?: number | string | null;
  created_at?: string | null;
  status?: string | null;
  payment?: { status?: string | null } | null;
  order_items?: OrderItem[];
  orderItems?: OrderItem[];
};

type UserDetail = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  country_name?: string | null;
  country_code?: string | null;
};

type UserDetailResponse = {
  data: {
    user: UserDetail;
    profile?: {
      phone?: string | null;
      billing_address?: string | null;
      shipping_address?: string | null;
      last_order_at?: string | null;
      game_user_id?: string | null;
    };
    orders: Order[];
    wallet?: {
      balance?: number | string | null;
      currency?: string | null;
      status?: string | null;
    };
  };
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = String(params?.id ?? "");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<UserDetailResponse["data"]["profile"] | null>(null);
  const [wallet, setWallet] = useState<UserDetailResponse["data"]["wallet"] | null>(null);

  const [phoneOld, setPhoneOld] = useState("");
  const [phoneNew, setPhoneNew] = useState("");
  const [phoneNote, setPhoneNote] = useState("");
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<string | null>(null);

  const [phoneRequests, setPhoneRequests] = useState<
    Array<{
      id: number;
      old_phone: string;
      new_phone: string;
      reason?: string | null;
      status: string;
      created_at?: string | null;
      pdf_url?: string | null;
      attachment_url?: string | null;
    }>
  >([]);

  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) return;
    const payload = (await res.json()) as UserDetailResponse;
    setUser(payload?.data?.user ?? null);
    setOrders(payload?.data?.orders ?? []);
    setProfile(payload?.data?.profile ?? null);
    setWallet(payload?.data?.wallet ?? null);
  }, [userId]);

  const loadPhoneRequests = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/phone-change-requests`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      setPhoneRequests([]);
      return;
    }
    const payload = await res.json().catch(() => null);
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    setPhoneRequests(rows);
  }, [userId]);

  const handleManualPhoneChange = useCallback(async () => {
    setPhoneError(null);
    setPhoneStatus(null);

    if (!phoneOld.trim() || !phoneNew.trim()) {
      setPhoneError("Ancien et nouveau numéro requis.");
      return;
    }

    setPhoneSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/phone/change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          old_phone: phoneOld.trim(),
          new_phone: phoneNew.trim(),
          note: phoneNote.trim() || null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setPhoneError(payload?.message ?? "Changement impossible.");
        return;
      }
      setPhoneStatus("Numéro mis à jour.");
      setPhoneOld("");
      setPhoneNew("");
      setPhoneNote("");
      await loadUser();
      await loadPhoneRequests();
    } catch {
      setPhoneError("Changement impossible.");
    } finally {
      setPhoneSubmitting(false);
    }
  }, [loadPhoneRequests, loadUser, phoneNew, phoneNote, phoneOld, userId]);

  const processRequest = useCallback(
    async (id: number, action: "approve" | "reject") => {
      setPhoneError(null);
      setPhoneStatus(null);
      setPhoneSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/admin/phone-change-requests/${id}/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ admin_note: null }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          setPhoneError(payload?.message ?? "Action impossible.");
          return;
        }
        setPhoneStatus(action === "approve" ? "Demande approuvée." : "Demande rejetée.");
        await loadUser();
        await loadPhoneRequests();
      } catch {
        setPhoneError("Action impossible.");
      } finally {
        setPhoneSubmitting(false);
      }
    },
    [loadPhoneRequests, loadUser],
  );

  const handleWalletCredit = useCallback(async () => {
    setWalletError(null);
    setWalletStatus(null);

    const amountValue = Number(walletAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setWalletError("Montant invalide.");
      return;
    }

    setWalletSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/wallet/credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          amount: amountValue,
          reason: walletReason.trim() || null,
        }),
      });

      if (!res.ok) {
        setWalletError("Crédit wallet impossible.");
        return;
      }

      const payload = (await res.json()) as {
        data?: { wallet?: { balance?: number | string | null; currency?: string | null; status?: string | null } };
      };

      setWallet(payload?.data?.wallet ?? null);
      setWalletStatus("Wallet crédité.");
      setWalletAmount("");
      setWalletReason("");
    } catch {
      setWalletError("Crédit wallet impossible.");
    } finally {
      setWalletSubmitting(false);
    }
  }, [userId, walletAmount, walletReason]);

  useEffect(() => {
    if (userId) {
      loadUser();
      loadPhoneRequests();
    }
  }, [loadPhoneRequests, loadUser, userId]);

  const initials = useMemo(() => user?.name?.slice(0, 1).toUpperCase() ?? "U", [user?.name]);
  const walletBalanceLabel = useMemo(() => {
    const value = wallet?.balance ?? 0;
    const currency = wallet?.currency ?? "FCFA";
    return `${value} ${currency}`;
  }, [wallet?.balance, wallet?.currency]);

  const effectivePhone = useMemo(() => {
    const direct = String(user?.phone ?? "").trim();
    const metaPhone = String(profile?.phone ?? "").trim();
    return direct || metaPhone || "—";
  }, [profile?.phone, user?.phone]);

  return (
    <AdminShell title="Utilisateurs" subtitle="Détails du compte">
      <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-2xl font-semibold text-slate-600">
              {initials}
            </div>
            <button className="rounded-full border border-slate-200 p-2 text-slate-500">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <h2 className="text-xl font-semibold">{user?.name ?? "—"}</h2>
          </div>
          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <div>
              <div className="text-xs uppercase text-slate-400">Email</div>
              <div>{user?.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">ID de jeu</div>
              <div>{profile?.game_user_id ?? "Non défini"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">Dernière connexion</div>
              <div>{profile?.last_order_at ? new Date(profile.last_order_at).toLocaleDateString() : "Jamais"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">Pays</div>
              <div>{user?.country_name ?? user?.country_code ?? "—"}</div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-400">Téléphone</div>
              <div>{effectivePhone}</div>
            </div>

            <div className="pt-2">
              <div className="text-xs uppercase text-slate-400">Wallet</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="font-semibold text-slate-800">{walletBalanceLabel}</div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  {wallet?.status ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700">Remboursement (crédit wallet)</h3>
            <div className="mt-3 grid gap-3">
              <div>
                <label className="text-xs uppercase text-slate-400">Montant (FCFA)</label>
                <input
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="5000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">Raison (optionnel)</label>
                <input
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Annulation commande, geste commercial..."
                />
              </div>

              {walletError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  {walletError}
                </div>
              )}
              {walletStatus && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {walletStatus}
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  onClick={handleWalletCredit}
                  disabled={walletSubmitting}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {walletSubmitting ? "Crédit..." : "Créditer le wallet"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700">Changement de numéro</h3>
            <div className="mt-3 grid gap-3">
              <div>
                <label className="text-xs uppercase text-slate-400">Ancien numéro (client)</label>
                <input
                  value={phoneOld}
                  onChange={(e) => setPhoneOld(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Ancien numéro"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">Nouveau numéro</label>
                <input
                  value={phoneNew}
                  onChange={(e) => setPhoneNew(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Nouveau numéro"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">Note admin (optionnel)</label>
                <input
                  value={phoneNote}
                  onChange={(e) => setPhoneNote(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Changement demandé via chat / dossier..."
                />
              </div>

              {phoneError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  {phoneError}
                </div>
              )}
              {phoneStatus && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {phoneStatus}
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  onClick={handleManualPhoneChange}
                  disabled={phoneSubmitting}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {phoneSubmitting ? "Traitement..." : "Appliquer"}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs uppercase text-slate-400">Demandes Basic (50 dernières)</div>
              {!phoneRequests.length ? (
                <p className="mt-2 text-sm text-slate-400">Aucune demande.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {phoneRequests.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold">#{r.id} • {r.status}</div>
                          <div className="text-slate-600">{r.old_phone} → {r.new_phone}</div>
                          {r.reason ? <div className="mt-1 text-xs text-slate-500">Motif: {r.reason}</div> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.pdf_url ? (
                            <a className="rounded-lg border border-slate-200 px-3 py-1 text-xs" href={r.pdf_url} target="_blank" rel="noreferrer">
                              PDF
                            </a>
                          ) : null}
                          {r.attachment_url ? (
                            <a className="rounded-lg border border-slate-200 px-3 py-1 text-xs" href={r.attachment_url} target="_blank" rel="noreferrer">
                              Fichier
                            </a>
                          ) : null}
                          {r.status === "pending" ? (
                            <>
                              <button
                                onClick={() => processRequest(r.id, "approve")}
                                disabled={phoneSubmitting}
                                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white disabled:opacity-60"
                              >
                                Approuver
                              </button>
                              <button
                                onClick={() => processRequest(r.id, "reject")}
                                disabled={phoneSubmitting}
                                className="rounded-lg bg-rose-600 px-3 py-1 text-xs text-white disabled:opacity-60"
                              >
                                Rejeter
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-6 border-b border-slate-100 pb-4 text-sm font-semibold text-slate-600">
            <button className="rounded-full border border-slate-200 bg-white px-4 py-1">Facturation</button>
            <button className="rounded-full px-4 py-1 text-slate-400">Activité</button>
          </div>
          <div className="mt-6">
            <h3 className="text-base font-semibold">Historique des achats</h3>
            {!orders.length && (
              <p className="mt-2 text-sm text-slate-400">Aucun historique d'achat disponible</p>
            )}
            {orders.length > 0 && (
              <div className="mt-4 space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-slate-100 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{order.reference ?? `#${order.id}`}</div>
                        <div className="text-xs text-slate-400">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                        </div>
                      </div>
                      <div className="font-semibold text-slate-700">{order.total_price ?? "—"} FCFA</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {order.orderItems?.[0]?.product?.name ?? order.order_items?.[0]?.product?.name ?? "Produit"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Adresses</h4>
                <div className="mt-3 space-y-2 text-sm text-slate-500">
                  <p>Adresse de facturation</p>
                  <p>{profile?.billing_address ?? "Non définie"}</p>
                  <p>Adresse de livraison</p>
                  <p>{profile?.shipping_address ?? "Non définie"}</p>
                  <p>Pays: {user?.country_name ?? "—"}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Méthodes de paiement</h4>
                <div className="mt-3 text-sm text-slate-500">Aucune méthode enregistrée</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
