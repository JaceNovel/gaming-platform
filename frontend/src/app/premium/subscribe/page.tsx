"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

function PremiumSubscribeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [followersCount, setFollowersCount] = useState("");
  const [promotionChannels, setPromotionChannels] = useState("");
  const [otherPlatforms, setOtherPlatforms] = useState("");
  const [motivation, setMotivation] = useState("");

  const level = useMemo(() => {
    const raw = String(searchParams.get("level") ?? "bronze").trim().toLowerCase();
    return raw === "platine" ? "platine" : "bronze";
  }, [searchParams]);

  const submitRequest = useCallback(async () => {
    setStatus(null);
    if (!socialPlatform.trim()) {
      setStatus("Indiquez votre plateforme principale.");
      return;
    }
    if (!motivation.trim()) {
      setStatus("Expliquez votre motivation.");
      return;
    }
    if (!followersCount.trim()) {
      setStatus("Indiquez votre audience.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/premium/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          level: String(level ?? "bronze").toLowerCase(),
          social_platform: socialPlatform.trim(),
          social_handle: socialHandle.trim() || null,
          social_url: socialUrl.trim() || null,
          followers_count: Number(followersCount || 0),
          promotion_channels: promotionChannels.trim() || null,
          other_platforms: otherPlatforms.trim() || null,
          motivation: motivation.trim(),
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(payload?.message ?? "Impossible d'envoyer la demande Premium.");
        return;
      }
      setStatus(payload?.message ?? "Demande envoyée.");
      window.setTimeout(() => router.replace("/account"), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'envoyer la demande Premium.";
      setStatus(message || "Impossible d'envoyer la demande Premium.");
    } finally {
      setSubmitting(false);
    }
  }, [followersCount, level, motivation, otherPlatforms, promotionChannels, router, socialHandle, socialPlatform, socialUrl]);

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Premium" label="Demande" />
      <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-6">
        <p className="text-sm text-white/70">Plan demandé: <span className="font-semibold capitalize text-white">{level}</span></p>
        <p className="text-sm text-white/60">L'équipe admin valide ou refuse les demandes. En cas d'acceptation, tu recevras par email les directives et le certificat de partenariat.</p>
        <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          Après étude de ta demande, nous te contacterons sur la plateforme et le compte que tu renseignes dans ce formulaire.
        </p>
        <div className="grid gap-3">
          <div>
            <label className="text-sm text-white/70">Plateforme principale</label>
            <input
              value={socialPlatform}
              onChange={(e) => setSocialPlatform(e.target.value)}
              disabled={submitting}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder="TikTok, Instagram, YouTube, Discord..."
            />
            <p className="mt-2 text-xs text-white/45">Indique la plateforme sur laquelle notre équipe pourra te recontacter.</p>
          </div>
          <div>
            <label className="text-sm text-white/70">Pseudo / Handle</label>
            <input
              value={socialHandle}
              onChange={(e) => setSocialHandle(e.target.value)}
              disabled={submitting}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder="@toncompte"
            />
            <p className="mt-2 text-xs text-white/45">Renseigne le pseudo exact du compte à contacter sur cette plateforme.</p>
          </div>
          <div>
            <label className="text-sm text-white/70">Lien du profil</label>
            <input
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
              disabled={submitting}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Nombre d'abonnés / membres</label>
            <input
              value={followersCount}
              onChange={(e) => setFollowersCount(e.target.value.replace(/[^0-9]/g, ""))}
              disabled={submitting}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Autres plateformes</label>
            <textarea
              value={otherPlatforms}
              onChange={(e) => setOtherPlatforms(e.target.value)}
              disabled={submitting}
              className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder={"Une plateforme par ligne\nEx: YouTube 4 500 abonnés\nEx: Discord 12 000 membres"}
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Canaux de promotion prévus</label>
            <textarea
              value={promotionChannels}
              onChange={(e) => setPromotionChannels(e.target.value)}
              disabled={submitting}
              className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder={"Une ligne par canal\nEx: Shorts YouTube\nEx: Stories Instagram\nEx: Statuts WhatsApp"}
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Pourquoi devons-nous t'accepter ?</label>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              disabled={submitting}
              className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder="Présente ton audience, ton rythme de publication et la manière dont tu comptes promouvoir PRIME Gaming et KING League."
            />
          </div>
        </div>

        {status ? <p className="text-sm text-amber-200">{status}</p> : null}
        <div className="flex gap-3">
          <GlowButton
            variant="secondary"
            className="flex-1 justify-center"
            onClick={() => router.push("/premium")}
            disabled={submitting}
          >
            Retour
          </GlowButton>
          <GlowButton className="flex-1 justify-center" onClick={submitRequest} disabled={submitting}>
            {submitting ? "Envoi..." : "Envoyer la demande"}
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

export default function PremiumSubscribePage() {
  return (
    <RequireAuth>
      <PremiumSubscribeScreen />
    </RequireAuth>
  );
}
