"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SiteLanguage = "en" | "fr";

type TranslationKey = keyof typeof translations.en;

type TranslateValues = Record<string, string | number>;

type LanguageContextValue = {
  language: SiteLanguage;
  hasExplicitChoice: boolean;
  setLanguage: (language: SiteLanguage) => void;
  t: (key: TranslationKey, values?: TranslateValues) => string;
  formatNumber: (value: number) => string;
  formatDateTime: (value: string | number | Date) => string;
};

const STORAGE_KEY = "prime.site.language";

const translations = {
  en: {
    "language.english": "English",
    "language.french": "French",
    "language.badge": "Language",
    "language.modal.title": "Choose your site language",
    "language.modal.subtitle": "Pick the language you want to use across PRIME Gaming. You can change it later at any time.",
    "language.modal.default": "Default",
    "language.modal.continue.en": "Continue in English",
    "language.modal.continue.fr": "Continue in French",
    "language.switcher.aria": "Change site language",
    "header.nav.recharge": "Top-ups",
    "header.nav.subscription": "Subscriptions",
    "header.nav.marketplace": "Gaming Accounts",
    "header.nav.accessories": "Accessories",
    "header.emptyGames": "No games available yet.",
    "header.help": "Support 24/7",
    "header.wallet": "DB Wallet",
    "header.profile": "My Profile",
    "header.offer": "View offer",
    "header.notifications": "Notifications",
    "header.inbox": "Inbox",
    "header.close": "Close",
    "header.emptyNotifications": "No notifications right now.",
    "header.emptyInbox": "No messages right now.",
    "header.vip.update": "Upgrade plan",
    "header.vip.platinum": "VIP Platinum 💎",
    "header.vip.bronze": "VIP Bronze 🥉",
    "footer.about": "About",
    "footer.aboutText": "PRIME Gaming - The pan-African gaming platform for your accounts, top-ups, and premium services.",
    "footer.legal": "Legal",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",
    "footer.cookies": "Cookie Policy",
    "footer.support": "Support",
    "footer.contact": "Contact us",
    "footer.faq": "FAQ",
    "footer.social": "Social media",
    "footer.soonTwitter": "Twitter - Coming soon",
    "footer.soonDiscord": "Discord - Coming soon",
    "footer.soonInstagram": "Instagram - Coming soon",
    "footer.soonTikTok": "TikTok - Coming soon",
    "footer.soonYoutube": "YouTube - Coming soon",
    "footer.rights": "All rights reserved.",
    "footer.shortPrivacy": "Privacy",
    "footer.shortTerms": "Terms",
    "bottom.home": "Home",
    "bottom.category": "Categories",
    "bottom.premium": "Premium",
    "bottom.help": "Help",
    "bottom.profile": "Profile",
    "android.badge": "Android",
    "android.title": "Download the PRIME Gaming app",
    "android.close": "Close dialog",
    "android.description": "Install the Android app for a smoother experience, native notifications, and direct access to your DB Wallet.",
    "android.download": "Download app",
    "android.dismiss": "Don't show this pop-up again",
    "android.note": "If the app is already installed on this phone, this window will hide automatically as soon as the browser reports it.",
    "cart.open": "Open cart",
    "cart.close": "Close cart",
    "cart.title": "Cart",
    "cart.none": "No item",
    "cart.item.one": "{count} item",
    "cart.item.other": "{count} items",
    "cart.autoOff": "auto-off",
    "cart.empty": "Your cart is empty.",
    "cart.remove": "Remove",
    "cart.quantity": "Quantity",
    "cart.decrease": "Decrease",
    "cart.increase": "Increase",
    "cart.total": "Total",
    "cart.view": "View cart",
    "cart.checkout": "Checkout",
    "home.buy": "Buy",
    "home.addToCart": "Add to cart",
    "home.premiumProduct": "Premium product",
    "home.welcome": "Welcome back {name}",
    "home.title": "The elite gaming platform",
    "home.subtitle": "Gaming without waiting, without risk, without stress.",
    "home.tournamentPlanning": "Tournament schedule",
    "home.tournaments": "Tournaments",
    "home.joinTournament": "Join tournament",
    "home.viewPlanning": "View schedule",
    "home.accountsSold": "Accounts sold",
    "home.rechargesDone": "Top-ups completed",
    "home.premiumMembers": "Premium members",
    "home.guidesActive": "Active guides",
    "home.popularTitle": "Most popular products",
    "home.popularSuffix": "right now",
    "home.more": "See more →",
  },
  fr: {
    "language.english": "English",
    "language.french": "Français",
    "language.badge": "Langue",
    "language.modal.title": "Choisis la langue du site",
    "language.modal.subtitle": "Sélectionne la langue que tu veux utiliser sur PRIME Gaming. Tu peux la modifier plus tard à tout moment.",
    "language.modal.default": "Par défaut",
    "language.modal.continue.en": "Continuer en anglais",
    "language.modal.continue.fr": "Continuer en français",
    "language.switcher.aria": "Changer la langue du site",
    "header.nav.recharge": "Recharges",
    "header.nav.subscription": "Abonnements",
    "header.nav.marketplace": "Comptes de jeu",
    "header.nav.accessories": "Accessoires",
    "header.emptyGames": "Aucun jeu pour le moment.",
    "header.help": "7j/7",
    "header.wallet": "DB Wallet",
    "header.profile": "Mon Profil",
    "header.offer": "Voir l'offre",
    "header.notifications": "Notifications",
    "header.inbox": "Boîte mail",
    "header.close": "Fermer",
    "header.emptyNotifications": "Aucune notification pour le moment.",
    "header.emptyInbox": "Aucun message pour le moment.",
    "header.vip.update": "Changer de plan",
    "header.vip.platinum": "VIP Platine 💎",
    "header.vip.bronze": "VIP Bronze 🥉",
    "footer.about": "À propos",
    "footer.aboutText": "PRIME Gaming - La plateforme gaming panafricaine pour tes comptes, recharges et services premium.",
    "footer.legal": "Légal",
    "footer.privacy": "Politique de Confidentialité",
    "footer.terms": "Conditions d'Utilisation",
    "footer.cookies": "Politique des Cookies",
    "footer.support": "Support",
    "footer.contact": "Nous Contacter",
    "footer.faq": "FAQ",
    "footer.social": "Réseaux Sociaux",
    "footer.soonTwitter": "Twitter - Bientôt disponible",
    "footer.soonDiscord": "Discord - Bientôt disponible",
    "footer.soonInstagram": "Instagram - Bientôt disponible",
    "footer.soonTikTok": "TikTok - Bientôt disponible",
    "footer.soonYoutube": "YouTube - Bientôt disponible",
    "footer.rights": "Tous droits réservés.",
    "footer.shortPrivacy": "Confidentialité",
    "footer.shortTerms": "CGU",
    "bottom.home": "Accueil",
    "bottom.category": "Catégorie",
    "bottom.premium": "Premium",
    "bottom.help": "Aide",
    "bottom.profile": "Profil",
    "android.badge": "Android",
    "android.title": "Télécharge l'application PRIME Gaming",
    "android.close": "Fermer la fenêtre",
    "android.description": "Installe l'application Android pour profiter d'une expérience plus fluide, des notifications natives et d'un accès direct à ton DB Wallet.",
    "android.download": "Télécharger l'application",
    "android.dismiss": "Ne plus recevoir ce pop-up",
    "android.note": "Si l'application est déjà installée sur ce téléphone, cette fenêtre se masquera automatiquement dès que la détection navigateur la remonte.",
    "cart.open": "Ouvrir le panier",
    "cart.close": "Fermer le panier",
    "cart.title": "Panier",
    "cart.none": "Aucun article",
    "cart.item.one": "{count} article",
    "cart.item.other": "{count} articles",
    "cart.autoOff": "auto-off",
    "cart.empty": "Ton panier est vide.",
    "cart.remove": "Retirer",
    "cart.quantity": "Quantité",
    "cart.decrease": "Diminuer",
    "cart.increase": "Augmenter",
    "cart.total": "Total",
    "cart.view": "Voir panier",
    "cart.checkout": "Commander",
    "home.buy": "Acheter",
    "home.addToCart": "Ajouter au panier",
    "home.premiumProduct": "Produit premium",
    "home.welcome": "Bon retour {name}",
    "home.title": "La plateforme gaming d’élite",
    "home.subtitle": "Le gaming sans attente, sans risque, sans stress.",
    "home.tournamentPlanning": "Planning Tournois",
    "home.tournaments": "Tournois",
    "home.joinTournament": "Participer au tournois",
    "home.viewPlanning": "Voir planning",
    "home.accountsSold": "Comptes vendus",
    "home.rechargesDone": "Recharges effectuées",
    "home.premiumMembers": "Membres premium",
    "home.guidesActive": "Guides actives",
    "home.popularTitle": "Produits",
    "home.popularSuffix": "les plus populaires",
    "home.more": "Voir plus →",
  },
} as const;

