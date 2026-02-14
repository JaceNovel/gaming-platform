import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'Utilisation - PRIME Gaming",
  description: "Conditions d'utilisation et contrat d'usage de PRIME Gaming",
};

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-white">Conditions d'Utilisation</h1>

      <div className="space-y-8 text-slate-300">
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">1. Acceptation des Conditions</h2>
          <p className="leading-relaxed">
            En accédant et en utilisant PRIME Gaming, vous acceptez d'être lié par ces Conditions d'Utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">2. Conditions d'Utilisation</h2>
          <p className="mb-4 leading-relaxed">Vous acceptez de :</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Utiliser la plateforme conformément à la loi applicable</li>
            <li>Ne pas engager d'activités frauduleuses ou trompeuses</li>
            <li>Respecter les droits de propriété intellectuelle</li>
            <li>Ne pas harceler, menacer ou intimider d'autres utilisateurs</li>
            <li>Ne pas tenter d'accéder à des zones non autorisées</li>
            <li>Fournir des informations exactes et à jour</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">3. Comptes Utilisateur</h2>
          <p className="mb-4 leading-relaxed">
            Vous êtes responsable de maintenir la confidentialité de votre mot de passe et de toutes les activités sous votre compte. Vous devez :
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Créer un compte avec des informations véridiques</li>
            <li>Être responsable de toutes les activités sous votre compte</li>
            <li>Notifier immédiatement en cas d'accès non autorisé</li>
            <li>Respecter l'âge minimum requis (18+ ans)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">4. Recharges et Paiements</h2>
          <p className="mb-4 leading-relaxed">
            Tous les achats et recharges sont définitifs sauf erreur système :
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Les prix sont en devises locales (XOF, GHS, etc.)</li>
            <li>Les frais de transaction sont en responsabilité du fournisseur</li>
            <li>Les remboursements nécessitent une justification</li>
            <li>Pas de cashback ou crédit pour raison personnelle</li>
            <li>PRIME Gaming n'est pas responsable des erreurs de paiement de l'opérateur</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">5. Limitation de Responsabilité</h2>
          <p className="leading-relaxed">
            PRIME Gaming n'est pas responsable pour :
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
            <li>Les interruptions de service ou temps d'arrêt</li>
            <li>La perte de données ou dommages indirects</li>
            <li>Les actions des fournisseurs de jeux partenaires</li>
            <li>Les problèmes d'opérateurs telecom tiers</li>
            <li>Les incompatibilités de compte ou appareil</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">6. Propriété Intellectuelle</h2>
          <p className="leading-relaxed">
            Tous les contenus, logos, designs, et codes de PRIME Gaming sont protégés par les droits d'auteur. Vous n'avez pas le droit de reproduire, modifier, ou distribuer sans permission explicite.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">7. Contenu Utilisateur</h2>
          <p className="leading-relaxed">
            Vous conservez tous les droits sur le contenu que vous créez. En postant, vous accordez à PRIME Gaming une licence pour l'utiliser à des fins opérationnelles et marketing.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">8. Suspension et Résiliation</h2>
          <p className="leading-relaxed">
            Nous nous réservons le droit de suspendre ou résilier votre compte en cas de violation de ces conditions, fraude, ou activités illégales sans avertissement préalable.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">9. Modifications des Conditions</h2>
          <p className="leading-relaxed">
            PRIME Gaming peut modifier ces conditions à tout moment. Les modifications sont effectifs immédiatement après publication. L'utilisation continue signifie votre acceptation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">10. Droit Applicable</h2>
          <p className="leading-relaxed">
            Ces Conditions d'Utilisation sont régies par les lois applicables en Afrique de l'Ouest (notamment la Côte d'Ivoire, le Ghana, le Sénégal). Tout litige sera résolu par arbitrage ou médiation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">11. Contact</h2>
          <p className="leading-relaxed">
            Pour toute question ou dispute concernant ces conditions :
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
