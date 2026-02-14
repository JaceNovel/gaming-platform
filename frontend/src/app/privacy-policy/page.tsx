import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité - PRIME Gaming",
  description: "Politique de confidentialité et protection des données de PRIME Gaming",
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-white">Politique de Confidentialité</h1>

      <div className="space-y-8 text-slate-300">
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">1. Introduction</h2>
          <p className="leading-relaxed">
            PRIME Gaming ("nous", "notre", ou "nos") est engagée à protéger votre vie privée. Cette Politique de Confidentialité explique comment nous collectons, utilisons, divulguons et sauvegarder vos informations lorsque vous utilisez notre plateforme.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">2. Informations que Nous Collectons</h2>
          <p className="mb-4 leading-relaxed">Nous collectons les types d'informations suivants :</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Informations de compte (nom, email, mot de passe)</li>
            <li>Informations de paiement (limitées - traitées via tiers sécurisé)</li>
            <li>Données de jeu et préférences d'achat</li>
            <li>Informations d'appareil (type, OS, version de l'app)</li>
            <li>Données d'utilisation et logs d'accès</li>
            <li>Localisation approximative (via IP, consentement requis)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">3. Comment Nous Utilisons Vos Données</h2>
          <p className="mb-4 leading-relaxed">Nous utilisons vos informations pour :</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Fournir et maintenir notre plateforme</li>
            <li>Traiter les transactions et les recharges</li>
            <li>Envoyer des communications (notifications, offres promotionnelles)</li>
            <li>Améliorer nos services et expérience utilisateur</li>
            <li>Détecter et prévenir les fraudes</li>
            <li>Respecter les obligations légales</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">4. Partage de Vos Données</h2>
          <p className="leading-relaxed">
            Nous ne vendons pas vos données personnelles. Nous partageons les informations uniquement avec :
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
            <li>Prestataires de services essentiels (paiement, hébergement)</li>
            <li>Autorités légales si requis par la loi</li>
            <li>Partenaires de jeu pour l'authentification de compte</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">5. Sécurité des Données</h2>
          <p className="leading-relaxed">
            Nous utilisons le chiffrement SSL/TLS et d'autres mesures de sécurité pour protéger vos données. Cependant, aucune transmission sur Internet n'est 100% sécurisée. Nous ne pouvons garantir la sécurité absolue.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">6. Vos Droits</h2>
          <p className="mb-4 leading-relaxed">Vous avez le droit de :</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Accéder à vos données personnelles</li>
            <li>Corriger les informations inexactes</li>
            <li>Supprimer votre compte et données</li>
            <li>Refuser les communications marketing</li>
            <li>Demander une traçabilité de vos données</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">7. Cookies et Suivi</h2>
          <p className="leading-relaxed">
            Nous utilisons les cookies et technologies similaires pour améliorer votre expérience. Vous pouvez contrôler les cookies via les paramètres de votre navigateur. Consultez notre Politique des Cookies pour plus de détails.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">8. Modifications de cette Politique</h2>
          <p className="leading-relaxed">
            Nous pouvons mettre à jour cette Politique de Confidentialité à tout moment. Les modifications entrent en vigueur immédiatement après publication. L'utilisation continue de notre plateforme signifie votre acceptation des modifications.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">9. Nous Contacter</h2>
          <p className="leading-relaxed">
            Pour toute question concernant cette Politique de Confidentialité, veuillez nous contacter à :
          </p>
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p><strong>Email :</strong> support@primegaming.space</p>
            <p className="mt-2"><strong>Adresse :</strong> PRIME Gaming, Plateforme Gaming Panafricaine</p>
          </div>
        </section>

        <div className="mt-12 pt-8 border-t border-slate-700 text-sm text-slate-400">
          <p>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>
        </div>
      </div>
    </div>
  );
}
