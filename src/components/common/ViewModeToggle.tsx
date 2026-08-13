import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListViewMode } from "@/hooks/usePersistedViewMode";

type ViewModeToggleProps = {
  value: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  className?: string;
};

/** Compact icon toggle between dense list and card grid. */
export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={cn("inline-flex items-center rounded-md border bg-background p-0.5", className)}
      role="group"
      aria-label="View mode"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8",
          value === "list" && "bg-muted text-foreground"
        )}
        aria-pressed={value === "list"}
        aria-label="List view"
        title="List view"
        onClick={() => onChange("list")}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8",
          value === "card" && "bg-muted text-foreground"
        )}
        aria-pressed={value === "card"}
        aria-label="Card view"
        title="Card view"
        onClick={() => onChange("card")}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
