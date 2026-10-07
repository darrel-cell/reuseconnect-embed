import type { AssetCategory } from "@/types/jobs";

/** Retired categories stay visible on existing bookings but can't be picked for new lines. */
export function isActiveCategory(category: Pick<AssetCategory, "isActive">): boolean {
  return category.isActive !== false;
}

/** WEEE is booked in whole tonnes rather than units. */
export function isWeeeCategory(name: string | undefined | null): boolean {
  return (name || "").trim().toLowerCase().startsWith("weee") || (name || "").toLowerCase() === "mixed weee";
}
