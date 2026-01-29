"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

const COUNTRY_OPTIONS = [
  { code: "FR", name: "France" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "SN", name: "Sénégal" },
  { code: "CM", name: "Cameroun" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Bénin" },
  { code: "BF", name: "Burkina Faso" },
  { code: "ML", name: "Mali" },
  { code: "NE", name: "Niger" },
  { code: "GN", name: "Guinée" },
];

const HERO_STATS = [
  { label: "90K+", caption: "Top-up livrés" },
  { label: "24/7", caption: "Escouade support" },
  { label: "12", caption: "Pays couverts" },
];

export default function RegisterClient() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const initialReferral = searchParams.get("ref") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferral);
  const [countryCode, setCountryCode] = useState("CI");
  const [countryName, setCountryName] = useState("Côte d'Ivoire");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");

  const disableSubmit = loading;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        if (!active) return;
        setServerStatus(res.ok ? "online" : "offline");
      } catch {
        if (active) setServerStatus("offline");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const statusBadge = useMemo(() => {
    if (serverStatus === "online") {
      return {
        label: "Serveur opérationnel",
        className: "text-emerald-300 border-emerald-400/40",
        icon: <ShieldCheck className="h-4 w-4" />,
      } as const;
    }
    if (serverStatus === "checking") {
      return {
        label: "Scan réseau",
        className: "text-amber-200 border-amber-300/40",
        icon: <Sparkles className="h-4 w-4" />,
      } as const;
    }
    return {
      label: "Serveur indisponible",
      className: "text-rose-300 border-rose-400/40",
      icon: <WifiOff className="h-4 w-4" />,
    } as const;
  }, [serverStatus]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (disableSubmit) return;
    setError(null);
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (cleanName.length === 0 || cleanName.length > 7) {
      setError("Choisis un pseudo entre 1 et 7 caractères.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await register({
        name: cleanName,
        email: cleanEmail,
        password,
        password_confirmation: passwordConfirmation,
        countryCode,
        countryName,
        referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      });
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05020d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(180,70,255,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.35),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.25),transparent_55%)]" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(135deg, rgba(5,1,13,0.95), rgba(4,7,29,0.85))" }} />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row">
        <section className="flex flex-1 flex-col justify-between gap-8 px-6 py-12 lg:px-10">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-emerald-200/80">Badboy club</p>
            <h1 className="mt-5 text-4xl font-black leading-tight md:text-5xl">
              Débloque le cockpit
              <br />
              premium builders.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-white/70">
              Crée un compte pour accéder aux offres exclusives, au parrainage, au cashback BD Wallet et aux services de
              conciergerie gaming.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <p className="text-3xl font-black">{stat.label}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/60">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <p className="text-sm font-semibold">Programme VIP multi-paliers</p>
            <p className="text-xs text-white/60 mt-1">
              Bronze &gt; Argent &gt; Or &gt; Diamant. Chaque palier débloque du cashback et des délais de livraison réduits.
            </p>
          </div>
        </section>

        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-[440px] lg:px-0">
          <div className="w-full rounded-[32px] border border-white/10 bg-black/45 p-8 backdrop-blur-xl shadow-[0_25px_80px_rgba(3,7,18,0.9)]">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${statusBadge.className}`}>
                {statusBadge.icon}
                {statusBadge.label}
              </span>
              <span>v3 onboarding</span>
            </div>

            <div className="mt-6 text-center">
              <h2 className="text-2xl font-semibold">Créer mon profil</h2>
              <p className="mt-2 text-sm text-white/60">Renseigne ton cockpit en moins d'une minute.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <label className="block text-sm">
                <span className="text-white/70">Pseudo (max 7)</span>
                <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    type="text"
                    maxLength={7}
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase())}
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="BADBOY"
                    required
                  />
                </div>
              </label>

              <label className="block text-sm">
                <span className="text-white/70">Email</span>
                <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="gamer@badboy.gg"
                    required
                  />
                </div>
              </label>

              <label className="block text-sm">
                <span className="text-white/70">Mot de passe</span>
                <div className="mt-1 flex items-center rounded-2xl border border-white/10 bg-white/5 px-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent px-2 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="rounded-xl border border-white/10 p-2 text-white/70"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block text-sm">
                <span className="text-white/70">Confirmation du mot de passe</span>
                <div className="mt-1 flex items-center rounded-2xl border border-white/10 bg-white/5 px-2">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    className="flex-1 bg-transparent px-2 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    className="rounded-xl border border-white/10 p-2 text-white/70"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block text-sm">
                <span className="text-white/70">Pays</span>
                <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      const selected = COUNTRY_OPTIONS.find((opt) => opt.code === e.target.value);
                      setCountryCode(e.target.value);
                      setCountryName(selected?.name ?? "");
                    }}
                    className="w-full bg-transparent text-sm text-white focus:outline-none"
                    required
                  >
                    {COUNTRY_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code} className="bg-black text-white">
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="block text-sm">
                <span className="text-white/70">Code parrain (optionnel)</span>
                <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="EX: A1B2C3D4"
                    maxLength={32}
                  />
                </div>
              </label>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                <p>• Le pseudo est utilisé pour ton badge public</p>
                <p>• Les informations pays sont obligatoires (anti-fraude)</p>
                <p>• Mot de passe: 8 caractères minimum</p>
              </div>

              {error && <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

              {serverStatus !== "online" && (
                <p className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                  {statusBadge.label}. Vérifie ta connexion ou contacte le support.
                </p>
              )}

              <button
                type="submit"
                disabled={disableSubmit}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-300 via-cyan-400 to-fuchsia-400 px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(16,185,129,0.35)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Création en cours..." : "Activer mon cockpit"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-white/60">
              Déjà membre ?{" "}
              <Link className="text-cyan-300 no-underline" href={`/auth/login?next=${encodeURIComponent(next)}`}>
                Reviens te connecter
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
