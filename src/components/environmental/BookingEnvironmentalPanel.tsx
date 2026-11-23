import { Loader2 } from "lucide-react";
import { useBookingEnvironmentalImpact } from "@/hooks/useEnvironmental";
import { cn } from "@/lib/utils";
import { formatFigure } from "@/lib/environmental-display";
import { ApiError } from "@/services/api-error";

/** 409: no factor set is published yet. */
const notSetUp = (error: unknown) => error instanceof ApiError && error.statusCode === 409;

/**
 * Water and minerals rows for booking/job Summary cards. From graded stock via
 * RTG's Environmental Impact Methodology; dash until grading is available.
 */
export function BookingEnvironmentalSummaryRows({ bookingId, bookingStatus }: { bookingId: string; bookingStatus: string }) {
  const impact = useBookingEnvironmentalImpact(bookingId);
  const graded = impact.data?.graded ? impact.data : null;
  const pastGrading = bookingStatus === "graded" || bookingStatus === "completed";
  if (notSetUp(impact.error)) return null;
  const note = impact.isLoading
    ? null
    : impact.error
      ? impact.error instanceof Error ? impact.error.message : "These figures are not available."
      : graded
        ? "From the graded stock, using RTG’s Environmental Impact Methodology."
        : pastGrading
          ? "No grades were entered for this booking, so these figures can’t be calculated."
          : "Available once the stock has been graded.";
  const row = (label: string, value: string | null, unit: string) => (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {impact.isLoading ? (
        <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      ) : (
        <p className={cn("text-2xl font-bold", value === null ? "text-muted-foreground" : "text-sky-700 dark:text-sky-400")}>
          {value === null ? "—" : `${value} ${unit}`}
        </p>
      )}
    </div>
  );
  return (
    <>
      {row("Water Saved", graded && formatFigure(graded.display.waterM3), "m³")}
      {row("Critical Minerals Conserved", graded && formatFigure(graded.display.mineralsKg), "kg")}
      {note && <p className="-mt-2 text-xs text-muted-foreground">{note}</p>}
    </>
  );
}
