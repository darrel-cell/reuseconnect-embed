import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, UserPlus, UserMinus, Move, Wrench } from "lucide-react";

export type BookingType = 'itad_collection' | 'free_collection' | 'jml';
export type JMLSubType = 'new_starter' | 'leaver' | 'breakfix' | 'mover';

interface BookingTypeBadgeProps {
  bookingType?: BookingType;
  jmlSubType?: JMLSubType | null;
  isFreeCollection?: boolean;
  size?: "sm" | "default";
  showIcon?: boolean;
}

const bookingTypeConfig: Record<BookingType, { label: string; color: string; bgColor: string; icon?: typeof Package }> = {
  itad_collection: {
    label: 'ITAD',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    icon: Package,
  },
  free_collection: {
    label: 'Free',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    icon: Package,
  },
  jml: {
    label: 'JML',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
  },
};

const jmlSubTypeConfig: Record<JMLSubType, { label: string; color: string; bgColor: string; icon: typeof Package }> = {
  new_starter: {
    label: 'New Starter',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10 border-green-500/20',
    icon: UserPlus,
  },
  leaver: {
    label: 'Leaver',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10 border-red-500/20',
    icon: UserMinus,
  },
  mover: {
    label: 'Mover',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
    icon: Move,
  },
  breakfix: {
    label: 'Breakfix',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10 border-yellow-500/20',
    icon: Wrench,
  },
};

export function BookingTypeBadge({ 
  bookingType = 'itad_collection', 
  jmlSubType, 
  isFreeCollection = false,
  size = "default",
  showIcon = true 
}: BookingTypeBadgeProps) {
  const typeConfig = bookingTypeConfig[bookingType];
  const subTypeConfig = jmlSubType ? jmlSubTypeConfig[jmlSubType] : null;
  
  const TypeIcon = showIcon && typeConfig.icon ? typeConfig.icon : null;
  const SubTypeIcon = showIcon && subTypeConfig?.icon ? subTypeConfig.icon : null;

  // For JML bookings, show detailed badge with icon and sub-type
  if (bookingType === 'jml' && subTypeConfig) {
    return (
      <div className="flex items-center gap-1.5">
        {/* JML main badge with icon */}
        <Badge 
          className={cn(
            typeConfig.bgColor,
            typeConfig.color,
            "border",
            size === "sm" && "text-xs px-2 py-0.5"
          )}
        >
          {TypeIcon && <TypeIcon className={cn("h-3 w-3", size === "sm" ? "mr-1" : "mr-1.5")} />}
          {typeConfig.label}
        </Badge>
        
        {/* JML sub-type badge with icon */}
        <Badge 
          className={cn(
            subTypeConfig.bgColor,
            subTypeConfig.color,
            "border font-medium",
            size === "sm" && "text-xs px-2 py-0.5"
          )}
        >
          {SubTypeIcon && <SubTypeIcon className={cn("h-3 w-3", size === "sm" ? "mr-1" : "mr-1.5")} />}
          {subTypeConfig.label}
        </Badge>
      </div>
    );
  }

  if ((bookingType === "itad_collection" && isFreeCollection) || bookingType === "free_collection") {
    return (
      <Badge
        className={cn(
          "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 border",
          size === "sm" && "text-xs px-2 py-0.5"
        )}
      >
        Free
      </Badge>
    );
  }

  // For ITAD bookings, show simple badge
  return (
    <Badge 
      className={cn(
        typeConfig.bgColor,
        typeConfig.color,
        "border",
        size === "sm" && "text-xs px-2 py-0.5"
      )}
    >
      {TypeIcon && <TypeIcon className={cn("h-3 w-3", size === "sm" ? "mr-1" : "mr-1.5")} />}
      {typeConfig.label}
    </Badge>
  );
}
