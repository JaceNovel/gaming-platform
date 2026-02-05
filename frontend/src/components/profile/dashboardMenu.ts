import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Bell, Crown, Gift, Home, KeyRound, Settings, ShoppingBag, Store, Wallet } from "lucide-react";

export type DashboardMenuId =
  | "MesCommandes"
  | "MesCodes"
  | "Wallet"
  | "Notifications"
  | "VIP"
  | "Parrainage"
  | "Vendeur"
  | "Litige"
  | "Principal"
  | "Parametres";

export type DashboardMenuItem = {
  id: DashboardMenuId;
  label: string;
  icon: LucideIcon;
};

export const DASHBOARD_MENU: DashboardMenuItem[] = [
  { id: "MesCommandes", label: "Mes Commandes", icon: ShoppingBag },
  { id: "MesCodes", label: "Mes codes", icon: KeyRound },
  { id: "Wallet", label: "Wallet BD", icon: Wallet },
  { id: "Notifications", label: "Notifications", icon: Bell },
  { id: "Litige", label: "Litige", icon: AlertTriangle },
  { id: "Parrainage", label: "Parrainage", icon: Gift },
  { id: "Vendeur", label: "Devenir vendeur", icon: Store },
  { id: "VIP", label: "BADBOY VIP", icon: Crown },
  { id: "Principal", label: "Principal", icon: Home },
  { id: "Parametres", label: "Paramètres", icon: Settings },
];
