// Shared pieces of the impact dashboard's sections, so they read as one page.
import type { ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SectionHeading({
  id,
  icon: Icon,
  title,
  description,
  busy,
  action,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  busy?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div>
          <h2 id={id} className="text-lg font-semibold leading-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />}
        {action}
      </div>
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-tight">
          {value}
          {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
        </p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
