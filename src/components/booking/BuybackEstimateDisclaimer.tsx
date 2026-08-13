import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const BUYBACK_ESTIMATE_DISCLAIMER =
  "Buyback values are estimated and final value will be calculated based make models specification and grading. The final value could be higher or lower";

type BuybackEstimateDisclaimerProps = {
  className?: string;
  /** `text` = full paragraph; `icon` = compact circled alert with tooltip. */
  variant?: "text" | "icon";
};

export function BuybackEstimateDisclaimer({
  className,
  variant = "text",
}: BuybackEstimateDisclaimerProps) {
  if (variant === "icon") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                className
              )}
              aria-label="Buyback estimate information"
            >
              <CircleAlert className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-xs text-xs leading-snug">
            <p>{BUYBACK_ESTIMATE_DISCLAIMER}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <p className={cn("text-xs text-muted-foreground leading-snug", className)}>
      {BUYBACK_ESTIMATE_DISCLAIMER}
    </p>
  );
}
