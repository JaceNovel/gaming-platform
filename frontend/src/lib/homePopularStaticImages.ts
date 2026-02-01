const truthy = new Set(["1", "true", "yes", "on"]);

export const HOME_POPULAR_STATIC_IMAGES_ENABLED = truthy.has(
  String(process.env.NEXT_PUBLIC_HOME_POPULAR_STATIC_IMAGES ?? "true").toLowerCase(),
);

const DEFAULT_SLOTS: Array<string | null> = [
  "https://tse2.mm.bing.net/th/id/OIP.ApQn3C8u4WwH3gWfOF9gWAHaDe?rs=1&pid=ImgDetMain&o=7&rm=3",
  "https://cdn.ggmax.com.br/images/4de57f95b013571eb9c2129c3da926d8.sm.jpg",
  "https://www.freefiremania.com.br/images/dicas/dicas-como-conseguir-diamantes-gratis.jpg",
  "https://i1.moyens.net/io/images/2021/05/1620843139_400_5-meilleurs-skins-darmes-legendaires-dans-Free-Fire.jpg",
];

const SLOT_OVERRIDES: Array<string | null> = [
  process.env.NEXT_PUBLIC_HOME_POPULAR_SLOT_1 ?? null,
  process.env.NEXT_PUBLIC_HOME_POPULAR_SLOT_2 ?? null,
  process.env.NEXT_PUBLIC_HOME_POPULAR_SLOT_3 ?? null,
  process.env.NEXT_PUBLIC_HOME_POPULAR_SLOT_4 ?? null,
];

function normalize(src: string | null): string | null {
  const v = String(src ?? "").trim();
  return v ? v : null;
}

/**
 * Returns the static image URL/path for the Home "Produits les plus populaires" slot.
 * - `slotIndex` is 0-based.
 * - Returns null when the feature is disabled or the slot has no configured image.
 */
export function getHomePopularSlotImage(slotIndex: number): string | null {
  if (!HOME_POPULAR_STATIC_IMAGES_ENABLED) return null;
  const override = normalize(SLOT_OVERRIDES[slotIndex] ?? null);
  if (override) return override;
  return normalize(DEFAULT_SLOTS[slotIndex] ?? null);
}
