import { Badge } from "@/components/ui/badge";
import type { WorkflowStatus } from "@/types/jobs";
import { getWorkflowStatusColor, getWorkflowStatusLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface JobStatusBadgeProps {
  status: WorkflowStatus;
  size?: "sm" | "default";
  bookingType?: string | null;
}

export function JobStatusBadge({ status, size = "default", bookingType }: JobStatusBadgeProps) {
  const statusColor = getWorkflowStatusColor(status);
  const statusLabel = getWorkflowStatusLabel(status, bookingType);
  
  return (
    <Badge 
      className={cn(
        statusColor,
        size === "sm" && "text-xs px-2 py-0.5"
      )}
    >
      {statusLabel}
    </Badge>
  );
}
