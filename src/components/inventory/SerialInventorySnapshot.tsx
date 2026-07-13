import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { IdentityMismatch } from "@/lib/serial-inventory-compare";
import type { InventoryLookupResult } from "@/services/inventory.service";
import { AlertTriangle, Database, Leaf, RefreshCw } from "lucide-react";

type Props = {
  lookup: InventoryLookupResult | null;
  mismatches: IdentityMismatch[];
  loading?: boolean;
  /** Grading: only category + IMEI are compared; inventory form: full identity */
  variant: "grading" | "inventory";
};

export function SerialInventorySnapshot({ lookup, mismatches, loading, variant }: Props) {
  if (loading) {
    return (
      <p className="text-muted-foreground text-xs py-1">Checking serial against inventory…</p>
    );
  }

  if (!lookup || !lookup.found) {
    return null;
  }

  const inv = lookup.inventory;
  const reuse = lookup.reuse;

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border bg-card/80 p-3 text-sm">
        <div className="flex items-center gap-2 text-foreground font-medium mb-2">
          <Database className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <span>On file (database)</span>
        </div>
        <dl className="grid gap-1.5 sm:grid-cols-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-mono text-foreground">{inv.category}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Make / Model</dt>
            <dd className="text-foreground">
              {inv.make} {inv.model}
            </dd>
          </div>
          {(inv.deviceType || variant === "inventory") && (
            <div>
              <dt className="text-muted-foreground">Device type</dt>
              <dd className="font-mono text-foreground">{inv.deviceType || "—"}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Serial</dt>
            <dd className="font-mono text-foreground">{inv.serialNumber}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">IMEI</dt>
            <dd className="font-mono text-foreground">{inv.imei || "—"}</dd>
          </div>
          {variant === "inventory" && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Condition (ERP)</dt>
              <dd className="font-mono text-foreground">{inv.conditionCode}</dd>
            </div>
          )}
        </dl>

        {reuse && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Reuse count: <span className="font-medium text-foreground">{reuse.reuseCount}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Leaf className="h-3.5 w-3.5 text-success" aria-hidden />
              CO₂e saved (total):{" "}
              <span className="font-medium text-foreground">{reuse.totalCO2e.toFixed(2)} kg</span>
            </span>
          </div>
        )}
      </div>

      {mismatches.length > 0 && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">Does not match database</AlertTitle>
          <AlertDescription className="text-xs space-y-1.5 pt-1">
            <p>
              The system keeps <strong>database</strong> values for device identity when you save. You can continue —
              mismatched fields will be aligned to inventory, or use &quot;Apply database values&quot; where offered.
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {mismatches.map((m) => (
                <li key={m.field}>
                  <span className="font-medium">{m.field}:</span> entered{" "}
                  <span className="font-mono">{m.entered}</span> · database{" "}
                  <span className="font-mono">{m.database}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
