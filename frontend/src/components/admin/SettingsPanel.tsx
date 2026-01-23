"use client";

import { useEffect, useState } from "react";
import { ImageUp, Phone, ScrollText } from "lucide-react";
import { Settings } from "./types";

export function SettingsPanel({
  settings,
  onSave,
  onUploadLogo,
  loading,
}: {
  settings: Settings | null;
  onSave: (payload: Partial<Settings>) => Promise<void>;
  onUploadLogo: (file: File) => Promise<void>;
  loading: boolean;
}) {
  const [whatsapp, setWhatsapp] = useState("");
  const [terms, setTerms] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsapp_number ?? "");
      setTerms(settings.terms ?? "");
      setLogoPreview(settings.logo_url ?? undefined);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ whatsapp_number: whatsapp, terms });
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    await onUploadLogo(file);
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <ScrollText className="h-4 w-4" /> Paramètres site
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm text-white/80">
          <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
            <ImageUp className="h-4 w-4" /> Logo
          </span>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-white/5">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/50">—</div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogo}
              className="text-xs text-white/70 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-white"
            />
          </div>
        </label>

        <label className="flex flex-col gap-2 text-sm text-white/80">
          <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
            <Phone className="h-4 w-4" /> Numéro WhatsApp
          </span>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring"
            placeholder="Ex: +225 07 12 34 56"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-white/80">
          <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
            <ScrollText className="h-4 w-4" /> CGU / Mentions
          </span>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={4}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring"
            placeholder="Collez vos CGU ici"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sauvegarde..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
