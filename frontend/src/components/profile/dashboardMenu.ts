import type { LucideIcon } from "lucide-react";
import { Crown, Home, Settings, ShoppingBag, Wallet } from "lucide-react";

export type DashboardMenuId = "MesCommandes" | "Wallet" | "VIP" | "Principal" | "Parametres";

export type DashboardMenuItem = {
  id: DashboardMenuId;
  label: string;
  icon: LucideIcon;
};

export const DASHBOARD_MENU: DashboardMenuItem[] = [
  { id: "MesCommandes", label: "Mes Commandes", icon: ShoppingBag },
  { id: "Wallet", label: "Wallet BD", icon: Wallet },
  { id: "VIP", label: "BADBOY VIP", icon: Crown },
  { id: "Principal", label: "Principal", icon: Home },
  { id: "Parametres", label: "Paramètres", icon: Settings },
];
