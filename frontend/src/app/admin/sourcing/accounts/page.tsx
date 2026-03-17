"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type SupplierAccount = {
  id: number;
  platform: "alibaba" | "aliexpress";
  label: string;
  member_id?: string | null;
  resource_owner?: string | null;
  app_key?: string | null;
  country_code?: string | null;
  currency_code?: string | null;
  scopes_json?: string[] | null;
  is_active: boolean;
  has_app_secret: boolean;
  has_access_token: boolean;
  has_refresh_token: boolean;
  access_token_expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  last_sync_at?: string | null;
  last_error_message?: string | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const maskAppKey = (value?: string | null) => {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "—";
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
};

export default function AdminSourcingAccountsPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [platform, setPlatform] = useState<"alibaba" | "aliexpress">("alibaba");
  const [label, setLabel] = useState("");
  const [memberId, setMemberId] = useState("");
  const [resourceOwner, setResourceOwner] = useState("");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/supplier-accounts`, {
        headers: {
          Accept: "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger les comptes fournisseurs");
      const payload = await res.json();
      setAccounts(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError("Impossible de charger les comptes fournisseurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const oauthStatus = searchParams.get("oauth");
    if (oauthStatus === "success") {
      setSuccess(`Connexion OAuth ${searchParams.get("platform") || "fournisseur"} terminée.`);
      loadAccounts();
    }
    if (oauthStatus === "error") {
      setError(searchParams.get("message") || "La connexion OAuth a échoué.");
    }
  }, [loadAccounts, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/supplier-accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          platform,
          label: label.trim(),
          member_id: memberId.trim() || undefined,
          resource_owner: resourceOwner.trim() || undefined,
          app_key: appKey.trim() || undefined,
          app_secret: appSecret.trim() || undefined,
          country_code: countryCode.trim() || undefined,
          currency_code: currencyCode.trim() || undefined,
          is_active: isActive,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Création impossible");
      }
      setLabel("");
      setMemberId("");
      setResourceOwner("");
      setAppKey("");
      setAppSecret("");
      setCountryCode("");
      setCurrencyCode("");
      setIsActive(true);
      setSuccess("Compte fournisseur ajouté.");
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message ?? "Création impossible");
    }
  };

  const startOauth = async (accountId: number) => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/supplier-accounts/${accountId}/oauth/connect`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Connexion OAuth impossible");
      }
      const payload = await res.json();
      const target = payload?.authorization_url;
      if (!target) throw new Error("URL OAuth absente");
      window.location.href = target;
    } catch (err: any) {
      setError(err?.message ?? "Connexion OAuth impossible");
    }
  };

  const refreshOauth = async (accountId: number) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/supplier-accounts/${accountId}/oauth/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Refresh token impossible");
      }
      setSuccess("Token fournisseur rafraîchi.");
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message ?? "Refresh token impossible");
    }
  };

  return (
    <AdminShell title="Sourcing" subtitle="Comptes fournisseurs Alibaba / AliExpress">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Ajouter un compte fournisseur</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Plateforme</span>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} className="rounded-xl border border-slate-200 px-3 py-2">
                <option value="alibaba">Alibaba</option>
                <option value="aliexpress">AliExpress</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Libellé</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Member ID</span>
              <input value={memberId} onChange={(e) => setMemberId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Resource owner</span>
              <input value={resourceOwner} onChange={(e) => setResourceOwner(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">App Key</span>
              <input value={appKey} onChange={(e) => setAppKey(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">App Secret</span>
              <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Pays</span>
                <input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Devise</span>
                <input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Actif
            </label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">
              Enregistrer
            </button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Comptes enregistrés</h2>
              <p className="text-sm text-slate-500">Base de connexion OAuth et synchronisation fournisseur.</p>
            </div>
            <button type="button" onClick={loadAccounts} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Rafraîchir
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Compte</th>
                  <th className="pb-3 pr-4">Clés</th>
                  <th className="pb-3 pr-4">Tokens</th>
                  <th className="pb-3 pr-4">Pays</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-slate-500">Aucun compte fournisseur.</td>
                  </tr>
                ) : null}
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-slate-900">{account.label}</div>
                      <div className="text-xs text-slate-500">{account.platform} · member {account.member_id || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>App Key: {account.app_key ? "Oui" : "Non"}</div>
                      <div>ID: {maskAppKey(account.app_key)}</div>
                      <div>App Secret: {account.has_app_secret ? "Oui" : "Non"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>Access: {account.has_access_token ? "Oui" : "Non"}</div>
                      <div>Refresh: {account.has_refresh_token ? "Oui" : "Non"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{account.country_code || "—"}</div>
                      <div>{account.currency_code || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{account.is_active ? "Actif" : "Inactif"}</div>
                      <div>{account.last_error_message || "Pas d’erreur"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startOauth(account.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
                          Connecter OAuth
                        </button>
                        <button type="button" onClick={() => refreshOauth(account.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
                          Refresh token
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}