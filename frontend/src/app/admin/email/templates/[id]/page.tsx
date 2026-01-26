"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type EmailTemplate = {
  id: number;
  key?: string | null;
  name?: string | null;
  subject?: string | null;
  body?: string | null;
  is_active?: boolean | null;
};

type TemplateResponse = { data: EmailTemplate };

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminEmailTemplateEditPage() {
  const params = useParams();
  const templateId = String(params?.id ?? "");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => getAuthHeaders(), []);

  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`${API_BASE}/admin/email-templates/${templateId}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      if (!res.ok) throw new Error("Impossible de charger le template");
      const payload = (await res.json()) as TemplateResponse;
      const template = payload?.data;
      if (!template) return;
      setName(template.name ?? "");
      setSubject(template.subject ?? "");
      setBody(template.body ?? "");
      setIsActive(Boolean(template.is_active));
    } catch {
      setStatus("Impossible de charger le template");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      is_active: isActive,
    };

    try {
      const res = await fetch(`${API_BASE}/admin/email-templates/${templateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setStatus(msg?.message ?? "Mise à jour impossible");
        return;
      }

      setStatus("Template mis à jour.");
    } catch {
      setStatus("Mise à jour impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Modifier un template" subtitle="Mettre à jour le template email">
      <form onSubmit={handleSubmit} className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Sujet *</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Contenu *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={8}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Actif
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
          >
            {loading ? "En cours..." : "Mettre à jour"}
          </button>
          {status && <p className="text-sm text-slate-500">{status}</p>}
        </div>
      </form>
    </AdminShell>
  );
}
