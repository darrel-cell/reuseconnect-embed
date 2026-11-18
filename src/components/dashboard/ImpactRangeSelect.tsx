import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RANGES = [6, 12, 24] as const;

/** One period for every impact section on the dashboard. */
export function ImpactRangeSelect({ months, onChange }: { months: number; onChange: (months: number) => void }) {
  return (
    <Select value={String(months)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-40" aria-label="Period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGES.map((n) => (
          <SelectItem key={n} value={String(n)}>
            Last {n} months
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
