"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type EmailLog = {
  id: number;
  type?: string | null;
  to?: string | null;
  subject?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type EmailTemplate = {
  id: number;
  key?: string | null;
  name?: string | null;
  subject?: string | null;
  is_active?: boolean | null;
};

type LogsResponse = { data: EmailLog[] };

type TemplatesResponse = { data: EmailTemplate[] };

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR");
};

export default function AdminEmailPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [error, setError] = useState("");

  const [directTo, setDirectTo] = useState("");
  const [directSubject, setDirectSubject] = useState("Message de BADBOYSHOP");
  const [directMessage, setDirectMessage] = useState("");
  const [directSending, setDirectSending] = useState(false);
  const [directStatus, setDirectStatus] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries({
            type: typeFilter,
            status: statusFilter,
            email: emailFilter,
          }).filter(([, value]) => value)
        )
      ).toString();
      const logsUrl = query ? `${API_BASE}/admin/email-logs?${query}` : `${API_BASE}/admin/email-logs`;

      const [logsRes, templatesRes] = await Promise.all([
        fetch(logsUrl, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }),
        fetch(`${API_BASE}/admin/email-templates`, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }),
      ]);

      if (logsRes.ok) {
        const payload = (await logsRes.json()) as LogsResponse;
        setLogs(payload?.data ?? []);
      }

      if (templatesRes.ok) {
        const payload = (await templatesRes.json()) as TemplatesResponse;
        setTemplates(payload?.data ?? []);
      }
    } catch {
      setError("Impossible de charger les emails.");
    }
  }, [emailFilter, statusFilter, typeFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleDeleteTemplate = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`${API_BASE}/admin/email-templates/${id}`, {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
          },
        });
        if (!res.ok) {
          setError("Suppression impossible");
          return;
        }
        await loadAll();
      } catch {
        setError("Suppression impossible");
      }
    },
    [loadAll]
  );

  const activeTemplates = useMemo(() => templates.filter((t) => t.is_active), [templates]);

  const actions = (
    <div className="flex items-center justify-end">
      <Link
        href="/admin/email/templates/add"
        className="rounded-xl bg-rose-600 px-4 py-2 text-sm text-white"
      >
        Ajouter un template
      </Link>
    </div>
  );

  const sendDirectEmail = useCallback(async () => {
    setError("");
    setDirectStatus(null);

    const to = directTo.trim();
    const message = directMessage.trim();
    const subject = directSubject.trim() || "Message de BADBOYSHOP";

    if (!to || !message) {
      setError("Email et message sont obligatoires.");
      return;
    }

    setDirectSending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/email/send-direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          to_email: to,
          subject,
          message,
        }),
      });

      if (!res.ok) {
        setError("Envoi impossible.");
        return;
      }

      setDirectStatus("Email mis en file d'attente.");
      setDirectMessage("");
      await loadAll();
    } catch {
      setError("Envoi impossible.");
    } finally {
      setDirectSending(false);
    }
  }, [directMessage, directSubject, directTo, loadAll]);

  return (
    <AdminShell title="Email" subtitle="Templates & logs" actions={actions}>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold">Envoyer un email direct</h3>
        <p className="mt-2 text-sm text-slate-500">
          Saisissez l'email du client et votre message, puis envoyez depuis l'admin.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase text-slate-400">Email destinataire</label>
            <input
              value={directTo}
              onChange={(e) => setDirectTo(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="client@mail.com"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-400">Sujet</label>
            <input
              value={directSubject}
              onChange={(e) => setDirectSubject(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Message de BADBOYSHOP"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs uppercase text-slate-400">Message</label>
          <textarea
            value={directMessage}
            onChange={(e) => setDirectMessage(e.target.value)}
            className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2"
            placeholder="Tapez votre message..."
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{directStatus ?? ""}</div>
          <button
            onClick={sendDirectEmail}
            disabled={directSending}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {directSending ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm md:grid-cols-3">
        <div>
          <label className="text-xs uppercase text-slate-400">Type</label>
          <input
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
            placeholder="payment_success"
          />
        </div>
        <div>
          <label className="text-xs uppercase text-slate-400">Statut</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="">Tous</option>
            <option value="sent">Envoyé</option>
            <option value="failed">Échec</option>
            <option value="queued">En attente</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase text-slate-400">Email</label>
          <input
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
            placeholder="client@mail.com"
          />
        </div>
      </div>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold">Templates</h3>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Clé</th>
                  <th className="px-4 py-3">Sujet</th>
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700">{template.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{template.key ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{template.subject ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          template.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {template.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/email/templates/${template.id}`}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        >
                          Modifier
                        </Link>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!templates.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                      Aucun template
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold">Logs d'envoi</h3>
          <p className="mt-2 text-sm text-slate-500">{activeTemplates.length} templates actifs</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Destinataire</th>
                  <th className="px-4 py-3">Sujet</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{log.type ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{log.to ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{log.subject ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          log.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {log.status ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                      Aucun log
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
