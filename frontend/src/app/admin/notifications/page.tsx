"use client";

import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminNotificationsPage() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/notifications/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(err?.message ?? "Envoi impossible");
        return;
      }

      setMessage("");
      setStatus("Notification envoyée.");
    } catch {
      setStatus("Envoi impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Notifications" subtitle="Envoyer une mise à jour au site">
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <label className="text-sm font-medium">Message de mise à jour</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            placeholder="Ex: Nouveaux comptes Free Fire ajoutés, section Promotions mise à jour..."
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
          >
            {loading ? "Envoi..." : "Envoyer la notification"}
          </button>
          {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
        </div>
      </form>
    </AdminShell>
  );
}
