import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle2, ClipboardCheck, Loader2, MapPin, Package, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignatureCapture } from "@/components/driver/SignatureCapture";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { BookingTypeBadge } from "@/components/bookings/BookingTypeBadge";
import { useJob, useUpdateJobCollectedQuantities, useUpdateJobEvidence, useUpdateJobStatus } from "@/hooks/useJobs";
import { getWorkflowStatusLabel } from "@/lib/constants";
import type { WorkflowStatus } from "@/types/jobs";
import { formatDate } from '@/lib/datetime';

const warehouseProgression: Record<string, WorkflowStatus> = {
  collected: "warehouse",
};

const actionLabels: Record<WorkflowStatus, string> = {
  warehouse: "Confirm Warehouse Receipt",
  sanitised: "Complete Sanitisation",
  graded: "Complete Grading",
  booked: "Update Status",
  routed: "Update Status",
  "en-route": "Update Status",
  arrived: "Update Status",
  collected: "Update Status",
  completed: "Update Status",
  cancelled: "Update Status",
  "device-allocated": "Update Status",
  "courier-booked": "Update Status",
  dispatched: "Update Status",
  delivered: "Update Status",
  "delivery-courier-booked": "Update Status",
  "delivery-dispatched": "Update Status",
  inventory: "Update Status",
};

const statusDisplay = (status: WorkflowStatus, bookingType?: string | null) =>
  getWorkflowStatusLabel(status, bookingType);

