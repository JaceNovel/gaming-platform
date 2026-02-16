"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/config";

export default function ResetPasswordClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!token || !email) return false;
    if (!password || password.length < 8) return false;
    if (password !== passwordConfirm) return false;
    return !loading;
  }, [email, loading, password, passwordConfirm, token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirm,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const parsed = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

      if (!res.ok) {
        const msg = parsed?.message ?? "Lien de réinitialisation invalide ou expiré.";
        setError(msg);
        return;
      }

      setStatus(parsed?.message ?? "Mot de passe réinitialisé.");
      setTimeout(() => router.replace("/auth/login"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réinitialisation impossible");
    } finally {
      setLoading(false);
    }
  };

  const missingParams = !token || !email;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02010a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(79,70,229,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.35),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.25),transparent_55%)]" />
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(120deg, rgba(3,7,18,0.95), rgba(10,6,25,0.8))" }} />

      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
        <div className="rounded-[32px] border border-white/10 bg-black/40 p-8 backdrop-blur-xl shadow-[0_25px_80px_rgba(2,4,24,0.9)]">
          <p className="text-xs uppercase tracking-[0.45em] text-cyan-200/80">PRIME GAMING</p>
          <h1 className="mt-4 text-2xl font-semibold">Réinitialiser le mot de passe</h1>

          {missingParams ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-rose-200">Lien invalide: token/email manquant.</p>
              <Link href="/auth/forgot-password" className="text-cyan-300 no-underline">
                Demander un nouveau lien
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-white/60">Compte: {email}</p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <label className="block text-sm">
                  <span className="text-white/70">Nouveau mot de passe</span>
                  <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-cyan-300">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                      placeholder="Au moins 8 caractères"
                      required
                    />
                  </div>
                </label>

                <label className="block text-sm">
                  <span className="text-white/70">Confirmer</span>
                  <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-cyan-300">
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                      placeholder="Répéter le mot de passe"
                      required
                    />
                  </div>
                </label>

                {error ? (
                  <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
                ) : null}
                {status ? (
                  <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{status}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-orange-400 px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(14,165,233,0.35)] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Validation..." : "Mettre à jour"}
                </button>

                <div className="flex items-center justify-between text-sm text-white/60">
                  <Link href="/auth/login" className="text-cyan-300 no-underline">
                    Retour à la connexion
                  </Link>
                  <Link href="/auth/forgot-password" className="text-white/60 hover:text-white">
                    Nouveau lien
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
