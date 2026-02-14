"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Don't show footer on auth pages
  if (pathname?.startsWith("/auth/")) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-gradient-to-b from-slate-950 to-slate-900 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              À propos
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              PRIME Gaming - La plateforme gaming panafricaine pour tes comptes, recharges et services premium.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Légal
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-xs sm:text-sm text-slate-400 hover:text-fuchsia-500 transition-colors duration-200"
                >
                  Politique de Confidentialité
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-of-service"
                  className="text-xs sm:text-sm text-slate-400 hover:text-fuchsia-500 transition-colors duration-200"
                >
                  Conditions d'Utilisation
                </Link>
              </li>
              <li>
                <Link
                  href="/cookie-policy"
                  className="text-xs sm:text-sm text-slate-400 hover:text-fuchsia-500 transition-colors duration-200"
                >
                  Politique des Cookies
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Support
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:support@primegaming.space"
                  className="text-xs sm:text-sm text-slate-400 hover:text-fuchsia-500 transition-colors duration-200 break-all"
                >
                  support@primegaming.space
                </a>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-xs sm:text-sm text-slate-400 hover:text-fuchsia-500 transition-colors duration-200"
                >
                  Nous Contacter
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-xs sm:text-sm text-slate-400 hover:text-fuchsia-500 transition-colors duration-200"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Socials (placeholder) */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Réseaux Sociaux
            </h3>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://x.com"
                aria-label="Twitter/X"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="Twitter - Bientôt disponible"
              >
                𝕏
              </a>
              <a
                href="https://discord.com"
                aria-label="Discord"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="Discord - Bientôt disponible"
              >
                D
              </a>
              <a
                href="https://instagram.com"
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="Instagram - Bientôt disponible"
              >
                📷
              </a>
              <a
                href="https://tiktok.com"
                aria-label="TikTok"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="TikTok - Bientôt disponible"
              >
                🎵
              </a>
              <a
                href="https://youtube.com"
                aria-label="YouTube"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="YouTube - Bientôt disponible"
              >
                ▶
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 pt-8" />

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs sm:text-sm text-slate-400">
          <div>
            © {new Date().getFullYear()} PRIME Gaming. Tous droits réservés.
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end gap-6">
            <Link
              href="/privacy-policy"
              className="hover:text-fuchsia-500 transition-colors duration-200"
            >
              Confidentialité
            </Link>
            <Link
              href="/terms-of-service"
              className="hover:text-fuchsia-500 transition-colors duration-200"
            >
              CGU
            </Link>
            <span>Version 1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
