"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/components/auth/AuthProvider";

type AdminMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  role_label: string;
  permissions: string[];
};

type RoleCatalogItem = {
  label: string;
  description: string;
  category: string;
};

type ResponsibilityCatalogItem = {
  label: string;
  description: string;
  permissions: string[];
};

type SettingsPayload = {
  logo_url?: string | null;
  whatsapp_number?: string | null;
  terms?: string | null;
  admin_roles: Record<string, RoleCatalogItem>;
  responsibilities: Record<string, ResponsibilityCatalogItem>;
  responsibility_assignments: Record<string, number[]>;
  admins: AdminMember[];
};

type UserCandidate = {
  id: number;
  name: string;
  email: string;
  role?: string | null;
};

type UsersResponse = {
  data?: UserCandidate[];
};

const CATEGORY_LABELS: Record<string, string> = {
  system: "Admin systeme",
  operations: "Admin operations",
  domain: "Admin domaines",
  legacy: "Roles legacy",
};

export default function AdminSettingsPage() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [roleCatalog, setRoleCatalog] = useState<Record<string, RoleCatalogItem>>({});
  const [responsibilityCatalog, setResponsibilityCatalog] = useState<Record<string, ResponsibilityCatalogItem>>({});
  const [admins, setAdmins] = useState<AdminMember[]>([]);
  const [removedAdminIds, setRemovedAdminIds] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number[]>>({});
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [terms, setTerms] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserCandidate[]>([]);

  const applyPayload = (payload: SettingsPayload) => {
    setRoleCatalog(payload.admin_roles ?? {});
    setResponsibilityCatalog(payload.responsibilities ?? {});
    setAdmins(payload.admins ?? []);
    setAssignments(payload.responsibility_assignments ?? {});
    setWhatsappNumber(payload.whatsapp_number ?? "");
    setTerms(payload.terms ?? "");
    setLogoUrl(payload.logo_url ?? "");
    setRemovedAdminIds([]);
  };

  const loadSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/admin/settings`, { cache: "no-store" });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) {
        throw new Error("Impossible de charger les parametres admin.");
      }
      applyPayload(data);
    } catch (err) {
      setError((err as Error).message || "Impossible de charger les parametres admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, [authFetch]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: search.trim(), per_page: "12" });
        const res = await authFetch(`${API_BASE}/admin/users?${params.toString()}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as UsersResponse | null;
        if (!res.ok) {
          throw new Error("Recherche impossible.");
        }
        setResults((data?.data ?? []).filter((user) => !admins.some((member) => member.id === user.id)));
      } catch (err) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [admins, authFetch, search]);

  const groupedCounts = useMemo(() => {
    return admins.reduce<Record<string, number>>((acc, member) => {
      const category = roleCatalog[member.role]?.category ?? "legacy";
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});
  }, [admins, roleCatalog]);

  const sortedRoleOptions = useMemo(() => {
    return Object.entries(roleCatalog).sort((a, b) => a[1].label.localeCompare(b[1].label, "fr"));
  }, [roleCatalog]);

  const toggleAssignment = (key: string, adminId: number) => {
    setAssignments((current) => {
      const nextSet = new Set(current[key] ?? []);
      if (nextSet.has(adminId)) {
        nextSet.delete(adminId);
      } else {
        nextSet.add(adminId);
      }
      return {
        ...current,
        [key]: Array.from(nextSet),
      };
    });
  };

  const updateRole = (adminId: number, role: string) => {
    setAdmins((current) =>
      current.map((member) =>
        member.id === adminId
          ? { ...member, role, role_label: roleCatalog[role]?.label ?? role }
          : member,
      ),
    );
  };

  const removeAdmin = (adminId: number) => {
    setAdmins((current) => current.filter((member) => member.id !== adminId));
    setRemovedAdminIds((current) => (current.includes(adminId) ? current : [...current, adminId]));
    setAssignments((current) => {
      const next: Record<string, number[]> = {};
      Object.entries(current).forEach(([key, ids]) => {
        next[key] = ids.filter((id) => id !== adminId);
      });
      return next;
    });
  };

  const addAdmin = (candidate: UserCandidate) => {
    const defaultRole = roleCatalog[candidate.role ?? ""] ? String(candidate.role) : "admin_operations";
    setAdmins((current) => [
      ...current,
      {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        role: defaultRole,
        role_label: roleCatalog[defaultRole]?.label ?? defaultRole,
        permissions: [],
      },
    ]);
    setRemovedAdminIds((current) => current.filter((id) => id !== candidate.id));
    setResults((current) => current.filter((user) => user.id !== candidate.id));
    setSearch("");
  };

  const uploadLogo = async () => {
    if (!logoFile) return null;

    const formData = new FormData();
    formData.append("logo", logoFile);
    const res = await authFetch(`${API_BASE}/admin/settings/logo`, {
      method: "POST",
      body: formData,
    });
    const data = (await res.json().catch(() => null)) as { logo_url?: string } | null;
    if (!res.ok) {
      throw new Error("Logo impossible a televerser.");
    }
    setLogoFile(null);
    return data?.logo_url ?? null;
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        whatsapp_number: whatsappNumber,
        terms,
        admins: [
          ...admins.map((member) => ({ id: member.id, role: member.role })),
          ...removedAdminIds.map((id) => ({ id, role: "user" })),
        ],
        responsibility_assignments: assignments,
      };

      const res = await authFetch(`${API_BASE}/admin/settings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as SettingsPayload | null;
      if (!res.ok || !data) {
        throw new Error("Enregistrement impossible.");
      }

      applyPayload(data);
      const nextLogoUrl = logoFile ? await uploadLogo() : null;
      if (nextLogoUrl) {
        setLogoUrl(nextLogoUrl);
      }
      setSuccess("Parametres admin enregistres.");
    } catch (err) {
      setError((err as Error).message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-800">Roles, responsables et reglages admin</div>
        <div className="text-sm text-slate-500">Affectez qui traite les abonnements, recharges, litiges, tournois et partenariats.</div>
      </div>
      <button
        type="button"
        onClick={() => void saveSettings()}
        disabled={saving || loading}
        className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer
      </button>
    </div>
  );

  return (
    <AdminShell title="Parametres" subtitle="Attribution des roles et des responsabilites admin" actions={actions}>
      <div className="space-y-6">
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <div key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
              <div className="mt-3 text-3xl font-semibold text-slate-900">{groupedCounts[key] ?? 0}</div>
              <div className="mt-2 text-sm text-slate-500">membre(s) dans cette categorie</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold">Equipe admin</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">Promouvez des membres, changez leur categorie et retirez les acces admin.</p>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Chargement...</div>
              ) : null}

              {!loading && !admins.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Aucun admin configure.</div>
              ) : null}

              {admins.map((member) => (
                <div key={member.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{member.name}</div>
                      <div className="text-sm text-slate-500">{member.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAdmin(member.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
                    >
                      <X className="h-4 w-4" />
                      Retirer
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr),2fr]">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      Role actuel: <span className="font-medium text-slate-700">{member.role_label}</span>
                    </div>
                    <select
                      value={member.role}
                      onChange={(event) => updateRole(member.id, event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {sortedRoleOptions.map(([value, item]) => (
                        <option key={value} value={value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <UserPlus className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold">Ajouter un membre</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">Recherchez un utilisateur par pseudo ou email, puis donnez-lui un role admin.</p>

            <div className="relative mt-5">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pseudo ou email..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm text-slate-700"
              />
            </div>

            <div className="mt-4 space-y-2">
              {searching ? <div className="text-sm text-slate-500">Recherche...</div> : null}
              {!searching && search.trim().length >= 2 && !results.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">Aucun utilisateur trouve.</div>
              ) : null}

              {results.map((candidate) => (
                <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{candidate.name}</div>
                    <div className="text-sm text-slate-500">{candidate.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addAdmin(candidate)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    <Users className="h-4 w-4" />
                    Ajouter
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">Reglages generaux</div>
              <div className="mt-4 space-y-4">
                <label className="block text-sm text-slate-600">
                  <span className="mb-2 block">Numero WhatsApp support</span>
                  <input
                    value={whatsappNumber}
                    onChange={(event) => setWhatsappNumber(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                  />
                </label>

                <label className="block text-sm text-slate-600">
                  <span className="mb-2 block">Logo admin</span>
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="mb-3 h-14 rounded-2xl border border-slate-200 bg-white object-contain p-2" /> : null}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                    className="block w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                  />
                </label>

                <label className="block text-sm text-slate-600">
                  <span className="mb-2 block">Conditions / notes internes</span>
                  <textarea
                    value={terms}
                    onChange={(event) => setTerms(event.target.value)}
                    rows={6}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Responsabilites operationnelles</h2>
          <p className="mt-2 text-sm text-slate-500">Chaque domaine peut etre assigne a un ou plusieurs admins. Les alertes email suivent ces affectations.</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Object.entries(responsibilityCatalog).map(([key, item]) => (
              <div key={key} className="rounded-2xl border border-slate-200 p-4">
                <div className="text-base font-semibold text-slate-900">{item.label}</div>
                <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                <div className="mt-4 space-y-2">
                  {admins.length ? (
                    admins.map((member) => {
                      const checked = (assignments[key] ?? []).includes(member.id);
                      return (
                        <label key={`${key}-${member.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span>
                            {member.name}
                            <span className="ml-2 text-slate-400">{member.role_label}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAssignment(key, member.id)}
                            className="h-4 w-4 rounded border-slate-300 text-red-500"
                          />
                        </label>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">Ajoutez d'abord un admin.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}