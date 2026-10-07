import { useMemo, useState } from "react";
import { ChevronDown, HardDrive, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AssetCategoryIcon } from "@/components/assets/AssetCategoryIcon";
import { isWeeeCategory } from "@/lib/asset-categories";
import { cn } from "@/lib/utils";
import type { AssetCategory } from "@/types/jobs";

type Group = { key: string; label: string; match: RegExp };

const GROUPS: Group[] = [
  { key: "computing", label: "Computing & displays", match: /laptop|desktop|thin client|monitor|vdu|docking/ },
  { key: "mobile", label: "Mobile & wearables", match: /phone|mobile|tablet|watch/ },
  { key: "datacentre", label: "Servers & storage", match: /server|storage|memory/ },
  { key: "network", label: "Networking & communications", match: /network|router|switch|voip|video|^ups$/ },
  { key: "print", label: "Print & accessories", match: /printer|toner|accessor/ },
  { key: "waste", label: "Waste", match: /weee/ },
];

// Display order follows the client's stock-class list.
const ORDER = [
  "laptop", "desktop", "thin client", "monitor/vdu", "docking station",
  "smart phone", "tablet", "smart watch",
  "server", "storage device - array / nas", "storage device - hdd 4tb and above",
  "storage device - hdd 2tb to 3.9tb", "storage device - hdd 1tb to 1.9tb",
  "storage - ssd / hdd under 1tb", "memory",
  "networking", "voip", "video conferencing", "ups",
  "printer", "toner", "accessories",
  "weee (by tonne)",
];

const isStorage = (name: string) => /^storage/i.test(name.trim());
const storageLabel = (name: string) => name.replace(/^storage device - /i, "").replace(/^storage - /i, "");
const rank = (name: string) => {
  const i = ORDER.indexOf(name.trim().toLowerCase());
  return i === -1 ? ORDER.length : i;
};
const byOrder = (a: AssetCategory, b: AssetCategory) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);

interface AssetSelectionPanelProps {
  categories: AssetCategory[];
  getQuantity: (categoryId: string) => number;
  onStep: (categoryId: string, delta: number) => void;
  onSetQuantity: (categoryId: string, quantity: number) => void;
  canIncrease: boolean;
  step?: number;
}

export function AssetSelectionPanel({
  categories,
  getQuantity,
  onStep,
  onSetQuantity,
  canIncrease,
  step = 5,
}: AssetSelectionPanelProps) {
  const groups = useMemo(() => {
    const remaining = [...categories].sort(byOrder);
    const result = GROUPS.map((group) => {
      const items = remaining.filter((c) => group.match.test(c.name.trim().toLowerCase()));
      items.forEach((c) => remaining.splice(remaining.indexOf(c), 1));
      return { ...group, items };
    });
    result.push({ key: "other", label: "Other", match: /.^/, items: remaining });
    return result.filter((g) => g.items.length > 0);
  }, [categories]);

  const storageItems = useMemo(() => categories.filter((c) => isStorage(c.name)).sort(byOrder), [categories]);
  const storageTotal = storageItems.reduce((sum, c) => sum + getQuantity(c.id), 0);
  const [storageOpen, setStorageOpen] = useState(storageTotal > 0);

  const renderRow = (category: AssetCategory, label: string, nested = false) => {
    const qty = getQuantity(category.id);
    const weee = isWeeeCategory(category.name);
    return (
      <div
        key={category.id}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 transition-colors",
          nested && "pl-6 sm:pl-14",
          qty > 0 ? "bg-primary/5" : "hover:bg-muted/40"
        )}
      >
        {!nested && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <AssetCategoryIcon name={category.name} className="h-[18px] w-[18px]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", nested ? "text-[13px]" : "text-sm")}>{label}</p>
          <p className="text-xs text-muted-foreground">
            ~{category.co2ePerUnit} kg CO₂e {weee ? "per tonne" : "per unit"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStep(category.id, -step)}
            disabled={qty === 0}
            aria-label={`Decrease ${label}`}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <div className="relative">
            <Input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => onSetQuantity(category.id, parseInt(e.target.value) || 0)}
              className={cn("h-8 w-16 text-center tabular-nums", weee && "pr-5")}
              aria-label={`${label} quantity`}
            />
            {weee && (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                t
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStep(category.id, step)}
            disabled={!canIncrease}
            aria-label={`Increase ${label}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  const renderStorageGroup = () => (
    <Collapsible key="storage" open={storageOpen} onOpenChange={setStorageOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
            storageTotal > 0 && "bg-primary/5"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HardDrive className="h-[18px] w-[18px]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Storage</p>
            <p className="text-xs text-muted-foreground">
              {storageItems.length} types · arrays, hard drives and SSDs
            </p>
          </div>
          {storageTotal > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {storageTotal} selected
            </Badge>
          )}
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", storageOpen && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="divide-y border-t bg-muted/20">
        {storageItems.map((c) => renderRow(c, storageLabel(c.name), true))}
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
      {groups.map((group) => {
        const groupTotal = group.items.reduce((sum, c) => sum + getQuantity(c.id), 0);
        let storageRendered = false;
        return (
          <section key={group.key} className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
              {groupTotal > 0 && (
                <span className="text-xs font-medium text-primary tabular-nums">{groupTotal} selected</span>
              )}
            </div>
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {group.items.map((category) => {
                if (isStorage(category.name) && storageItems.length > 1) {
                  if (storageRendered) return null;
                  storageRendered = true;
                  return renderStorageGroup();
                }
                return renderRow(category, category.name);
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
