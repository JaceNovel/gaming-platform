const ADMIN_ROLE_VALUES = ["admin", "admin_super", "admin_article", "admin_client"] as const;
const ADMIN_ROLE_SET = new Set(ADMIN_ROLE_VALUES.map((role) => role.toLowerCase()));

export type AdminRole = (typeof ADMIN_ROLE_VALUES)[number];

export const isAdminRole = (role?: string | null): role is AdminRole => {
  if (!role) return false;
  return ADMIN_ROLE_SET.has(role.toLowerCase());
};

export const adminRoleLabel = (role?: string | null) => {
  if (!role) return "";
  switch (role) {
    case "admin":
      return "Admin";
    case "admin_super":
      return "Admin supérieur";
    case "admin_article":
      return "Admin article";
    case "admin_client":
      return "Admin client";
    default:
      return role;
  }
};
