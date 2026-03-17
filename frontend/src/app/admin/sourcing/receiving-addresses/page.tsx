"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type SupplierCountry = {
  id: number;
  code: string;
  name: string;
};

type ReceivingAddress = {
  id: number;
  platform: "alibaba" | "aliexpress";
  supplier_country_id: number;
  recipient_name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  postal_code?: string | null;
  phone: string;
  shipping_mark?: string | null;
  is_active: boolean;
  is_default: boolean;
  country?: SupplierCountry | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingReceivingAddressesPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [countries, setCountries] = useState<SupplierCountry[]>([]);
  const [addresses, setAddresses] = useState<ReceivingAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [countryId, setCountryId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingMark, setShippingMark] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(true);

  const resetForm = () => {
    setEditingId(null);
    setCountryId("");
    setRecipientName("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setPostalCode("");
    setPhone("");
    setShippingMark("");
    setIsActive(true);
    setIsDefault(true);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [countriesRes, addressesRes] = await Promise.all([
        fetch(`${API_BASE}/admin/sourcing/countries?platform=${platform}&active=1`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
        fetch(`${API_BASE}/admin/sourcing/receiving-addresses?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
      ]);
      if (!countriesRes.ok || !addressesRes.ok) throw new Error(`Impossible de charger les adresses ${platformLabel}`);
      const countriesPayload = await countriesRes.json();
      const addressesPayload = await addressesRes.json();
      const nextCountries = Array.isArray(countriesPayload?.data) ? countriesPayload.data : [];
      setCountries(nextCountries);
      setAddresses(Array.isArray(addressesPayload?.data) ? addressesPayload.data : []);
      setCountryId((current) => current || String(nextCountries[0]?.id ?? ""));
    } catch (err: any) {
      setError(err?.message ?? `Impossible de charger les adresses ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const isEditing = editingId !== null;
      const res = await fetch(`${API_BASE}/admin/sourcing/receiving-addresses${isEditing ? `/${editingId}` : ""}`, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          platform,
          supplier_country_id: Number(countryId),
          recipient_name: recipientName.trim(),
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || undefined,
          city: city.trim(),
          postal_code: postalCode.trim() || undefined,
          phone: phone.trim(),
          shipping_mark: shippingMark.trim() || undefined,
          is_active: isActive,
          is_default: isDefault,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Enregistrement impossible");
      }
      resetForm();
      setSuccess(isEditing ? "Adresse mise a jour." : "Adresse ajoutee.");
      await loadData();
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement impossible");
    }
  };

  const startEditing = (address: ReceivingAddress) => {
    setEditingId(address.id);
    setCountryId(String(address.supplier_country_id));
    setRecipientName(address.recipient_name || "");
    setAddressLine1(address.address_line1 || "");
    setAddressLine2(address.address_line2 || "");
    setCity(address.city || "");
    setPostalCode(address.postal_code || "");
    setPhone(address.phone || "");
    setShippingMark(address.shipping_mark || "");
    setIsActive(Boolean(address.is_active));
    setIsDefault(Boolean(address.is_default));
  };

  const removeAddress = async (addressId: number) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/receiving-addresses/${addressId}`, {
        method: "DELETE",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Suppression impossible");
      setSuccess("Adresse supprimee.");
      if (editingId === addressId) resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message ?? "Suppression impossible");
    }
  };

  return (
    <AdminShell title={platformLabel} subtitle="Adresses de reception utilisees pour les livraisons fournisseur">
      <div className="grid gap-6 xl:grid-cols-[460px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{editingId !== null ? "Modifier une adresse" : "Ajouter une adresse"}</h2>
            {editingId !== null ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                Annuler
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Pays</span>
              <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>{country.name} ({country.code})</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Nom destinataire</span>
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Adresse complete</span>
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Complement</span>
              <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Ville</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Code postal</span>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Telephone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Shipping mark</span>
              <input value={shippingMark} onChange={(e) => setShippingMark(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Adresse par defaut pour ce pays
            </label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">
              {editingId !== null ? "Mettre a jour" : "Enregistrer"}
            </button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Adresses configurees</h2>
              <p className="text-sm text-slate-500">Destination fournisseur par pays pour {platformLabel}.</p>
            </div>
            <button type="button" onClick={loadData} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Rafraichir
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Pays</th>
                  <th className="pb-3 pr-4">Destinataire</th>
                  <th className="pb-3 pr-4">Coordonnees</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && addresses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">Aucune adresse configuree.</td>
                  </tr>
                ) : null}
                {addresses.map((address) => (
                  <tr key={address.id}>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div className="font-medium text-slate-900">{address.country?.name || "Pays"}</div>
                      <div>{address.country?.code || "--"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{address.recipient_name}</div>
                      <div>{address.shipping_mark || "Sans shipping mark"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{address.address_line1}</div>
                      <div>{address.city} {address.postal_code || ""}</div>
                      <div>{address.phone}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{address.is_active ? "Active" : "Inactive"}</div>
                      <div>{address.is_default ? "Par defaut" : "Secondaire"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEditing(address)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
                          Modifier
                        </button>
                        <button type="button" onClick={() => removeAddress(address.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
                          Supprimer
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