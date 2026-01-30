export type HelpTopic = {
  slug: string;
  title: string;
  summary: string;
  bullets: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: "paiement",
    title: "Paiement & Validation",
    summary: "Comprendre la validation du paiement et les retours après paiement.",
    bullets: [
      "Après paiement, la confirmation peut prendre quelques secondes.",
      "Si vous êtes redirigé, laissez la page ouverte le temps de la validation.",
      "En cas de souci, ouvrez le support (bulle en bas à droite).",
    ],
  },
  {
    slug: "wallet",
    title: "Wallet (solde, recharge, paiement)",
    summary: "Recharger le wallet, vérifier le solde et payer avec le wallet.",
    bullets: [
      "Une recharge wallet créditée apparaît dans l'historique.",
      "Vous pouvez payer avec le wallet si le solde est suffisant.",
      "Si le solde n'apparaît pas tout de suite, revenez sur votre profil et réessayez après quelques secondes.",
    ],
  },
  {
    slug: "codes",
    title: "Codes (recharges)",
    summary: "Où trouver vos codes et comment les copier.",
    bullets: [
      "Après paiement, vos codes apparaissent dans Profil → Mes codes.",
      "Vous pouvez copier un code (ou tout copier) et renvoyer par email.",
      "Si vous ne voyez rien tout de suite: attendez 10–30s puis Actualiser.",
      "En cas de rupture, la commande passe en attente (stock) et vous serez notifié.",
    ],
  },
  {
    slug: "comptes",
    title: "Comptes (livraison)",
    summary: "Préparation et livraison des comptes achetés.",
    bullets: [
      "Après paiement, nous préparons le compte.",
      "Les identifiants sont envoyés par email (vérifiez vos spams).",
      "Pour toute question, contactez le support.",
    ],
  },
  {
    slug: "abonnements",
    title: "Abonnements (VIP / subscriptions)",
    summary: "Activation et délais pour les abonnements.",
    bullets: [
      "Après paiement, votre demande est en attente pendant l'activation.",
      "Vous serez notifié quand c'est terminé.",
      "En cas de blocage, contactez le support.",
    ],
  },
  {
    slug: "recharge-direct",
    title: "Recharge Direct (support)",
    summary: "Recharge Direct ouvre le chat support pour une prise en charge rapide.",
    bullets: [
      "Recharge Direct ouvre la bulle de chat (en bas à droite).",
      "Décrivez le jeu, l'ID et le montant souhaité.",
      "Notre équipe répond dès que possible.",
    ],
  },
];

export const getHelpTopic = (slug: string): HelpTopic | null => {
  const normalized = String(slug ?? "").trim().toLowerCase();
  return HELP_TOPICS.find((t) => t.slug === normalized) ?? null;
};
