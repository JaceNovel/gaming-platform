export type StorefrontVariant = {
  id: string;
  label: string;
  salePriceFcfa: number;
  compareAtPriceFcfa?: number | null;
  attributes?: unknown[] | Record<string, unknown> | null;
  isDefault?: boolean;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }
  return 0;
};

const labelFromAttributes = (attributes: unknown, fallbackId: string): string => {
  if (Array.isArray(attributes)) {
    const values = attributes
      .flatMap((entry) => {
        if (entry && typeof entry === "object") {
          const row = entry as Record<string, unknown>;
          return [row.property_value, row.value, row.property_name].map((value) => String(value ?? "").trim()).filter(Boolean);
        }

        const normalized = String(entry ?? "").trim();
        return normalized ? [normalized] : [];
      })
      .filter(Boolean);

    if (values.length) return Array.from(new Set(values)).join(" / ");
  }

  if (attributes && typeof attributes === "object") {
    const values = Object.values(attributes as Record<string, unknown>)
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    if (values.length) return Array.from(new Set(values)).join(" / ");
  }

  return fallbackId ? `Option ${fallbackId}` : "Option";
};

export const normalizeStorefrontVariants = (raw: unknown): StorefrontVariant[] => {
  if (!Array.isArray(raw)) return [];

  const variants = raw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const id = String(row.id ?? row.external_sku_id ?? row.sku_id ?? "").trim();
      if (!id) return null;

      const attributes = Array.isArray(row.variant_attributes_json)
        ? row.variant_attributes_json
        : row.variant_attributes_json && typeof row.variant_attributes_json === "object"
          ? (row.variant_attributes_json as Record<string, unknown>)
          : null;
      const label = String(row.label ?? row.sku_label ?? "").trim() || labelFromAttributes(attributes, id);
      const salePriceFcfa = Math.max(0, Math.round(toNumber(row.sale_price_fcfa ?? row.price_fcfa ?? row.price)));
      const compareAtPriceFcfa = Math.max(0, Math.round(toNumber(row.compare_at_price_fcfa ?? row.old_price_fcfa ?? row.compare_at_price)));

      return {
        id,
        label,
        salePriceFcfa,
        compareAtPriceFcfa: compareAtPriceFcfa > salePriceFcfa ? compareAtPriceFcfa : null,
        attributes,
        isDefault: Boolean(row.is_default ?? (index === 0)),
      } satisfies StorefrontVariant;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return variants;
};

export const resolveStorefrontVariant = (raw: unknown, variantId?: string | null): StorefrontVariant | null => {
  const variants = normalizeStorefrontVariants(raw);
  if (!variants.length) return null;

  const normalizedId = String(variantId ?? "").trim();
  if (normalizedId) {
    return variants.find((variant) => variant.id === normalizedId) ?? null;
  }

  return variants.find((variant) => variant.isDefault) ?? variants[0] ?? null;
};

export const buildCartItemKey = (productId: string | number, variantId?: string | null): string => {
  const normalizedVariantId = String(variantId ?? "").trim();
  return normalizedVariantId ? `${productId}:${normalizedVariantId}` : String(productId);
};