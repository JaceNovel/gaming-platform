"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isAdminRole } from "@/components/auth/adminRoles";
import { API_BASE } from "@/lib/config";

const HERO_FRAGMENTS = [
  {
    title: "Transactions instantanées",
    caption: "Paiements protégés CinetPay + BD Wallet.",
  },
  {
    title: "Support 24/7",
    caption: "Passe en live avec l'équipe BADBOYSHOP.",
  },
  {
    title: "Accès multi-jeux",
    caption: "Free Fire, MLBB, CODM et + encore.",
  },
];

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=900&q=80",
];

const hasApiEnv = Boolean(process.env.NEXT_PUBLIC_API_URL);

export default function LoginClient() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">(
    hasApiEnv ? "checking" : "offline",
  );

  const disableSubmit = loading || serverStatus !== "online";

  useEffect(() => {
    let active = true;
    if (!hasApiEnv) return;
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
        label: "Vérification du tunnel",
        className: "text-amber-200 border-amber-300/40",
        icon: <Sparkles className="h-4 w-4" />,
      } as const;
    }
    return {
      label: hasApiEnv ? "Serveur indisponible" : "API non configurée",
      className: "text-rose-300 border-rose-400/40",
      icon: <WifiOff className="h-4 w-4" />,
    } as const;
  }, [serverStatus]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (disableSubmit) {
      setError("Connexion au serveur impossible pour le moment.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const authenticatedUser = await login(email.trim(), password);
      const requestedNext = next.startsWith("/") ? next : "/";
      if (isAdminRole(authenticatedUser.role)) {
        router.replace("/admin/dashboard");
        return;
      }
      const fallback = requestedNext.startsWith("/admin") ? "/" : requestedNext;
      router.replace(fallback);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02010a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(79,70,229,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.35),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.25),transparent_55%)]" />
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(120deg, rgba(3,7,18,0.95), rgba(10,6,25,0.8))" }} />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row">
        <section className="flex flex-1 flex-col justify-between gap-10 px-6 py-12 lg:px-10">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-cyan-200/80">BADBOYSHOP</p>
            <h1 className="mt-5 text-4xl font-black leading-tight md:text-5xl">
              Pilote tes recharges
              <br />
              depuis un cockpit sécurisé.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-white/70">
              Comptes, top-up internationaux et services premium réunis dans une seule interface. Anti-fraude, suivi en
              direct et notifications temps réel.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {HERO_IMAGES.map((src, index) => (
              <div
                key={src}
                className="relative h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 text-xs uppercase tracking-[0.3em] text-white/70">{`#0${index + 1}`}</div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="grid gap-4 md:grid-cols-3">
              {HERO_FRAGMENTS.map((fragment) => (
                <div key={fragment.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold">{fragment.title}</p>
                  <p className="text-xs text-white/60 mt-1">{fragment.caption}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-[420px] lg:px-0">
          <div className="w-full rounded-[32px] border border-white/10 bg-black/40 p-8 backdrop-blur-xl shadow-[0_25px_80px_rgba(2,4,24,0.9)]">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${statusBadge.className}`}>
                {statusBadge.icon}
                {statusBadge.label}
              </span>
              <span>v3 cockpit</span>
            </div>

            <div className="mt-6 text-center">
              <h2 className="text-2xl font-semibold">Connexion sécurisée</h2>
              <p className="mt-2 text-sm text-white/60">Identifie-toi pour continuer tes opérations.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <label className="block text-sm">
                <span className="text-white/70">Email</span>
                <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-cyan-300">
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
                <div className="mt-1 flex items-center rounded-2xl border border-white/10 bg-white/5 px-2 focus-within:border-cyan-300">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent px-2 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="Mot de passe"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="rounded-xl border border-white/10 p-2 text-white/70 hover:text-white"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Double authentification bientôt</span>
                <Link href="/support" className="text-cyan-300 hover:text-cyan-200">
                  Besoin d'aide ?
                </Link>
              </div>

              {error && <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

              {serverStatus !== "online" && (
                <p className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                  {statusBadge.label}. Vérifie ta connexion ou réessaie plus tard.
                </p>
              )}

              <button
                type="submit"
                disabled={disableSubmit}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-orange-400 px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(14,165,233,0.35)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Connexion en cours..." : serverStatus === "online" ? "Entrer dans le cockpit" : "Serveur indisponible"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-white/60">
              Pas encore de compte ? {" "}
              <Link className="text-cyan-300" href={`/auth/register?next=${encodeURIComponent(next)}`}>
                Crée ton profil BADBOY
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
