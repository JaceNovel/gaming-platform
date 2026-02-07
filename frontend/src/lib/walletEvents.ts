export const WALLET_UPDATED_EVENT = "bbshop:wallet-updated";

type WalletUpdatedDetail = {
  source?: string;
};

export function emitWalletUpdated(detail?: WalletUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_UPDATED_EVENT, { detail }));
}

export function onWalletUpdated(handler: (detail?: WalletUpdatedDetail) => void) {
  if (typeof window === "undefined") return () => {};

  const wrapped = (event: Event) => {
    const custom = event as CustomEvent<WalletUpdatedDetail>;
    handler(custom?.detail);
  };

  window.addEventListener(WALLET_UPDATED_EVENT, wrapped);
  return () => window.removeEventListener(WALLET_UPDATED_EVENT, wrapped);
}
