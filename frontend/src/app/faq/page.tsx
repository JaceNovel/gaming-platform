"use client";

import { useState } from "next";
import { ChevronDown } from "lucide-react";

type FAQItem = {
  id: number;
  question: string;
  answer: string;
  category: string;
};

const faqItems: FAQItem[] = [
  {
    id: 1,
    category: "Général",
    question: "Qu'est-ce que PRIME Gaming ?",
    answer:
      "PRIME Gaming est une plateforme gaming panafricaine qui permet aux joueurs d'acheter des comptes, des recharges de crédits et d'accéder à des services premium pour leurs jeux préférés.",
  },
  {
    id: 2,
    category: "Général",
    question: "Dans quels pays PRIME Gaming opère-t-il ?",
    answer:
      "PRIME Gaming opère principalement en Afrique de l'Ouest incluant la Côte d'Ivoire, le Ghana, le Sénégal et d'autres régions. Vérifiez votre disponibilité lors de la création du compte.",
  },
  {
    id: 3,
    category: "Compte",
    question: "Comment créer un compte PRIME Gaming ?",
    answer:
      "Visitez primegaming.space, cliquez sur 'S'inscrire', remplissez vos informations (email, mot de passe, téléphone). Confirmez votre email et vous êtes prêt à commencer !",
  },
  {
    id: 4,
    category: "Compte",
    question: "Quel âge minimum pour utiliser PRIME Gaming ?",
    answer: "Vous devez avoir 18 ans ou plus pour créer et utiliser un compte PRIME Gaming.",
  },
  {
    id: 5,
    category: "Compte",
    question: "Comment réinitialiser mon mot de passe ?",
    answer:
      "Cliquez sur 'Mot de passe oublié' sur la page de connexion, entrez votre email, et suivez les instructions dans l'email de réinitialisation reçu.",
  },
  {
    id: 6,
    category: "Paiements",
    question: "Quels modes de paiement acceptez-vous ?",
    answer:
      "Nous acceptons les virements bancaires, les porte-monnaie numériques (Mobile Money), et les services de paiement sécurisés (Fedapay, CinetPay) selon votre région.",
  },
  {
    id: 7,
    category: "Paiements",
    question: "Est-ce que mes informations de paiement sont sécurisées ?",
    answer:
      "Oui, nous utilisons le chiffrement SSL/TLS et traitons les paiements via des fournisseurs certifiés. Nous ne stockons jamais complètement vos données bancaires.",
  },
  {
    id: 8,
    category: "Paiements",
    question: "Puis-je recevoir un remboursement ?",
    answer:
      "Les remboursements sont traités au cas par cas. Contactez support@primegaming.space avec une justification. Les remboursements pour raison personnelle ne sont généralement pas accordés.",
  },
  {
    id: 9,
    category: "Jeux",
    question: "Quels jeux sont disponibles sur PRIME Gaming ?",
    answer:
      "Nous proposons des services pour Free Fire, Call of Duty, FIFA/EA Sports FC, Fortnite, PUBG et d'autres titres populaires. La disponibilité varie selon votre région.",
  },
  {
    id: 10,
    category: "Jeux",
    question: "Comment utiliser mon compte après l'achat ?",
    answer:
      "Après confirmation de paiement, vous recevrez vos identifiants. Connectez-vous au jeu et accédez à vos crédits/items achetés directement dans l'application du jeu.",
  },
  {
    id: 11,
    category: "Support",
    question: "Comment contacter le support client ?",
    answer:
      "Vous pouvez nous contacter via email (support@primegaming.space), le chat d'assistance en bas à droite du site, ou la page 'Nous Contacter'.",
  },
  {
    id: 12,
    category: "Support",
    question: "Quel est le délai de réponse du support ?",
    answer:
      "Nous essayons de répondre à tous les messages dans les 24 heures. Pendant les heures de pointe, le délai peut être plus long.",
  },
  {
    id: 13,
    category: "Sécurité",
    question: "Mon compte a été compromis. Que faire ?",
    answer:
      "Changez immédiatement votre mot de passe, vérifiez votre historique de paiement, et contactez le support. Nous pouvons désactiver votre compte temporairement si nécessaire.",
  },
  {
    id: 14,
    category: "Sécurité",
    question: "PRIME Gaming demande-t-il mon mot de passe du jeu ?",
    answer:
      "Non, nous ne demanderons jamais votre mot de passe du jeu. Nos représentants officiels ne feront jamais cette demande. Signalez toute tentative suspecte.",
  },
  {
    id: 15,
    category: "Technique",
    question: "Pourquoi ne puis-je pas accéder au site ?",
    answer:
      "Videz le cache de votre navigateur, désactivez les extensions VPN/proxy, ou essayez avec un autre navigateur. Si le problème persiste, contactez le support.",
  },
  {
    id: 16,
    category: "Technique",
    question: "L'application mobile fonctionne-t-elle hors ligne ?",
    answer:
      "L'app supporte certaines fonctionnalités hors ligne via cache. Cependant, les transactions nécessitent une connexion Internet active pour des raisons de sécurité.",
  },
];

const categories = ["Tous", ...Array.from(new Set(faqItems.map((item) => item.category)))];

export default function FAQ() {
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredItems = selectedCategory === "Tous"
    ? faqItems
    : faqItems.filter((item) => item.category === selectedCategory);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white">Questions Fréquemment Posées</h1>
        <p className="text-slate-400">
          Trouvez des réponses aux questions les plus courantes sur PRIME Gaming
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-12 justify-center">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              selectedCategory === category
                ? "bg-fuchsia-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* FAQ Items */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="border border-slate-700 rounded-lg overflow-hidden hover:border-fuchsia-500/50 transition-colors duration-200"
          >
            <button
              onClick={() => toggleExpand(item.id)}
              className="w-full px-6 py-4 bg-slate-800/50 hover:bg-slate-800 flex items-center justify-between transition-colors duration-200"
            >
              <span className="text-left font-semibold text-white">{item.question}</span>
              <ChevronDown
                className={`w-5 h-5 text-fuchsia-500 flex-shrink-0 ml-4 transition-transform duration-200 ${
                  expandedId === item.id ? "rotate-180" : ""
                }`}
              />
            </button>

            {expandedId === item.id && (
              <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700 text-slate-300">
                <p className="leading-relaxed">{item.answer}</p>
                {item.category && (
                  <div className="mt-3 text-xs text-slate-500">
                    <span className="inline-block px-2 py-1 bg-slate-800/50 rounded">{item.category}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact CTA */}
      <div className="mt-12 p-6 bg-gradient-to-r from-fuchsia-600/10 to-purple-600/10 border border-fuchsia-500/20 rounded-lg text-center">
        <p className="text-slate-300 mb-4">Vous n'avez pas trouvé votre réponse ?</p>
        <a
          href="/contact"
          className="inline-block px-6 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold rounded-lg transition-colors duration-200"
        >
          Nous Contacter
        </a>
      </div>
    </div>
  );
}