const WarehouseJobView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: job, isLoading } = useJob(id);
  const updateStatus = useUpdateJobStatus();
  const updateEvidence = useUpdateJobEvidence();
  const updateCollectedQuantities = useUpdateJobCollectedQuantities();
  const [signature, setSignature] = useState<string | null>(null);
  const [followUpMemo, setFollowUpMemo] = useState<string>("");
  const [activeAction, setActiveAction] = useState<"confirm" | "follow-up" | null>(null);
  const [assetQtyDraft, setAssetQtyDraft] = useState<Record<string, number>>({});

  const nextStatus = useMemo(() => {
    if (!job) return null;
    return warehouseProgression[job.status] || null;
  }, [job]);

  const sanitisationRoute = job?.bookingId ? `/warehouse/sanitisation/${job.bookingId}` : null;
  const gradingRoute = job?.bookingId ? `/warehouse/grading/${job.bookingId}` : null;

  const handleProgress = () => {
    if (!id || !nextStatus) return;
    updateStatus.mutate(
      { jobId: id, status: nextStatus },
      {
        onSuccess: () => {
          toast.success(`Job moved to ${statusDisplay(nextStatus, job?.bookingType)}`);
        },
        onError: (error) => {
          toast.error("Failed to update job status", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const hasValidSignature = !!signature && signature.startsWith("data:");

  const resetReceiptFlow = () => {
    setSignature(null);
    setFollowUpMemo("");
    setAssetQtyDraft({});
    setActiveAction(null);
  };

  const handleConfirmWarehouseReceipt = async () => {
    if (!id || !job || !nextStatus) return;
    if (!hasValidSignature) {
      toast.error("Technician signature is required before confirming.");
      return;
    }

    try {
      await updateEvidence.mutateAsync({
        jobId: id,
        evidence: {
          status: nextStatus,
          signature: signature || undefined,
          notes: "Warehouse technician confirmed asset list matches received items.",
        },
      });
      await updateStatus.mutateAsync({
        jobId: id,
        status: nextStatus,
        notes: "Warehouse receipt confirmed by technician.",
      });
      toast.success(`Job moved to ${statusDisplay(nextStatus, job?.bookingType)}`);
      resetReceiptFlow();
    } catch (error) {
      toast.error("Failed to confirm warehouse receipt", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleFollowUpWarehouseReceipt = async () => {
    if (!id || !job || !nextStatus) return;
    if (job.assets.length === 0) {
      toast.error("No assets available to update.");
      return;
    }
    const assetLines = job.assets.map((asset) => ({
      jobAssetId: asset.id,
      quantity: assetQtyDraft[asset.id] ?? asset.quantity,
    }));
    if (
      assetLines.some(
        (line) => !Number.isInteger(line.quantity) || line.quantity < 0
      )
    ) {
      toast.error("Each asset quantity must be a whole number of zero or more.");
      return;
    }
    if (!followUpMemo.trim()) {
      toast.error("Please enter a discrepancy memo.");
      return;
    }
    if (!hasValidSignature) {
      toast.error("Technician signature is required before submitting follow-up.");
      return;
    }

    const discrepancyByType = job.assets.map((asset) => {
      const receivedQty = assetQtyDraft[asset.id] ?? asset.quantity;
      return `- ${asset.categoryName || "Asset"}: expected ${asset.quantity}, received ${receivedQty}`;
    });

    const discrepancyNote = [
      "Warehouse discrepancy reported by technician.",
      "Per-asset mismatch:",
      ...discrepancyByType,
      `Memo: ${followUpMemo.trim()}`,
    ].join("\n");

    const discrepancyExpectedTotal = job.assets.reduce((sum, asset) => sum + asset.quantity, 0);
    const discrepancyReceivedTotal = job.assets.reduce((sum, asset) => {
      const receivedQty = assetQtyDraft[asset.id] ?? asset.quantity;
      return sum + receivedQty;
    }, 0);

    try {
      await updateCollectedQuantities.mutateAsync({
        jobId: id,
        assets: assetLines,
      });
      await updateEvidence.mutateAsync({
        jobId: id,
        evidence: {
          status: nextStatus,
          signature: signature || undefined,
          notes: discrepancyNote,
        },
      });
      await updateStatus.mutateAsync({
        jobId: id,
        status: nextStatus,
        notes: discrepancyNote,
        mismatch: true,
        discrepancyMemo: discrepancyNote,
        discrepancyExpectedTotal,
        discrepancyReceivedTotal,
      });
      toast.success(`Follow-up submitted. Job moved to ${statusDisplay(nextStatus, job?.bookingType)}.`);
      resetReceiptFlow();
    } catch (error) {
      toast.error("Failed to submit follow-up", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>Job not found.</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/jobs">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/jobs">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 flex-wrap">
            <span>{job.organisationName}</span>
            <BookingTypeBadge bookingType={job.bookingType} jmlSubType={job.jmlSubType} size="sm" />
            <JobStatusBadge status={job.status} bookingType={job.bookingType} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{job.erpJobNumber}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {job.siteName}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(job.scheduledDate)}
            </span>
            {job.driver?.name && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Driver: {job.driver.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              {job.assets.reduce((sum, a) => sum + a.quantity, 0)} assets
            </span>
          </div>

          <div className="rounded-md border bg-secondary/20 p-4">
            <p className="text-sm font-medium mb-3">Asset Details</p>
            {job.assets.length > 0 ? (
              <div className="space-y-2">
                {job.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0 pr-4">
                      <p className="font-medium truncate">{asset.categoryName}</p>
                    </div>
                    <p className="font-semibold">x{asset.quantity}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No asset details available.</p>
            )}
          </div>

          {job.status === "warehouse" && sanitisationRoute ? (
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription>
                Continue with the full sanitisation workflow.
              </AlertDescription>
            </Alert>
          ) : job.status === "sanitised" && gradingRoute ? (
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription>
                Continue with the full grading workflow.
              </AlertDescription>
            </Alert>
          ) : nextStatus ? (
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription>
                {job.status === "collected"
                  ? "Confirm asset handover from Driver and proceed to Warehouse processing."
                  : `Proceed from ${statusDisplay(job.status, job.bookingType)} to ${statusDisplay(nextStatus, job.bookingType)}.`}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                This job is outside Warehouse Technician processing stages.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {job.status === "collected" && nextStatus ? (
              <>
                <Button
                  size="lg"
                  onClick={() => setActiveAction("confirm")}
                  variant={activeAction === "confirm" ? "default" : "outline"}
                  disabled={updateStatus.isPending || updateEvidence.isPending}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Confirm match
                </Button>
                <Button
                  size="lg"
                  onClick={() => setActiveAction("follow-up")}
                  variant={activeAction === "follow-up" ? "default" : "outline"}
                  disabled={updateStatus.isPending || updateEvidence.isPending}
                >
                  Follow-up mismatch
                </Button>
              </>
            ) : job.status === "warehouse" && sanitisationRoute ? (
              <Button size="lg" asChild>
                <Link to={sanitisationRoute}>Open Sanitisation Workflow</Link>
              </Button>
            ) : job.status === "sanitised" && gradingRoute ? (
              <Button size="lg" asChild>
                <Link to={gradingRoute}>Open Grading Workflow</Link>
              </Button>
            ) : (
              <Button
                onClick={handleProgress}
                disabled={!nextStatus || updateStatus.isPending}
                size="lg"
              >
                {updateStatus.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : nextStatus ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {actionLabels[nextStatus]}
                  </>
                ) : (
                  "No action available"
                )}
              </Button>
            )}
          </div>

          {job.status === "collected" && nextStatus && activeAction === "confirm" && (
            <Card className="border-primary/25 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Confirm warehouse receipt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Check the asset list above. If matched, sign and confirm to move this job to Warehouse.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Technician signature</Label>
                  <SignatureCapture signature={signature} onSignatureChange={setSignature} />
                </div>
                <Button
                  onClick={handleConfirmWarehouseReceipt}
                  disabled={updateStatus.isPending || updateEvidence.isPending || !hasValidSignature}
                >
                  {updateStatus.isPending || updateEvidence.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Sign and move to Warehouse"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {job.status === "collected" && nextStatus && activeAction === "follow-up" && (
            <Card className="border-warning/25 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-base">Follow-up for mismatch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Record what was actually received so Admin can review the discrepancy.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-2">
                  <Label>Exact quantity received per asset</Label>
                  <div className="space-y-2">
                    {job.assets.map((asset) => (
                      <div key={asset.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm">{asset.categoryName}</span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="max-w-28"
                          value={assetQtyDraft[asset.id] ?? asset.quantity}
                          onChange={(e) => {
                            const parsed = Number.parseInt(e.target.value, 10);
                            setAssetQtyDraft((prev) => ({
                              ...prev,
                              [asset.id]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                            }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="follow-up-memo">Memo</Label>
                  <Textarea
                    id="follow-up-memo"
                    value={followUpMemo}
                    onChange={(e) => setFollowUpMemo(e.target.value)}
                    rows={4}
                    placeholder="Explain what did not match"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Technician signature</Label>
                  <SignatureCapture signature={signature} onSignatureChange={setSignature} />
                </div>
                <Button
                  onClick={handleFollowUpWarehouseReceipt}
                  disabled={
                    updateStatus.isPending ||
                    updateEvidence.isPending ||
                    updateCollectedQuantities.isPending ||
                    !hasValidSignature ||
                    !followUpMemo.trim()
                  }
                >
                  {updateStatus.isPending || updateEvidence.isPending || updateCollectedQuantities.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit follow-up, sign and move to Warehouse"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WarehouseJobView;
