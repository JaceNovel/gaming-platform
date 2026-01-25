"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { isAdminRole } from "@/components/auth/adminRoles";

export default function LoginClient() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-[100dvh] bg-gray-900 text-white grid lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col justify-between gap-10 p-12 xl:p-20 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(6, 10, 20, 0.9), rgba(6, 10, 20, 0.55)), url(https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/a0/cb/44/a0cb447b-2dfb-69c7-5059-c4216307956c/196835967394.jpg/1200x1200bf-60.jpg)",
        }}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">BADBOYSHOP</p>
          <h1 className="text-4xl font-black mt-3">Connecte-toi au gaming premium.</h1>
          <p className="text-sm text-white/60 mt-4 max-w-md">
            Achats instantanés, recharges internationales et services premium. Vitesse mobile, confort desktop.
          </p>
        </div>
        <div className="gameplay-reel">
          <div
            className="gameplay-frame"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1400&auto=format&fit=crop)",
            }}
          />
          <div
            className="gameplay-frame"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1400&auto=format&fit=crop)",
            }}
          />
          <div
            className="gameplay-frame"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1511882150382-421056c89033?q=80&w=1400&auto=format&fit=crop)",
            }}
          />
          <div className="gameplay-overlay" />
          <div className="gameplay-glow" />
        </div>
        <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-md">
          <p className="text-sm text-white/70">"Badboyshop m'a livré mes recharges en 3 minutes."</p>
          <p className="text-xs text-white/50 mt-3">— Joueur Pro</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-white/10">
          <h1 className="text-2xl font-bold mb-4 text-center">Connexion</h1>
          <p className="text-sm text-white/60 mb-6 text-center">Connecte-toi pour acheter, chatter ou t'abonner.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 focus:outline-none focus:border-cyan-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 focus:outline-none focus:border-cyan-300"
                required
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 transition rounded-lg py-2 font-semibold"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="text-sm text-white/60 mt-4 text-center">
            Pas encore de compte ?{" "}
            <Link className="text-cyan-300" href={`/auth/register?next=${encodeURIComponent(next)}`}>
              Crée un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
