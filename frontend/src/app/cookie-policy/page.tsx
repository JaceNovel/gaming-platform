import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique des Cookies - PRIME Gaming",
  description: "Politique des cookies et technologies de suivi de PRIME Gaming",
};

export default function CookiePolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-white">Politique des Cookies</h1>

      <div className="space-y-8 text-slate-300">
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">1. Qu'est-ce qu'un Cookie ?</h2>
          <p className="leading-relaxed">
            Un cookie est un petit fichier texte stocké sur votre appareil lorsque vous visitez notre site. Les cookies permettent à PRIME Gaming de reconnaître et de se souvenir de votre appareil lors de visites ultérieures.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">2. Types de Cookies que Nous Utilisons</h2>
          <p className="mb-4 leading-relaxed"><strong>Cookies Essentiels</strong></p>
          <p className="leading-relaxed ml-4 mb-4">
            Nécessaires pour le fonctionnement de la plateforme (authentification, sécurité, préférences de session).
          </p>

          <p className="mb-4 leading-relaxed"><strong>Cookies Analytiques</strong></p>
          <p className="leading-relaxed ml-4 mb-4">
            Utilisés pour comprendre comment vous utilisez notre site (Google Analytics, Firebase). Cela nous aide à améliorer l'expérience utilisateur.
          </p>

          <p className="mb-4 leading-relaxed"><strong>Cookies Fonctionnels</strong></p>
          <p className="leading-relaxed ml-4 mb-4">
            Maintiennent vos préférences et personnalisations (langue, thème, etc.).
          </p>

          <p className="mb-4 leading-relaxed"><strong>Cookies Publicitaires</strong></p>
          <p className="leading-relaxed ml-4">
            Utilisés pour afficher des annonces pertinentes basées sur votre comportement de navigation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">3. Technologues de Suivi Similaires</h2>
          <p className="leading-relaxed">
            Au-delà des cookies, nous utilisons :
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
            <li><strong>Service Worker :</strong> Pour la mise en cache hors ligne et les notifications push</li>
            <li><strong>Local Storage :</strong> Pour stocker les préférences utilisateur et les données de session</li>
            <li><strong>Firebase Analytics :</strong> Pour le suivi des événements et crashs sur mobile</li>
            <li><strong>Tags de Pixel :</strong> Pour mesurer la conversion et l'engagement</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">4. Comment Contrôler les Cookies</h2>
          <p className="mb-4 leading-relaxed">Vous pouvez contrôler les cookies via :</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Paramètres du Navigateur :</strong> Bloquez les cookies tiers, supprimez les cookies existants</li>
            <li><strong>Paramètres de suivi de l'appareil :</strong> Activez "Do Not Track" (DNT)</li>
            <li><strong>Préférences PRIME Gaming :</strong> Gérez les notifications et la collecte de données via votre compte</li>
            <li><strong>Outils tiers :</strong> Utilisez des services comme DuckDuckGo pour limiter le suivi</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">5. Consentement aux Cookies</h2>
          <p className="leading-relaxed">
            Con conformément aux lois sur la confidentialité (RGPD, LSSI), nous collectons votre consentement explicite pour les cookies non-essentiels. Vous devez autoriser l'utilisation de cookies analytiques et publicitaires avant qu'ils ne soient actifs.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">6. Partenaires Tiers et Cookies</h2>
          <p className="leading-relaxed">
            PRIME Gaming collabore avec des services tiers qui peuvent placer leurs propres cookies :
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
            <li><strong>Google Analytics :</strong> Pour l'analyse du comportement utilisateur</li>
            <li><strong>Firebase :</strong> Pour les crashs, logs, et Remote Config</li>
            <li><strong>Providers de Paiement :</strong> Pour la sécurité des transactions (Fedapay, CinetPay)</li>
            <li><strong>Tidio :</strong> Pour le chat d'assistance client</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">7. Combien de Temps Durent les Cookies ?</h2>
          <p className="mb-4 leading-relaxed">Les cookies ont des durées variables :</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Cookies de Session :</strong> Supprimés à la fermeture du navigateur</li>
            <li><strong>Cookies Persistants :</strong> Conservés jusqu'à 1-2 ans selon le type</li>
            <li><strong>Cookies de Suivi :</strong> Généralement conservés 90-365 jours</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">8. Sécurité des Données via Cookies</h2>
          <p className="leading-relaxed">
            Les cookies sensibles (authentification) sont marqués comme "Secure" et "HttpOnly" pour réduire les risques de vol XSS. Les données de session sont chiffrées et stockées sûrement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">9. Modifications de cette Politique</h2>
          <p className="leading-relaxed">
            Cette Politique des Cookies peut être mise à jour à tout moment. Les modifications sont effectives immédiatement après publication.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">10. Questions ?</h2>
          <p className="leading-relaxed">
            Pour toute question sur notre utilisation des cookies :
          </p>
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p><strong>Email :</strong> support@primegaming.space</p>
          </div>
        </section>

        <div className="mt-12 pt-8 border-t border-slate-700 text-sm text-slate-400">
          <p>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>
        </div>
      </div>
    </div>
  );
}
