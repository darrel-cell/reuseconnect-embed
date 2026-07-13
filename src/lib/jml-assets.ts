import type { AssetCategory } from "@/types/jobs";

export const JML_ALLOWED_CATEGORY_NAMES = [
  "Laptop",
  "Phone",
  "Accessory",
] as const;

export type JmlAllowedCategoryName = (typeof JML_ALLOWED_CATEGORY_NAMES)[number];

const FALLBACK_ICONS: Record<JmlAllowedCategoryName, string> = {
  "Laptop": "💻",
  "Phone": "📱",
  "Accessory": "📦",
};

export type JmlDeviceType = "Windows" | "Apple" | "Android";

export function getUnderlyingAssetCategoryNameForJml(displayName: string): "Laptop" | "Smart Phones" | null {
  const c = displayName.trim().toLowerCase();
  if (c === "laptop" || c === "desktop") return "Laptop";
  if (c === "phone" || c === "smart phones" || c === "smart phone") return "Smart Phones";
  return null; // Accessory (and anything else)
}

/**
 * Returns 3 always-present options for the JML workflow.
 *
 * Note: these are UI categories; we pull an icon from the closest underlying DB category when available.
 */
export function filterJmlAssetCategories(assetCategories: AssetCategory[]): AssetCategory[] {
  const byName = new Map(assetCategories.map((c) => [c.name, c]));

  return (JML_ALLOWED_CATEGORY_NAMES as readonly JmlAllowedCategoryName[]).map((displayName) => {
    const underlyingName = getUnderlyingAssetCategoryNameForJml(displayName);
    const underlying = underlyingName ? byName.get(underlyingName) : undefined;

    return {
      id: `jml:${displayName}`,
      name: displayName,
      icon: underlying?.icon ?? FALLBACK_ICONS[displayName],
      co2ePerUnit: underlying?.co2ePerUnit ?? 0,
      avgWeight: underlying?.avgWeight ?? 0,
      avgBuybackValue: underlying?.avgBuybackValue ?? 0,
    };
  });
}

export function isAccessoriesCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  return c === "accessory" || c === "accessories";
}

export function shouldShowDeviceTypeForJmlCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  return c === "laptop" || c === "desktop" || c === "phone" || c === "smart phones" || c === "smart phone";
}

export function getDeviceTypeOptionsForJmlCategory(category: string): JmlDeviceType[] {
  const c = category.trim().toLowerCase();
  if (c === "phone" || c === "smart phones" || c === "smart phone") return ["Android", "Apple"];
  return ["Windows", "Apple"]; // laptop/desktop default
}

export function inferDeviceTypeFromJmlCategory(category: string): JmlDeviceType {
  const c = category.trim().toLowerCase();
  if (c === "phone" || c === "smart phones" || c === "smart phone") return "Android";
  return "Windows";
}

/** Grading / inventory: phones and tablets need IMEI. */
export function categoryRequiresImei(categoryName: string): boolean {
  const c = (categoryName || "").trim().toLowerCase();
  return (
    c === "smart phones" ||
    c === "smart phone" ||
    c === "phone" ||
    c === "tablets" ||
    c === "tablet" ||
    c === "mobile"
  );
}

