import {
  BatteryCharging,
  Box,
  Cable,
  Computer,
  Database,
  Droplet,
  HardDrive,
  Laptop,
  MemoryStick,
  Monitor,
  Network,
  Package,
  Phone,
  Printer,
  Recycle,
  Server,
  Smartphone,
  Tablet,
  Video,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Order matters: more specific keywords first (e.g. "voip" before "phone").
const ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/voip/, Phone],
  [/thin client/, Computer],
  [/watch/, Watch],
  [/laptop/, Laptop],
  [/desktop/, Computer],
  [/monitor|vdu/, Monitor],
  [/phone|mobile/, Smartphone],
  [/tablet/, Tablet],
  [/docking/, Cable],
  [/printer/, Printer],
  [/toner/, Droplet],
  [/array|nas/, Database],
  [/server/, Server],
  [/storage|hdd|ssd|hard drive/, HardDrive],
  [/memory/, MemoryStick],
  [/network|router|switch/, Network],
  [/video/, Video],
  [/^ups$/, BatteryCharging],
  [/accessor/, Package],
  [/weee/, Recycle],
];

export function getAssetCategoryIcon(name: string | undefined | null): LucideIcon {
  const n = (name || "").trim().toLowerCase();
  return ICON_RULES.find(([pattern]) => pattern.test(n))?.[1] ?? Box;
}

export function AssetCategoryIcon({ name, className }: { name: string | undefined | null; className?: string }) {
  const Icon = getAssetCategoryIcon(name);
  return <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />;
}
