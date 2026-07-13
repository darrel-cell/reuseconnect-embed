import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Truck, 
  Phone,
  Camera,
  PenTool,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Navigation,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoCapture } from "@/components/driver/PhotoCapture";
import { SignatureCapture } from "@/components/driver/SignatureCapture";
import { toast } from "sonner";
import { useJob, useUpdateJobEvidence, useUpdateJobStatus, useUpdateJobJourneyFields, useUpdateJobCollectedQuantities } from "@/hooks/useJobs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WorkflowStatus } from "@/types/jobs";
import { useAuth } from "@/contexts/AuthContext";
import { useDriver } from "@/hooks/useDrivers";
import { useAssetCategories } from "@/hooks/useAssets";
import { canDriverEditJob, isDriverFinalStatus } from "@/utils/job-helpers";

type ExtraAssetLine = { key: string; categoryId: string; quantity: number };

const DriverJobView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDriver = user?.role === "driver";
  const { data: driverProfile, isLoading: isLoadingDriverProfile } = useDriver(
    isDriver ? user?.id || null : null
  );
  const { data: job, isLoading, refetch: refetchJob } = useJob(id);
  const updateEvidence = useUpdateJobEvidence();
  const updateStatus = useUpdateJobStatus();
  const updateJourneyFields = useUpdateJobJourneyFields();
  const updateCollectedQuantities = useUpdateJobCollectedQuantities();
  const { data: assetCategories = [] } = useAssetCategories();
  const itadAssetCategories = useMemo(
    () =>
      assetCategories.filter(
        (category) => !["accessory", "accessories"].includes(category.name.toLowerCase())
      ),
    [assetCategories]
  );

  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [sealNumbers, setSealNumbers] = useState<string[]>([]);
  const [newSealNumber, setNewSealNumber] = useState("");
  const [notes, setNotes] = useState("");
  
  // Driver journey fields (for routed status) - all required
  const [dial2Collection, setDial2Collection] = useState("");
  const [securityRequirements, setSecurityRequirements] = useState("");
  const [idRequired, setIdRequired] = useState("");
  const [loadingBayLocation, setLoadingBayLocation] = useState("");
  const [vehicleHeightRestrictions, setVehicleHeightRestrictions] = useState("");
  const [doorLiftSize, setDoorLiftSize] = useState("");
  const [roadWorksPublicEvents, setRoadWorksPublicEvents] = useState("");
  const [manualHandlingRequirements, setManualHandlingRequirements] = useState("");
  /** Actual quantities collected (per job asset line) while status is arrived */
  const [assetQtyDraft, setAssetQtyDraft] = useState<Record<string, number>>({});
  /** Categories added on site that were not on the original booking */
  const [extraAssetLines, setExtraAssetLines] = useState<ExtraAssetLine[]>([]);

  // Track previous job ID and status to detect when they actually change
  const previousJobIdRef = useRef<string | undefined>(undefined);
  const previousStatusRef = useRef<string | undefined>(undefined);
  
  // Track initial journey field values to detect changes
  const initialJourneyFieldsRef = useRef<{
    dial2Collection: string;
    securityRequirements: string;
    idRequired: string;
    loadingBayLocation: string;
    vehicleHeightRestrictions: string;
    doorLiftSize: string;
    roadWorksPublicEvents: string;
    manualHandlingRequirements: string;
  } | null>(null);

  const areJourneyFieldsValid = useMemo(() => {
    return (
      dial2Collection.trim() !== "" &&
      securityRequirements.trim() !== "" &&
      idRequired.trim() !== "" &&
      loadingBayLocation.trim() !== "" &&
      vehicleHeightRestrictions.trim() !== "" &&
      doorLiftSize.trim() !== "" &&
      roadWorksPublicEvents.trim() !== "" &&
      manualHandlingRequirements.trim() !== ""
    );
  }, [
    dial2Collection,
    securityRequirements,
    idRequired,
    loadingBayLocation,
    vehicleHeightRestrictions,
    doorLiftSize,
    roadWorksPublicEvents,
    manualHandlingRequirements,
  ]);

  // Check if journey fields have been modified from initial values
  // Returns true if:
  // - Initial values haven't been set yet (first load, allow saving if valid)
  // - OR changes have been made from initial values
  const hasJourneyFieldsChanged = useMemo(() => {
    // If initial values haven't been set yet, allow saving (user can save on first load)
    if (!initialJourneyFieldsRef.current) return true;
    
    const initial = initialJourneyFieldsRef.current;
    return (
      dial2Collection.trim() !== initial.dial2Collection ||
      securityRequirements.trim() !== initial.securityRequirements ||
      idRequired.trim() !== initial.idRequired ||
      loadingBayLocation.trim() !== initial.loadingBayLocation ||
      vehicleHeightRestrictions.trim() !== initial.vehicleHeightRestrictions ||
      doorLiftSize.trim() !== initial.doorLiftSize ||
      roadWorksPublicEvents.trim() !== initial.roadWorksPublicEvents ||
      manualHandlingRequirements.trim() !== initial.manualHandlingRequirements
    );
  }, [
    dial2Collection,
    securityRequirements,
    idRequired,
    loadingBayLocation,
    vehicleHeightRestrictions,
    doorLiftSize,
    roadWorksPublicEvents,
    manualHandlingRequirements,
  ]);

  useEffect(() => {
    if (!job) return;

    const jobIdChanged = job.id !== previousJobIdRef.current;
    const statusChanged = job.status !== previousStatusRef.current;

    // Reset evidence fields when job ID or status changes
    if (jobIdChanged || statusChanged) {
      setPhotos([]);
      setSignature(null);
      setSealNumbers([]);
      setNotes("");
      setNewSealNumber("");
    }

    // Only initialize journey fields when loading a NEW job (job ID changed)
    // This ensures fields are populated on initial load but preserved after save/refetch
    // When job is refetched after save, jobIdChanged will be false, so fields won't be reset
    if (jobIdChanged && job.status === 'routed') {
      const initialValues = {
        dial2Collection: job.dial2Collection || "",
        securityRequirements: job.securityRequirements || "",
        idRequired: job.idRequired || "",
        loadingBayLocation: job.loadingBayLocation || "",
        vehicleHeightRestrictions: job.vehicleHeightRestrictions || "",
        doorLiftSize: job.doorLiftSize || "",
        roadWorksPublicEvents: job.roadWorksPublicEvents || "",
        manualHandlingRequirements: job.manualHandlingRequirements || "",
      };
      
      setDial2Collection(initialValues.dial2Collection);
      setSecurityRequirements(initialValues.securityRequirements);
      setIdRequired(initialValues.idRequired);
      setLoadingBayLocation(initialValues.loadingBayLocation);
      setVehicleHeightRestrictions(initialValues.vehicleHeightRestrictions);
      setDoorLiftSize(initialValues.doorLiftSize);
      setRoadWorksPublicEvents(initialValues.roadWorksPublicEvents);
      setManualHandlingRequirements(initialValues.manualHandlingRequirements);
      
      // Store initial values for change detection
      initialJourneyFieldsRef.current = initialValues;
    }

    previousJobIdRef.current = job.id;
    previousStatusRef.current = job.status;
  }, [job?.id, job?.status]);

  // Helper function to get next status based on booking type
  const getNextStatusForType = (
    currentStatus: WorkflowStatus,
    bookingType?: 'itad_collection' | 'free_collection' | 'jml',
    jmlSubType?: 'new_starter' | 'leaver' | 'breakfix' | 'mover'
  ): WorkflowStatus | null => {
    // ITAD workflow
    if (!bookingType || bookingType === 'itad_collection') {
      // ITAD: booked → routed → en-route → arrived → collected (driver final status)
      // Warehouse technician/Admin handles: collected → warehouse → sanitised → graded
      const itadTransitions: Record<string, WorkflowStatus> = {
        'booked': 'routed',
        'routed': 'en-route',
        'en-route': 'arrived',
        'arrived': 'collected',
        // 'collected' has no next status for driver
      };
      return itadTransitions[currentStatus] || null;
    }
    
    // JML workflows
    // Drivers only handle ITAD collection jobs (JML jobs are handled by couriers)
    // JML workflows removed - drivers don't see JML jobs
    if (bookingType === 'jml') {
      // JML jobs are not accessible to drivers
      return null;
    }
    
    return null;
  };

  const nextStatus = useMemo((): WorkflowStatus | null => {
    if (!job) return null;
    return getNextStatusForType(job.status, job.bookingType, job.jmlSubType);
  }, [job?.status, job?.bookingType, job?.jmlSubType]);

  // Normalize status for comparison (handle both en-route and en_route)
  const normalizeStatus = (status: string) => {
    if (status === 'en-route' || status === 'en_route') return 'en-route';
    return status;
  };

  // ITAD driver workflow: only "collection complete" (→ collected) requires photos + signature.
  // En route and arrived are explicit status buttons without evidence.
  const statusesRequiringEvidence: WorkflowStatus[] = ['collected'];
  
  // Evidence is only required when advancing to "collected" (photos + customer signature).
  // Routed → en-route and en-route → arrived use status buttons only (no evidence).
  // Arrived → collected: save evidence for "collected" then move to collected in one step.
  const evidenceTargetStatus = useMemo(() => {
    if (!job || !nextStatus) return null;
    // Always submit evidence for the next status (if it requires evidence)
    if (statusesRequiringEvidence.includes(nextStatus)) {
      return nextStatus;
    }
    return null;
  }, [job?.status, nextStatus]);

  const currentStatusRequiresEvidence = useMemo(() => {
    if (!job || !nextStatus) return false;
    // Driver needs to submit evidence if the next status requires evidence
    return statusesRequiringEvidence.includes(nextStatus);
  }, [job?.status, nextStatus]);

  const canEditBase = useMemo(() => canDriverEditJob(job), [job]);

  // Redirect if job is beyond driver's editable range (warehouse, sanitised, graded, completed)
  // Silent redirect - no toast message
  useEffect(() => {
    if (job && !canEditBase) {
      // If this is the driver's final status, redirect to job history
      // Otherwise, redirect to job detail page
      if (isDriver && isDriverFinalStatus(job, job.status)) {
        navigate('/jobs/history', { replace: true });
      } else if (isDriver && (job.status === 'completed')) {
        // Completed jobs also go to history
        navigate('/jobs/history', { replace: true });
      } else {
        navigate(`/jobs/${job.id}`, { replace: true });
      }
    }
  }, [job, canEditBase, navigate, isDriver]);

  const evidenceForNextStatus = useMemo(() => {
    if (!job?.evidence || !evidenceTargetStatus) return null;
    
    const normalizedTarget = normalizeStatus(evidenceTargetStatus);
    
    if (Array.isArray(job.evidence)) {
      return job.evidence.find((ev: any) => {
        const evStatus = normalizeStatus(ev.status || '');
        return evStatus === normalizedTarget;
      }) || null;
    }
    // Single evidence object (backward compatibility)
    const evStatus = normalizeStatus((job.evidence as any).status || '');
    return evStatus === normalizedTarget ? job.evidence : null;
  }, [job?.evidence, evidenceTargetStatus]);

  const allEvidence = useMemo(() => {
    if (!job?.evidence) return [];
    if (Array.isArray(job.evidence)) {
      return job.evidence;
    }
    return [job.evidence];
  }, [job?.evidence]);

  const hasExistingEvidence = useMemo(() => {
    if (!evidenceForNextStatus) return false;
    
    return (
      (evidenceForNextStatus.photos && evidenceForNextStatus.photos.length > 0) ||
      evidenceForNextStatus.signature ||
      (evidenceForNextStatus.sealNumbers && evidenceForNextStatus.sealNumbers.length > 0) ||
      evidenceForNextStatus.notes
    );
  }, [evidenceForNextStatus]);
  
  // Driver can edit (submit evidence for next status) if:
  // 1. Job is in editable range (routed, en_route, arrived, collected)
  // 2. AND evidence for next status doesn't exist yet (if it exists, it's read-only)
  const canEdit = useMemo(() => {
    if (!canEditBase || !job) return false;
    // If evidence already exists for next status, driver can't edit (read-only)
    // If evidence doesn't exist for next status, driver can submit new evidence
    return !hasExistingEvidence;
  }, [canEditBase, hasExistingEvidence, job]);

  const jobAssetQuantitiesKey = useMemo(
    () => (job?.assets ?? []).map((a) => `${a.id}:${a.quantity}`).join("|"),
    [job?.assets]
  );

  useEffect(() => {
    if (!job || job.status !== "arrived") return;
    setAssetQtyDraft(Object.fromEntries(job.assets.map((a) => [a.id, a.quantity])));
    setExtraAssetLines([]);
  }, [job?.id, job?.status, jobAssetQuantitiesKey]);

  const bookedCategoryIds = useMemo(() => {
    return new Set(
      (job?.assets ?? [])
        .map((a) => a.categoryId || a.category)
        .filter((id): id is string => Boolean(id))
    );
  }, [job?.assets]);

  const getSelectableCategoriesForRow = (rowKey: string, rowCategoryId: string) => {
    const taken = new Set(bookedCategoryIds);
    extraAssetLines.forEach((line) => {
      if (line.key !== rowKey && line.categoryId) {
        taken.add(line.categoryId);
      }
    });
    return itadAssetCategories.filter((c) => !taken.has(c.id) || c.id === rowCategoryId);
  };

  const hasAssetQuantityDirty = useMemo(() => {
    if (!job || job.status !== "arrived") return false;
    const existingChanged = job.assets.some(
      (a) => (assetQtyDraft[a.id] ?? a.quantity) !== a.quantity
    );
    const hasValidNewLines = extraAssetLines.some(
      (line) => line.categoryId && line.quantity > 0
    );
    return existingChanged || hasValidNewLines;
  }, [job, assetQtyDraft, extraAssetLines]);

  // Evidence must have at least one photo AND signature to be valid
  // Driver can only save if: can edit, has photos/signature, and no evidence exists for current status yet
  // Signature validation: must be a non-empty string (base64 data URL)
  const hasValidSignature = signature && typeof signature === 'string' && signature.trim().length > 0 && signature.startsWith('data:');
  const canSave =
    canEdit &&
    currentStatusRequiresEvidence &&
    job?.status === "arrived" &&
    photos.length > 0 &&
    hasValidSignature &&
    !hasExistingEvidence &&
    !hasAssetQuantityDirty;

  // Early returns after all hooks
  if (isLoading || (isDriver && isLoadingDriverProfile)) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If driver is logged in but has no completed profile, block access to job work view
  if (isDriver && (!driverProfile || !driverProfile.hasProfile)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 space-y-4">
        <Alert className="max-w-md bg-warning/10 border-warning/20">
          <AlertDescription>
            Your driver profile is not complete yet. Please add your vehicle information in the Settings
            page before working on jobs.
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
          <Button variant="outline" onClick={() => navigate("/jobs")}>
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 space-y-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>Job not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/jobs")}>Back to Jobs</Button>
      </div>
    );
  }

  // If job is beyond driver's editable range, don't render the page (redirect will happen)
  if (!canEditBase) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  const handleSaveAndUpdateStatus = async () => {
    if (!id || !nextStatus) {
      toast.error("Cannot save evidence", {
        description: "No status transition available. Please update job status first.",
      });
      return;
    }

    // Validate that we have required evidence
    if (!canSave) {
      toast.error("Incomplete evidence", {
        description:
          "Please add at least one photo of the signed Transfer of Custody form (one photo per page if multi-page) and a customer signature.",
      });
      return;
    }

    // Double-check: Verify evidence doesn't already exist (prevent duplicate submissions)
    // This check uses the current job data which should be up-to-date
    if (hasExistingEvidence) {
      toast.error("Evidence already submitted", {
        description: `Evidence has already been submitted for status "${job?.status}". Please update the job status to proceed.`,
      });
      // Refetch to ensure UI is in sync
      refetchJob();
      return;
    }

    // Debug logging removed to avoid noisy console output
    // Save evidence for target status first, then update status to next
    if (!evidenceTargetStatus) {
      toast.error("Cannot save evidence", {
        description: "No target status for evidence submission.",
      });
      return;
    }

    updateEvidence.mutate(
      {
        jobId: id,
        evidence: {
          photos,
          signature: signature || undefined,
          sealNumbers,
          notes: notes || undefined,
          status: evidenceTargetStatus, // Submit evidence for target status (current or next depending on workflow)
        },
      },
      {
        onSuccess: () => {
          // After evidence is saved, update the job status
          updateStatus.mutate(
            { jobId: id, status: nextStatus },
            {
              onSuccess: () => {
                toast.success("Evidence saved and job status updated!", {
                  description: `Job status changed to ${nextStatus}.`,
                });
                // If this is the driver's final status, redirect to job history
                // Otherwise, redirect to schedule
                if (job && isDriverFinalStatus(job, nextStatus)) {
                  navigate('/jobs/history');
                } else {
                  navigate('/driver/schedule');
                }
              },
              onError: (error) => {
                toast.error("Evidence saved but failed to update job status", {
                  description: error instanceof Error ? error.message : "Please try again.",
                });
                // Still refetch to get updated evidence
                refetchJob();
              },
            }
          );
        },
        onError: (error) => {
          // Check if error is about existing evidence
          const errorMessage = error instanceof Error ? error.message : "Please try again.";
          if (errorMessage.includes("already been submitted")) {
            toast.error("Evidence already exists", {
              description: "Evidence for this status already exists. The page will refresh to show the current state.",
            });
            refetchJob();
          } else {
            toast.error("Failed to save evidence", {
              description: errorMessage,
            });
          }
        },
      }
    );
  };

  const handleStatusUpdate = async (newStatus: WorkflowStatus) => {
    if (!id) return;

    updateStatus.mutate(
      { jobId: id, status: newStatus },
      {
        onSuccess: () => {
          toast.success("Job status updated successfully!", {
            description: `Job status changed to ${newStatus}.`,
          });
          // Clear form when status updates (to allow evidence for new status)
          setPhotos([]);
          setSignature(null);
          setSealNumbers([]);
          setNotes("");
          setNewSealNumber("");
          // Refetch job data to update the UI immediately
          refetchJob();
        },
        onError: (error) => {
          toast.error("Failed to update job status", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleAddExtraAssetLine = () => {
    setExtraAssetLines((prev) => [
      ...prev,
      { key: `extra-${Date.now()}-${prev.length}`, categoryId: "", quantity: 1 },
    ]);
  };

  const handleSaveCollectedQuantities = async () => {
    if (!id || !job || job.status !== "arrived") return;

    const newLines = extraAssetLines.filter((line) => line.categoryId && line.quantity > 0);
    if (job.assets.length === 0 && newLines.length === 0) {
      toast.error("Add at least one category with a quantity before saving.");
      return;
    }

    const assets: Array<
      | { jobAssetId: string; quantity: number }
      | { categoryId: string; quantity: number }
    > = [
      ...job.assets.map((a) => ({
        jobAssetId: a.id,
        quantity: assetQtyDraft[a.id] ?? a.quantity,
      })),
      ...newLines.map((line) => ({
        categoryId: line.categoryId,
        quantity: line.quantity,
      })),
    ];

    try {
      await updateCollectedQuantities.mutateAsync({ jobId: id, assets });
      toast.success("Collected quantities saved", {
        description: "The asset list now matches what the client handed over.",
      });
      setExtraAssetLines([]);
      refetchJob();
    } catch (error) {
      toast.error("Failed to save quantities", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Mobile-optimized header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/driver/schedule')}
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">{job.organisationName}</h1>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {job.erpJobNumber}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 max-w-2xl mx-auto">
        {/* Collection details first so site / date / vehicle are visible without scrolling past forms */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Collection Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
            <div className="flex items-start gap-2 sm:gap-3">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-medium break-words">{job.siteName}</p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">{job.siteAddress}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
              <p className="text-xs sm:text-sm break-words">
                {new Date(job.scheduledDate).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            {job.driver && (
              <>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-mono break-all">{job.driver.vehicleReg}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs sm:text-sm break-all">{job.driver.phone}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {job.status === "booked" && nextStatus === "routed" && (
          <Card className="border-primary/30 bg-muted/30">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
                Ready to start
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                This collection has been assigned to you. Open the job when you are ready to enter journey details and depart.
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <Button
                type="button"
                size="lg"
                className="w-full text-sm sm:text-base"
                disabled={updateStatus.isPending}
                onClick={() => handleStatusUpdate("routed")}
              >
                {updateStatus.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Updating…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Start job
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Driver Journey Fields Form - Only show when status is routed */}
        {job.status === 'routed' && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Journey Information</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Enter the details below, then tap En route when you depart for the collection site.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="dial2Collection" className="text-sm sm:text-base">
                  DIAL 2 Collection <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dial2Collection"
                  placeholder="e.g., 1 Person, 2 or more persons"
                  value={dial2Collection}
                  onChange={(e) => setDial2Collection(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="securityRequirements" className="text-sm sm:text-base">
                  Security Requirements <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="securityRequirements"
                  placeholder="e.g., Security badge required at reception"
                  value={securityRequirements}
                  onChange={(e) => setSecurityRequirements(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="idRequired" className="text-sm sm:text-base">
                  ID Required <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="idRequired"
                  placeholder="e.g., Yes - Photo ID required"
                  value={idRequired}
                  onChange={(e) => setIdRequired(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="loadingBayLocation" className="text-sm sm:text-base">
                  Loading Bay Location <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="loadingBayLocation"
                  placeholder="e.g., Loading bay 3, rear entrance"
                  value={loadingBayLocation}
                  onChange={(e) => setLoadingBayLocation(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="vehicleHeightRestrictions" className="text-sm sm:text-base">
                  Vehicle Height Restrictions <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vehicleHeightRestrictions"
                  placeholder="e.g., Maximum height 3.5m"
                  value={vehicleHeightRestrictions}
                  onChange={(e) => setVehicleHeightRestrictions(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="doorLiftSize" className="text-sm sm:text-base">
                  Door & Lift Size <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="doorLiftSize"
                  placeholder="e.g., Standard loading bay doors, lift available"
                  value={doorLiftSize}
                  onChange={(e) => setDoorLiftSize(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="roadWorksPublicEvents" className="text-sm sm:text-base">
                  Road Works / Public Events <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="roadWorksPublicEvents"
                  placeholder="e.g., None reported"
                  value={roadWorksPublicEvents}
                  onChange={(e) => setRoadWorksPublicEvents(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="manualHandlingRequirements" className="text-sm sm:text-base">
                  Manual Handling Requirements <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="manualHandlingRequirements"
                  placeholder="e.g., Heavy items require two-person lift"
                  value={manualHandlingRequirements}
                  onChange={(e) => setManualHandlingRequirements(e.target.value)}
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              
              <Button
                onClick={async () => {
                  if (!id) return;

                  if (!areJourneyFieldsValid) {
                    toast.error("Please fill in all required fields", {
                      description: "All journey information fields are required before going en route.",
                    });
                    return;
                  }

                  const savedFields = {
                    dial2Collection: dial2Collection.trim(),
                    securityRequirements: securityRequirements.trim(),
                    idRequired: idRequired.trim(),
                    loadingBayLocation: loadingBayLocation.trim(),
                    vehicleHeightRestrictions: vehicleHeightRestrictions.trim(),
                    doorLiftSize: doorLiftSize.trim(),
                    roadWorksPublicEvents: roadWorksPublicEvents.trim(),
                    manualHandlingRequirements: manualHandlingRequirements.trim(),
                  };

                  try {
                    if (hasJourneyFieldsChanged) {
                      const updatedJob = await updateJourneyFields.mutateAsync({
                        jobId: id,
                        fields: savedFields,
                      });

                      setDial2Collection(updatedJob?.dial2Collection || savedFields.dial2Collection);
                      setSecurityRequirements(updatedJob?.securityRequirements || savedFields.securityRequirements);
                      setIdRequired(updatedJob?.idRequired || savedFields.idRequired);
                      setLoadingBayLocation(updatedJob?.loadingBayLocation || savedFields.loadingBayLocation);
                      setVehicleHeightRestrictions(
                        updatedJob?.vehicleHeightRestrictions || savedFields.vehicleHeightRestrictions
                      );
                      setDoorLiftSize(updatedJob?.doorLiftSize || savedFields.doorLiftSize);
                      setRoadWorksPublicEvents(updatedJob?.roadWorksPublicEvents || savedFields.roadWorksPublicEvents);
                      setManualHandlingRequirements(
                        updatedJob?.manualHandlingRequirements || savedFields.manualHandlingRequirements
                      );

                      initialJourneyFieldsRef.current = { ...savedFields };
                    }

                    await updateStatus.mutateAsync({ jobId: id, status: "en-route" });

                    toast.success("You're en route", {
                      description: "Journey information saved and status updated.",
                    });
                    refetchJob();
                  } catch (error) {
                    toast.error("Could not start journey", {
                      description: error instanceof Error ? error.message : "Please try again.",
                    });
                  }
                }}
                disabled={
                  updateJourneyFields.isPending || updateStatus.isPending || !areJourneyFieldsValid
                }
                className="w-full text-sm sm:text-base"
                size="lg"
              >
                {updateJourneyFields.isPending || updateStatus.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{updateJourneyFields.isPending ? "Saving…" : "Updating…"}</span>
                  </>
                ) : (
                  <>
                    <Navigation className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    <span>En route</span>
                  </>
                )}
              </Button>
              {!areJourneyFieldsValid && (
                <p className="text-xs text-muted-foreground text-center px-2">
                  Fill in all required fields before going en route.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {job.status === "en-route" && (
          <Card className="border-primary/30 bg-muted/30">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                At the site
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                When you reach the client, confirm you have arrived. You will then record what was collected and capture evidence.
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <Button
                type="button"
                size="lg"
                className="w-full text-sm sm:text-base"
                disabled={updateStatus.isPending}
                onClick={() => handleStatusUpdate("arrived")}
              >
                {updateStatus.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Updating…
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Arrived
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {job.status === "arrived" && (
          <>
            <Card className="border-muted">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                  What the client handed over
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Update quantities for booked items and add any extra categories the client hands over on the day. Save before taking photos and obtaining a signature.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
                {job.assets.length === 0 && extraAssetLines.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No items were booked for this job. Add categories below for what the client is handing over.
                  </p>
                )}
                {job.assets.map((asset) => (
                  <div key={asset.id} className="space-y-1.5">
                    <Label className="text-sm" htmlFor={`qty-${asset.id}`}>
                      {asset.categoryName || asset.category}
                    </Label>
                    <Input
                      id={`qty-${asset.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      className="text-sm sm:text-base max-w-[140px]"
                      value={assetQtyDraft[asset.id] ?? 0}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setAssetQtyDraft((prev) => ({
                          ...prev,
                          [asset.id]: Number.isNaN(v) ? 0 : Math.max(0, v),
                        }));
                      }}
                    />
                  </div>
                ))}

                {extraAssetLines.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-sm font-medium">Added on site</p>
                    {extraAssetLines.map((line) => {
                      const options = getSelectableCategoriesForRow(line.key, line.categoryId);
                      return (
                        <div
                          key={line.key}
                          className="flex flex-col sm:flex-row sm:items-end gap-3 p-3 rounded-lg border bg-muted/20"
                        >
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <Label className="text-sm">Category</Label>
                            <Select
                              value={line.categoryId || undefined}
                              onValueChange={(categoryId) =>
                                setExtraAssetLines((prev) =>
                                  prev.map((row) =>
                                    row.key === line.key ? { ...row, categoryId } : row
                                  )
                                )
                              }
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">Qty</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={1}
                              className="text-sm sm:text-base w-[100px]"
                              value={line.quantity}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                setExtraAssetLines((prev) =>
                                  prev.map((row) =>
                                    row.key === line.key
                                      ? {
                                          ...row,
                                          quantity: Number.isNaN(v) ? 1 : Math.max(1, v),
                                        }
                                      : row
                                  )
                                );
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 self-end text-muted-foreground hover:text-destructive"
                            aria-label="Remove line"
                            onClick={() =>
                              setExtraAssetLines((prev) =>
                                prev.filter((row) => row.key !== line.key)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleAddExtraAssetLine}
                  disabled={
                    itadAssetCategories.length <=
                    bookedCategoryIds.size + extraAssetLines.filter((l) => l.categoryId).length
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add category
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  disabled={!hasAssetQuantityDirty || updateCollectedQuantities.isPending}
                  onClick={handleSaveCollectedQuantities}
                >
                  {updateCollectedQuantities.isPending ? (
                    <>
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save quantities
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* View-Only Mode Alert - evidence already saved for collection complete */}
            {hasExistingEvidence && evidenceTargetStatus && canEditBase && (
              <Alert className="bg-success/10 border-success/20 p-3 sm:p-4">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  Evidence for collection complete has been saved. You can review it below, then mark the job as collected when ready.
                </AlertDescription>
              </Alert>
            )}

            {/* Evidence Requirements Info */}
            {canEdit && currentStatusRequiresEvidence && !hasExistingEvidence && evidenceTargetStatus && (
              <Alert className="bg-primary/10 border-primary/20 p-3 sm:p-4">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  <strong>Evidence required:</strong> Photograph the signed Transfer of Custody form (add one photo per page if it has multiple pages), then capture the customer&apos;s signature before you mark collection complete.
                </AlertDescription>
              </Alert>
            )}

            {/* Evidence Submission Status */}
            {hasExistingEvidence && nextStatus && canEdit && evidenceTargetStatus && (
              <Alert className="bg-success/10 border-success/20 p-3 sm:p-4">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  Evidence has been saved. Tap below to mark the job as <strong>collected</strong> and finish your part of the journey.
                </AlertDescription>
              </Alert>
            )}

            {/* Photo Capture */}
            <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              Signed Transfer of Custody (TOC)
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Photograph the signed physical TOC. If the form has more than one page, add a separate photo for each page — they are saved together as one document.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {/* Show submitted evidence for NEXT status if it exists (read-only), otherwise show form */}
            {hasExistingEvidence ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Submitted Photos for {evidenceTargetStatus || nextStatus}:
                </p>
                {evidenceForNextStatus?.photos && evidenceForNextStatus.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {evidenceForNextStatus.photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Transfer of Custody page ${index + 1}`}
                        className="w-full h-32 object-cover rounded border"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos submitted</p>
                )}
              </div>
            ) : canEdit && currentStatusRequiresEvidence ? (
              <PhotoCapture
                photos={photos}
                onPhotosChange={setPhotos}
                maxPhotos={10}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No evidence required for this status</p>
            )}
          </CardContent>
        </Card>

        {/* Signature Capture */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <PenTool className="h-4 w-4 sm:h-5 sm:w-5" />
              Client signature <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>
              Have the customer sign on device to confirm handover. A signature is required before collection can be marked complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {/* Show submitted evidence for NEXT status if it exists (read-only), otherwise show form */}
            {hasExistingEvidence ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Submitted Signature for {evidenceTargetStatus || nextStatus}:
                </p>
                {evidenceForNextStatus?.signature ? (
                  <img
                    src={evidenceForNextStatus.signature}
                    alt="Customer signature"
                    className="w-full max-w-xs border rounded"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No signature submitted</p>
                )}
              </div>
            ) : canEdit && currentStatusRequiresEvidence ? (
              <SignatureCapture
                signature={signature}
                onSignatureChange={setSignature}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No signature required for this status</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {/* Show submitted evidence for NEXT status if it exists (read-only), otherwise show form */}
            {hasExistingEvidence ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Submitted Notes for {evidenceTargetStatus || nextStatus}:
                </p>
                <p className="text-sm whitespace-pre-wrap">{evidenceForNextStatus?.notes || "No notes provided"}</p>
              </div>
            ) : canEdit && currentStatusRequiresEvidence ? (
              <Textarea
                placeholder="Add any additional notes or observations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No notes required for this status</p>
            )}
          </CardContent>
        </Card>

        {/* Save evidence and mark collected — only after quantities match saved state */}
        {!hasExistingEvidence && currentStatusRequiresEvidence && canEdit && nextStatus && job.status === "arrived" && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t pt-3 pb-3 sm:pt-4 sm:pb-4 -mx-3 sm:-mx-4 px-3 sm:px-4">
            <Button
              onClick={handleSaveAndUpdateStatus}
              disabled={
                !canSave || 
                updateEvidence.isPending || 
                updateStatus.isPending
              }
              className="w-full text-sm sm:text-base"
              size="lg"
            >
              {updateEvidence.isPending || updateStatus.isPending ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">
                  {updateEvidence.isPending ? "Saving evidence..." : "Updating status..."}
                  </span>
                  <span className="sm:hidden">
                    {updateEvidence.isPending ? "Saving..." : "Updating..."}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">
                  Save signature &amp; complete collection
                  </span>
                  <span className="sm:hidden">
                    Complete collection
                  </span>
                </>
              )}
            </Button>
            {!canSave && evidenceTargetStatus && (
              <p className="text-xs text-muted-foreground text-center mt-2 px-2">
                {hasAssetQuantityDirty
                  ? "Save collected quantities first, then add TOC photos (one per page) and the customer signature."
                  : "Add at least one photo of the signed TOC (one photo per page if multi-page) and the customer signature to complete collection."}
              </p>
            )}
            {canSave && evidenceTargetStatus && (
              <p className="text-xs text-muted-foreground text-center mt-2 px-2">
                This saves your TOC photos as one document plus signature evidence, then marks the job collected. Your collection journey is then complete.
              </p>
            )}
          </div>
        )}

        {/* Status Update Only (if evidence already exists for next status) */}
        {hasExistingEvidence && nextStatus && canEditBase && job.status === "arrived" && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground mb-1 text-sm sm:text-base">Finish collection</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Evidence is saved. Mark the job as collected to hand off to the warehouse team.
                  </p>
                </div>
                <Button
                  onClick={() => handleStatusUpdate(nextStatus)}
                  disabled={updateStatus.isPending}
                  size="lg"
                  className="w-full sm:w-auto text-sm sm:text-base"
                >
                  {updateStatus.isPending ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="ml-2">Updating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="ml-2 hidden sm:inline">Mark as collected</span>
                      <span className="ml-2 sm:hidden">Mark collected</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverJobView;

