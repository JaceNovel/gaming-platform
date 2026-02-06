export const CART_UPDATED_EVENT = "bbshop:cart-updated" as const;

export type CartUpdatedAction = "add" | "update" | "remove" | "clear";

export type CartUpdatedDetail = {
  action: CartUpdatedAction;
};

export function emitCartUpdated(detail: CartUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CartUpdatedDetail>(CART_UPDATED_EVENT, { detail }));
}