const LanguageContext = createContext<LanguageContextValue | null>(null);

function replaceTemplate(input: string, values?: TranslateValues) {
  if (!values) return input;
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), input);
}

function LanguagePicker({
  selected,
  onSelect,
  onConfirm,
}: {
  selected: SiteLanguage;
  onSelect: (language: SiteLanguage) => void;
  onConfirm: () => void;
}) {
  const modalCopy = selected === "fr" ? translations.fr : translations.en;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/78 px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(110,231,255,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_34%),linear-gradient(135deg,rgba(4,8,20,0.98),rgba(8,14,28,0.96))] text-white shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
        <div className="border-b border-white/10 px-5 py-5 sm:px-7">
          <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/70">{modalCopy["language.badge"]}</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{modalCopy["language.modal.title"]}</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/72 sm:text-base">
            {modalCopy["language.modal.subtitle"]}
          </p>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-7">
          {([
            { code: "en", title: translations.en["language.english"], note: modalCopy["language.modal.default"] },
            { code: "fr", title: translations.fr["language.french"], note: "" },
          ] as const).map((option) => {
            const active = selected === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => onSelect(option.code)}
                className={
                  "rounded-[24px] border px-4 py-4 text-left transition sm:px-5 " +
                  (active
                    ? "border-cyan-300/55 bg-cyan-300/12 shadow-[0_18px_45px_rgba(34,211,238,0.14)]"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-white">{option.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.28em] text-white/45">{option.code.toUpperCase()}</div>
                  </div>
                  {option.note ? (
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                      {option.note}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex w-full items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#6ee7ff_0%,#67e8f9_32%,#f4ce6a_100%)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_50px_rgba(110,231,255,0.25)] transition hover:brightness-105"
          >
            {selected === "fr" ? modalCopy["language.modal.continue.fr"] : modalCopy["language.modal.continue.en"]}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>("en");
  const [draftLanguage, setDraftLanguage] = useState<SiteLanguage>("en");
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasExplicitChoice, setHasExplicitChoice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    const nextLanguage: SiteLanguage = stored === "fr" || stored === "en" ? stored : "en";

    setLanguageState(nextLanguage);
    setDraftLanguage(nextLanguage);
    setHasExplicitChoice(stored === "fr" || stored === "en");
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: SiteLanguage) => {
    setLanguageState(nextLanguage);
    setDraftLanguage(nextLanguage);
    setHasExplicitChoice(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const locale = language === "fr" ? "fr-FR" : "en-US";
    const currentTranslations = translations[language];

    return {
      language,
      hasExplicitChoice,
      setLanguage,
      t: (key, values) => replaceTemplate(currentTranslations[key], values),
      formatNumber: (value) => new Intl.NumberFormat(locale).format(value),
      formatDateTime: (value) => new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value)),
    };
  }, [hasExplicitChoice, language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
      {isHydrated && !hasExplicitChoice ? (
        <LanguagePicker
          selected={draftLanguage}
          onSelect={(nextLanguage) => {
            setDraftLanguage(nextLanguage);
            setLanguageState(nextLanguage);
          }}
          onConfirm={() => setLanguage(draftLanguage)}
        />
      ) : null}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}