import type { SanitisationRecord } from "@/mocks/mock-entities";

export type SanitisationMethod = SanitisationRecord["method"];

/** Labels match RTG reporting + networking factory-reset method. */
export const SANITISATION_METHODS: { value: SanitisationMethod; label: string }[] = [
  { value: "blancco", label: "Nist-800-88 Software Wipe" },
  { value: "physical-destruction", label: "Physical Destruction" },
  { value: "degaussing", label: "Degaussing" },
  { value: "shredding", label: "Shredding" },
  { value: "factory-reset", label: "Factory Reset/vLAN Clears/Config Wiped" },
  { value: "other", label: "Other" },
];

/** "Degaussing + Shredding". Pass `labels` where a page names methods its own way. */
export function sanitisationMethodsLabel(
  record: Pick<SanitisationRecord, "method" | "methods">,
  labels: { value: string; label: string }[] = SANITISATION_METHODS
): string {
  const methods = record.methods?.length ? record.methods : [record.method];
  return methods.map((m) => labels.find((l) => l.value === m)?.label ?? m).join(" + ");
}

/**
 * Sanitised units against booked units, per category and overall. A category
 * can take several records (most units wiped, failed wipes destroyed), so it is
 * done once its records add up to its quantity, the same way grading counts.
 */
export function sanitisationProgress(
  assets: { categoryId: string; quantity: number }[],
  records: Pick<SanitisationRecord, "assetId" | "quantity">[]
) {
  const required = new Map<string, number>();
  for (const a of assets) required.set(a.categoryId, (required.get(a.categoryId) ?? 0) + a.quantity);
  const done = new Map<string, number>();
  for (const r of records) done.set(r.assetId, (done.get(r.assetId) ?? 0) + (r.quantity ?? 0));

  let units = 0;
  let total = 0;
  for (const [categoryId, need] of required) {
    total += need;
    units += Math.min(done.get(categoryId) ?? 0, need);
  }

  const doneFor = (categoryId: string) => done.get(categoryId) ?? 0;
  const requiredFor = (categoryId: string) => required.get(categoryId) ?? 0;
  return {
    units,
    total,
    complete: units >= total,
    doneFor,
    requiredFor,
    remainingFor: (categoryId: string) => Math.max(requiredFor(categoryId) - doneFor(categoryId), 0),
  };
}
