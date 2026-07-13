import { cn } from "@/lib/utils";

export const BUYBACK_ESTIMATE_DISCLAIMER =
  "Buyback values are estimated and final value will be calculated based make models specification and grading. The final value could be higher or lower";

type BuybackEstimateDisclaimerProps = {
  className?: string;
};

export function BuybackEstimateDisclaimer({ className }: BuybackEstimateDisclaimerProps) {
  return (
    <p className={cn("text-xs text-muted-foreground leading-snug", className)}>
      {BUYBACK_ESTIMATE_DISCLAIMER}
    </p>
  );
}
