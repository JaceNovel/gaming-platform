export const ADMIN_ROLE_VALUES = [
  "admin",
  "admin_super",
  "admin_operations",
  "admin_domain",
  "admin_manager",
  "admin_support",
  "admin_marketing",
  "admin_article",
  "admin_client",
  "staff",
  "viewer",
] as const;
const ADMIN_ROLE_SET = new Set(ADMIN_ROLE_VALUES.map((role) => role.toLowerCase()));

export type AdminRole = (typeof ADMIN_ROLE_VALUES)[number];

type RoleDefinition = {
  label: string;
  description: string;
  permissions: "*" | string[];
};

const ROLE_DEFINITIONS: Record<AdminRole, RoleDefinition> = {
  admin: {
    label: "Admin systeme",
    description: "Acces complet a la plateforme.",
    permissions: "*",
  },
  admin_super: {
    label: "Admin superieur",
    description: "Controle total des parametres et de l'administration.",
    permissions: "*",
  },
  admin_operations: {
    label: "Admin operations",
    description: "Abonnements, recharges, vendeurs et retraits.",
    permissions: [
      "dashboard.view",
      "stats.view",
      "orders.view",
      "orders.manage",
      "payments.view",
      "payments.resync",
      "subscriptions.manage",
      "premium.manage",
      "redeems.view",
      "redeems.manage",
      "stock.manage",
      "email.view",
      "email.manage",
      "notifications.manage",
      "wallet.manage",
      "marketplace.sellers.view",
      "marketplace.sellers.manage",
      "marketplace.listings.manage",
      "marketplace.orders.manage",
      "marketplace.withdraws.manage",
    ],
  },
  admin_domain: {
    label: "Admin domaines",
    description: "Tournois, litiges, remboursements et partenariats.",
    permissions: [
      "dashboard.view",
      "users.view",
      "orders.view",
      "payments.view",
      "email.view",
      "email.manage",
      "notifications.manage",
      "premium.manage",
      "tournaments.view",
      "tournaments.manage",
      "marketplace.sellers.view",
      "marketplace.sellers.manage",
      "marketplace.disputes.manage",
      "marketplace.settings.manage",
    ],
  },
  admin_manager: {
    label: "Manager legacy",
    description: "Ancien role conserve pour compatibilite.",
    permissions: [
      "dashboard.view",
      "stats.view",
      "orders.view",
      "orders.manage",
      "payments.view",
      "payments.resync",
      "products.view",
      "products.manage",
      "categories.manage",
      "premium.manage",
      "redeems.view",
      "redeems.manage",
      "stock.manage",
      "email.view",
      "email.manage",
      "notifications.manage",
      "wallet.manage",
      "marketplace.sellers.view",
      "marketplace.sellers.manage",
      "marketplace.withdraws.manage",
      "marketplace.disputes.manage",
      "marketplace.listings.manage",
      "marketplace.orders.manage",
      "marketplace.settings.manage",
    ],
  },
  admin_support: {
    label: "Support legacy",
    description: "Ancien role conserve pour compatibilite.",
    permissions: [
      "dashboard.view",
      "orders.view",
      "users.view",
      "support.view",
      "support.manage",
      "email.view",
      "email.manage",
      "reviews.view",
      "wallet.manage",
      "marketplace.sellers.view",
    ],
  },
  admin_marketing: {
    label: "Marketing legacy",
    description: "Ancien role conserve pour compatibilite.",
    permissions: ["dashboard.view", "stats.view", "products.view", "promotions.manage", "coupons.manage", "subscriptions.manage", "premium.manage"],
  },
  admin_article: {
    label: "Admin article",
    description: "Catalogue et contenus produits.",
    permissions: ["dashboard.view", "products.view", "products.manage", "tournaments.view"],
  },
  admin_client: {
    label: "Admin client",
    description: "Support client et emails.",
    permissions: ["dashboard.view", "orders.view", "payments.view", "users.view", "email.view", "email.manage", "wallet.manage", "marketplace.sellers.view"],
  },
  staff: {
    label: "Staff",
    description: "Acces partiel legacy.",
    permissions: ["dashboard.view", "orders.view", "payments.view", "products.view", "marketplace.sellers.view"],
  },
  viewer: {
    label: "Lecteur",
    description: "Lecture seule legacy.",
    permissions: ["dashboard.view", "stats.view", "orders.view", "payments.view", "products.view", "tournaments.view", "marketplace.sellers.view"],
  },
};

export const ADMIN_ROLE_OPTIONS = ADMIN_ROLE_VALUES.map((role) => ({
  value: role,
  label: ROLE_DEFINITIONS[role].label,
  description: ROLE_DEFINITIONS[role].description,
}));

export const isAdminRole = (role?: string | null): role is AdminRole => {
  if (!role) return false;
  return ADMIN_ROLE_SET.has(role.toLowerCase());
};

export const hasAdminPermission = (role: string | null | undefined, permission: string) => {
  if (!isAdminRole(role)) return false;
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) return false;
  if (definition.permissions === "*") return true;
  return definition.permissions.includes(permission);
};

export const adminRoleLabel = (role?: string | null) => {
  if (!role || !isAdminRole(role)) return role ?? "";
  return ROLE_DEFINITIONS[role].label;
};
