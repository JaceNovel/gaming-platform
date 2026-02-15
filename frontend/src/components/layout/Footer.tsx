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
                href="#"
                aria-label="Twitter/X"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="Twitter - Bientôt disponible"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-200"
                  fill="currentColor"
                >
                  <path d="M18.244 2H21.552L14.33 10.244L22.828 22H16.172L10.96 14.916L4.76 22H1.448L9.164 13.184L1 2H7.828L12.524 8.38L18.244 2Z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Discord"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="Discord - Bientôt disponible"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-200"
                  fill="currentColor"
                >
                  <path d="M20.317 4.369A19.79 19.79 0 0 0 15.788 3a12.69 12.69 0 0 0-.62 1.27 18.23 18.23 0 0 0-5.336 0A12.32 12.32 0 0 0 9.21 3 19.74 19.74 0 0 0 4.682 4.37C2.2 8.07 1.53 11.67 1.86 15.22c1.64 1.22 3.23 1.96 4.79 2.45.39-.54.74-1.11 1.04-1.72-.57-.21-1.11-.47-1.64-.77.14-.1.28-.21.41-.32 3.16 1.48 6.6 1.48 9.73 0 .14.11.28.22.42.32-.53.3-1.07.56-1.64.77.3.61.65 1.18 1.04 1.72 1.56-.49 3.15-1.23 4.79-2.45.39-4.12-.66-7.69-2.44-10.85ZM8.02 13.89c-.94 0-1.71-.87-1.71-1.94 0-1.08.75-1.95 1.71-1.95.95 0 1.72.87 1.71 1.95 0 1.07-.76 1.94-1.71 1.94Zm7.96 0c-.94 0-1.71-.87-1.71-1.94 0-1.08.75-1.95 1.71-1.95.95 0 1.72.87 1.71 1.95 0 1.07-.75 1.94-1.71 1.94Z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Instagram"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="Instagram - Bientôt disponible"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-200"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="TikTok"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="TikTok - Bientôt disponible"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-200"
                  fill="currentColor"
                >
                  <path d="M19.59 7.35a6.9 6.9 0 0 1-4.57-2.93V15.2a5.6 5.6 0 1 1-4.78-5.54v2.99a2.6 2.6 0 1 0 1.78 2.47V2h3.05c.27 2.1 1.58 3.91 3.52 4.86v2.49Z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="YouTube"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-fuchsia-600/20 hover:border-fuchsia-500/50 border border-slate-700 flex items-center justify-center transition-colors duration-200 text-xs font-bold"
                title="YouTube - Bientôt disponible"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-200"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="7" width="18" height="10" rx="3" />
                  <path d="M11 10l4 2-4 2z" fill="currentColor" stroke="none" />
                </svg>
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
