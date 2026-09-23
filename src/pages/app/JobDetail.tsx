import { useState, useRef, type InputHTMLAttributes } from "react";
import type { ParsedJmlDevice } from "@/lib/jml-booking-device-details";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  User, 
  Truck, 
  Route,
  Phone,
  FileText,
  Download,
  Leaf,
  Scale,
  Smartphone,
  Loader2,
  Camera,
  PenTool,
  Tag,
  Lock,
  FileCheck,
  CheckCircle2,
  Package,
  AlertCircle,
  Upload,
  Pencil,
  ChevronDown,
  Folder,
  Files
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkflowTimeline } from "@/components/jobs/WorkflowTimeline";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { BookingTypeBadge } from "@/components/bookings/BookingTypeBadge";
import { BuybackEstimateDisclaimer } from "@/components/booking/BuybackEstimateDisclaimer";
import { co2eEquivalencies, getWorkflowStatusLabel } from "@/lib/constants";
import type { Evidence, WorkflowStatus } from "@/types/jobs";
import {
  useJob,
  useReassignDriver,
  useUpdateJobBuyback,
  useUpdateCostOfServiceTotal,
} from "@/hooks/useJobs";
import { useJobDocuments } from "@/hooks/useJobDocuments";
import { useAssetCategories } from "@/hooks/useAssets";
import { useDrivers } from "@/hooks/useDrivers";
import { useBooking } from "@/hooks/useBookings";
import { useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { canDriverEditJob } from "@/utils/job-helpers";
import { getAuthenticatedFileUrl } from "@/utils/file-url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsService, type CompletionDocumentType } from "@/services/documents.service";
import { Input } from "@/components/ui/input";
import { log } from '@/lib/log';
import { UK_TIME_ZONE } from '@/lib/datetime';
import {
  COMPLETION_DOC_ACCEPT,
  MAX_COMPLETION_UPLOAD_FILES,
  filterCompletionUploadFiles,
} from "@/lib/completion-upload";
import { isAdminLikeRole } from '@/lib/roles';

function formatGbp(amount: number, withDecimals = true): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(amount);
}

function formatStoredDocumentType(type: string): string {
  const labels: Record<string, string> = {
    "chain-of-custody": "Chain of custody",
    toc: "Transfer of Custody",
    certificate: "Certificate",
    "grading-report": "Grading report",
    other: "Document",
  };
  return labels[type] || type.replace(/-/g, " ");
}

const JobDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: job, isLoading, error } = useJob(id);
  const { data: assetCategories } = useAssetCategories();
  const { data: drivers = [] } = useDrivers();
  const reassignDriver = useReassignDriver();
  const updateJobBuyback = useUpdateJobBuyback();
  const updateCostOfServiceTotal = useUpdateCostOfServiceTotal();
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [editingBuyback, setEditingBuyback] = useState(false);
  const [buybackDraft, setBuybackDraft] = useState("");
  const [editingCostOfService, setEditingCostOfService] = useState(false);
  const [costOfServiceDraft, setCostOfServiceDraft] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const queryClient = useQueryClient();
  const { data: jobDocuments = [], isLoading: loadingJobDocuments } = useJobDocuments(id);
  const [uploadDocType, setUploadDocType] = useState<CompletionDocumentType>("certificate");
  const [uploadDocName, setUploadDocName] = useState("");
  const completionFileInputRef = useRef<HTMLInputElement>(null);
  const completionFolderInputRef = useRef<HTMLInputElement>(null);

  const uploadCompletionMutation = useMutation({
    mutationFn: ({ files }: { files: File[] }) =>
      documentsService.uploadJobDocument(id!, files, uploadDocType, uploadDocName || undefined),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["documents", "job", id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (job?.bookingId) {
        queryClient.invalidateQueries({ queryKey: ["documents", "booking", job.bookingId] });
      }
      const n = Array.isArray(created) ? created.length : 1;
      toast.success(n === 1 ? "Document uploaded" : `${n} documents uploaded`);
      setUploadDocName("");
      if (completionFileInputRef.current) completionFileInputRef.current.value = "";
      if (completionFolderInputRef.current) completionFolderInputRef.current.value = "";
    },
    onError: (e: Error) => toast.error(e.message || "Upload failed"),
  });

  const queueCompletionUpload = (rawFiles: FileList | File[], fromFolder: boolean) => {
    const totalPicked = Array.from(rawFiles).length;
    const files = filterCompletionUploadFiles(rawFiles);
    const skipped = totalPicked - files.length;

    if (files.length === 0) {
      toast.error(
        fromFolder
          ? "No allowed files in that folder (PDF, images, Excel, CSV, TXT, or ZIP)"
          : "No allowed files selected"
      );
      return;
    }

    if (files.length > MAX_COMPLETION_UPLOAD_FILES) {
      toast.error(
        `Too many files (${files.length}). Upload at most ${MAX_COMPLETION_UPLOAD_FILES} at once.`
      );
      return;
    }

    if (skipped > 0) {
      toast.message(
        `Skipped ${skipped} unsupported file${skipped === 1 ? "" : "s"}; uploading ${files.length}.`
      );
    }

    uploadCompletionMutation.mutate({ files });
  };

  // Fetch booking if bookingId exists to get device details from status history
  const { data: booking } = useBooking(job?.bookingId || null);
  
  // Extract device details from booking status history notes
  const deviceDetailsMap = useMemo(() => {
    const map = new Map<string, { make: string; model: string; deviceType?: string }>();
    
    if (!booking) return map;
    
    // Type assertion: statusHistory exists in API response but not in type definition
    const statusHistory = booking.statusHistory as Array<{
      id: string;
      status: string;
      changedBy?: string;
      notes?: string;
      createdAt: string;
    }> | undefined;
    
    if (statusHistory && statusHistory.length > 0) {
      const creationHistory = statusHistory.find(h => 
        h.notes && h.notes.includes('Device details:')
      );
      
      if (creationHistory && creationHistory.notes) {
        try {
            const deviceDetailsMatch = creationHistory.notes.match(/Device details:\s*(\[.*?\])/);
          if (deviceDetailsMatch) {
            const deviceDetails = JSON.parse(deviceDetailsMatch[1]);
            deviceDetails.forEach((device: ParsedJmlDevice) => {
              // Use category name as key, store device info
              map.set(device.category, {
                make: device.make,
                model: device.model,
                deviceType: device.deviceType,
              });
            });
          }
        } catch (error) {
          // If parsing fails, return empty map
          log.error('Failed to parse device details from booking status history:', error);
        }
      }
    }
    
    return map;
  }, [booking]);

  // For breakfix bookings, extract replacement requirements as well as broken device details.
  const replacementDeviceDetails = useMemo(() => {
    const empty: ParsedJmlDevice[] = [];
    if (!booking) return empty;

    const statusHistory = booking.statusHistory as Array<{
      notes?: string;
    }> | undefined;

    if (!statusHistory || statusHistory.length === 0) return empty;

    const creationHistory = statusHistory.find((h) => h.notes && h.notes.includes('Replacement Device details:'));
    if (!creationHistory?.notes) return empty;

    try {
      const replacementMatch = creationHistory.notes.match(/Replacement Device details:\s*(\[.*?\])/i);
      if (!replacementMatch) return empty;
      return JSON.parse(replacementMatch[1]);
    } catch {
      return empty;
    }
  }, [booking]);

  const isBreakfixBooking = job?.bookingType === 'jml' && job?.jmlSubType === 'breakfix';

  // Helper function to check if Device Type should be shown for a category
  const shouldShowDeviceType = (category: string): boolean => {
    const categoryLower = category.toLowerCase();
    // Only show Device Type for categories where Windows/Apple distinction is meaningful
    // Hide for: Smart Phones, Tablets, networking categories, Server, Storage (no Windows/Apple)
    return categoryLower.includes('laptop') || categoryLower.includes('desktop');
  };

  // Enrich assets with device details
  const enrichedAssets = useMemo(() => {
    if (!job?.assets) return [];
    return job.assets.map(asset => {
      const categoryName = asset.categoryName || asset.category;
      const deviceInfo = deviceDetailsMap.get(categoryName);
      const showDeviceType = shouldShowDeviceType(categoryName);
      return {
        ...asset,
        deviceMake: deviceInfo?.make,
        deviceModel: deviceInfo?.model,
        deviceType: showDeviceType ? deviceInfo?.deviceType : undefined,
      };
    });
  }, [job?.assets, deviceDetailsMap]);

  const totalBuybackAfterCharity = useMemo(() => {
    if (!job) return 0;
    return job.buybackValue * (1 - job.charityPercent / 100);
  }, [job]);

  const totalClientResponsibility = useMemo(() => {
    if (
      !job ||
      job.costOfServiceTotal == null ||
      !Number.isFinite(job.costOfServiceTotal)
    ) {
      return null;
    }
    return job.costOfServiceTotal - totalBuybackAfterCharity;
  }, [job, totalBuybackAfterCharity]);
  
  // Filter out drivers without allocated vehicles
  const driversWithVehicles = drivers.filter(driver => driver.hasVehicle && (driver.vehicleReg || (driver.vehicles && driver.vehicles.length > 0)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {error ? "Failed to load job details." : "Job not found"}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to="/jobs" className="text-inherit no-underline">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  // log.debug(job.assets);

  const totalAssets = job.assets.reduce((sum, a) => sum + a.quantity, 0);
  const netCO2e = job.co2eSaved - job.travelEmissions;
  
  // Use actual round trip distance from booking if available
  // Do not use travelEmissions / emissionsPerKm as fallback - this is inaccurate
  let roundTripDistanceKm = 0;
  let roundTripDistanceMiles = 0;
  
  if (job.roundTripDistanceKm && job.roundTripDistanceKm > 0) {
    // Use actual distance from booking (calculated at booking creation)
    roundTripDistanceKm = job.roundTripDistanceKm;
    roundTripDistanceMiles = job.roundTripDistanceMiles || (roundTripDistanceKm * 0.621371);
  }
  // If distance is not available, leave it as 0 to show error/warning in UI

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <Button variant="ghost" size="sm" asChild className="-ml-2 self-start sm:self-auto">
          <Link to="/jobs" className="text-inherit no-underline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Jobs
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h2 className="text-2xl font-bold text-foreground">{job.organisationName}</h2>
            <BookingTypeBadge 
              bookingType={job.bookingType} 
              jmlSubType={job.jmlSubType}
              size="sm"
            />
            <JobStatusBadge status={job.status} bookingType={job.bookingType} />
          </div>
          <p className="text-muted-foreground font-mono">{job.erpJobNumber}</p>
        </div>
      </motion.div>

      {/* Workflow Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowTimeline 
            currentStatus={job.status} 
            bookingType={job.bookingType}
            jmlSubType={job.jmlSubType}
          />
        </CardContent>
      </Card>

      <div className={`grid gap-6 ${user?.role === 'driver' ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
            {/* Left Column - Details */}
            <div className={`${user?.role === 'driver' ? '' : 'lg:col-span-2'} space-y-6 flex flex-col`}>
          {/* Collection Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Collection Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {job.jmlSubType === 'mover' && job.currentAddress ? (
                  <>
                    {/* Current Address (From) */}
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">From (Collection)</p>
                        <p className="font-medium">{job.currentSiteName || 'Current Address'}</p>
                        <p className="text-sm text-muted-foreground">{job.currentAddress}</p>
                        {job.currentPostcode && (
                          <p className="text-xs text-muted-foreground mt-0.5">{job.currentPostcode}</p>
                        )}
                      </div>
                    </div>
                    {/* New Address (To) */}
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">To (Delivery)</p>
                        <p className="font-medium">{job.siteName}</p>
                        <p className="text-sm text-muted-foreground">{job.siteAddress}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{job.siteName}</p>
                      <p className="text-sm text-muted-foreground">{job.siteAddress}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scheduled Date</p>
                    <p className="font-medium">
                      {new Date(job.scheduledDate).toLocaleDateString("en-GB", { timeZone: UK_TIME_ZONE,
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Round Trip Mileage</p>
                  </div>
                  {roundTripDistanceKm > 0 ? (
                    <p className="text-lg font-bold">
                      {roundTripDistanceMiles.toFixed(1)} miles ({roundTripDistanceKm.toFixed(1)} km)
                    </p>
                  ) : (
                    <p className="text-lg font-bold text-warning">0 km</p>
                  )}
                </div>
                {roundTripDistanceKm > 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    From collection site to warehouse and return
                  </p>
                ) : (
                  <p className="text-xs text-warning mt-1">
                    ⚠️ Distance data unavailable. Distance calculation may have failed.
                  </p>
                )}
              </div>

              {job.driver && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">Driver Assignment</p>
                    <div className="flex gap-2">
                      {/* Re-assign driver button (admin only, only for routed status) */}
                      {isAdminLikeRole(user?.role) && job.status === 'routed' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedDriverId(job.driver?.id || "");
                            setIsReassignDialogOpen(true);
                          }}
                          disabled={reassignDriver.isPending}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Re-assign Driver
                        </Button>
                      )}
                      {/* Only show Driver View button to driver role, and only if job is editable */}
                      {user?.role === 'driver' && canDriverEditJob(job) && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/driver/jobs/${job.id}`} className="text-inherit no-underline">
                            <Smartphone className="h-4 w-4 mr-2" />
                            Driver View
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{job.driver.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{job.driver.vehicleReg}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{job.driver.phone}</span>
                    </div>
                    {job.driver.vehicleType && (
                      <Badge variant="outline" className="text-xs">
                        {job.driver.vehicleType}
                        {job.driver.vehicleFuelType && ` • ${job.driver.vehicleFuelType}`}
                      </Badge>
                    )}
                    {(job.status === "routed" || job.status === "en-route") && (
                      <Badge 
                        variant="secondary" 
                        className={job.driver.isEtaDelayed 
                          ? "bg-destructive/20 text-destructive border-destructive/50" 
                          : "bg-warning/20 text-warning-foreground"
                        }
                      >
                        ETA: {job.driver.eta || "--:--"}
                        {job.driver.isEtaDelayed && " (Delayed)"}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isBreakfixBooking ? `Broken Devices (Assets) (${totalAssets})` : `Assets (${totalAssets})`}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {enrichedAssets.map((asset) => {
                  // Try to find category by ID first, then by name
                  const category = assetCategories?.find(
                    (c) => c.id === (asset.categoryId || asset.category) || c.name === (asset.categoryName || asset.category)
                  );
                  return (
                    <div
                      key={asset.id}
                      className="p-3 rounded-lg bg-secondary/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{category?.icon || '📦'}</span>
                          <div>
                            <p className="font-medium">{category?.name || asset.categoryName || asset.category}</p>
                            <p className="text-sm text-muted-foreground">
                              {asset.quantity} units
                              {asset.weight && ` • ${asset.weight}kg`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {asset.grade && (
                            <Badge variant="outline">Grade {asset.grade}</Badge>
                          )}
                          {asset.sanitised && (
                            <Badge variant="secondary" className="bg-success/10 text-success">
                              Sanitised
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Device details (if available) */}
                      {asset.deviceMake || asset.deviceModel ? (
                        <div className="pl-10 text-xs text-muted-foreground flex flex-wrap gap-x-1">
                          {asset.deviceMake && <span>{asset.deviceMake}</span>}
                          {asset.deviceModel && (
                            <>
                              {asset.deviceMake && <span>•</span>}
                              <span>{asset.deviceModel}</span>
                            </>
                          )}
                          {asset.deviceType && (
                            <>
                              {(asset.deviceMake || asset.deviceModel) && <span>•</span>}
                              <span>{asset.deviceType}</span>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Replacement device requirements (Breakfix only) */}
          {isBreakfixBooking && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Replacement Device Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {replacementDeviceDetails.length > 0 ? (
                    replacementDeviceDetails.map((device: ParsedJmlDevice, index: number) => {
                      const category = assetCategories?.find(
                        (c) =>
                          c.name === device.category ||
                          c.id === device.category ||
                          String(c.name).toLowerCase() === String(device.category).toLowerCase()
                      );

                      const deviceInfo =
                        [device.make, device.model, device.deviceType].filter(Boolean).join(' • ') ||
                        (device.notes?.trim() ? device.notes.trim() : 'Accessories');

                      return (
                        <div key={index} className="p-3 rounded-lg bg-secondary/50 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{category?.name || device.category}</span>
                            </div>
                            <Badge variant="secondary">{device.quantity} units</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{deviceInfo}</div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No replacement device requirements found.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Summary */}
        {user?.role !== 'driver' && (
          <div className="space-y-6 flex flex-col">
            {/* CO2e Impact */}
            <Card className="bg-gradient-eco border-primary/20 flex-shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-primary" />
                  Environmental Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">CO₂e Saved</p>
                  <p className="text-2xl font-bold text-success">
                    {(job.co2eSaved / 1000).toFixed(2)}t
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Travel Emissions</p>
                  <p className="text-lg font-semibold text-destructive">
                    -{job.travelEmissions}kg
                  </p>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground">Net Benefit</p>
                  <p className="text-2xl font-bold text-primary">
                    {(netCO2e / 1000).toFixed(2)}t
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {co2eEquivalencies.treesPlanted(netCO2e)} trees planted
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="flex-shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div
                  className={cn(
                    "flex justify-between gap-3",
                    editingBuyback ? "items-start" : "items-center"
                  )}
                >
                  <span className="text-muted-foreground shrink-0 pt-0.5">
                    Buyback
                  </span>
                  {!editingBuyback ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-semibold tabular-nums">
                        {formatGbp(job.buybackValue, false)}
                      </span>
                      {isAdminLikeRole(user?.role) &&
                        job.status === "completed" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground/75 hover:text-foreground hover:bg-muted/70 active:scale-[0.97] transition-all duration-200"
                            onClick={() => {
                              setBuybackDraft(String(job.buybackValue));
                              setEditingBuyback(true);
                            }}
                            aria-label="Edit buyback"
                            title="Edit buyback"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-[9.5rem] text-right h-9 transition-shadow duration-200 focus-visible:ring-2"
                        value={buybackDraft}
                        onChange={(e) => setBuybackDraft(e.target.value)}
                        aria-label="Buyback value in pounds"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => {
                            setEditingBuyback(false);
                            setBuybackDraft(String(job.buybackValue));
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-4 min-w-[4.5rem] transition-all duration-200"
                          disabled={updateJobBuyback.isPending}
                          onClick={async () => {
                            const n = parseFloat(buybackDraft);
                            if (!Number.isFinite(n) || n < 0) {
                              toast.error("Enter a valid non-negative amount");
                              return;
                            }
                            try {
                              await updateJobBuyback.mutateAsync({
                                jobId: id!,
                                buybackValue: n,
                              });
                              setEditingBuyback(false);
                              toast.success("Buyback total updated");
                            } catch (e: unknown) {
                              toast.error(
                                e instanceof Error ? e.message : "Update failed"
                              );
                            }
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <BuybackEstimateDisclaimer />

                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Charity</span>
                  <span className="font-semibold tabular-nums">{job.charityPercent}%</span>
                </div>

                <div className="flex justify-between gap-3 pt-1 border-t border-border/80">
                  <span className="font-medium text-foreground">Total buyback</span>
                  <span className="font-semibold tabular-nums">
                    {formatGbp(totalBuybackAfterCharity)}
                  </span>
                </div>

                <div className="space-y-2 pt-1 border-t border-border/80">
                  <div
                    className={cn(
                      "flex justify-between gap-3",
                      editingCostOfService ? "items-start" : "items-center"
                    )}
                  >
                    <span className="font-medium text-foreground shrink-0 pt-0.5">
                      Cost of Service
                    </span>
                    {!editingCostOfService ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-semibold tabular-nums">
                          {job.costOfServiceTotal != null &&
                          Number.isFinite(job.costOfServiceTotal)
                            ? formatGbp(job.costOfServiceTotal)
                            : "—"}
                        </span>
                        {isAdminLikeRole(user?.role) &&
                          job.status === "completed" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground/75 hover:text-foreground hover:bg-muted/70 active:scale-[0.97] transition-all duration-200"
                              onClick={() => {
                                setCostOfServiceDraft(
                                  job.costOfServiceTotal != null &&
                                    Number.isFinite(job.costOfServiceTotal)
                                    ? String(job.costOfServiceTotal)
                                    : "0"
                                );
                                setEditingCostOfService(true);
                              }}
                              aria-label="Edit cost of service"
                              title="Edit cost of service"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-[9.5rem] text-right h-9 transition-shadow duration-200 focus-visible:ring-2"
                          value={costOfServiceDraft}
                          onChange={(e) => setCostOfServiceDraft(e.target.value)}
                          aria-label="Cost of service in pounds"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => {
                              setEditingCostOfService(false);
                              setCostOfServiceDraft(
                                job.costOfServiceTotal != null &&
                                  Number.isFinite(job.costOfServiceTotal)
                                  ? String(job.costOfServiceTotal)
                                  : ""
                              );
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-4 min-w-[4.5rem] transition-all duration-200"
                            disabled={updateCostOfServiceTotal.isPending}
                            onClick={async () => {
                              const n = parseFloat(costOfServiceDraft);
                              if (!Number.isFinite(n) || n < 0) {
                                toast.error("Enter a valid non-negative amount");
                                return;
                              }
                              try {
                                await updateCostOfServiceTotal.mutateAsync({
                                  jobId: id!,
                                  costOfServiceTotal: n,
                                });
                                setEditingCostOfService(false);
                                toast.success("Cost of service updated");
                              } catch (e: unknown) {
                                toast.error(
                                  e instanceof Error ? e.message : "Update failed"
                                );
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {(job.costOfServiceAdjustment ?? 0) !== 0 && (
                    <div className="text-xs text-muted-foreground">
                      <div className="flex justify-between gap-2">
                        <span>Adjustment</span>
                        <span className="tabular-nums">
                          {formatGbp(job.costOfServiceAdjustment ?? 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-3 pt-2 border-t border-border font-semibold">
                  <span>Total Client Responsibility</span>
                  <span className="tabular-nums text-base">
                    {totalClientResponsibility != null &&
                    Number.isFinite(totalClientResponsibility)
                      ? formatGbp(totalClientResponsibility)
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

          {/* Evidence Review (Admin only) */}
          {isAdminLikeRole(user?.role) && (
            <Card className="border-border/50 flex flex-col h-full">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2 min-w-0">
                    <FileCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="truncate">Collection Evidence</span>
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal flex-shrink-0">
                    <Lock className="h-3 w-3 mr-1" />
                    Immutable
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                {(() => {
                  // Handle both array and single evidence (backward compatibility)
                  // Also handle null/undefined cases
                  let evidenceList: Evidence[] = [];
                  
                  if (job.evidence) {
                    if (Array.isArray(job.evidence)) {
                      evidenceList = job.evidence;
                    } else if (typeof job.evidence === 'object') {
                      // Single evidence object (backward compatibility)
                      evidenceList = [{ ...job.evidence, status: job.evidence.status || job.status }];
                    }
                  }

                  // Sort evidence by workflow order for better UX
                  const workflowOrder: Record<string, number> = {
                    'en-route': 1,
                    'en_route': 1,
                    'arrived': 2,
                    'collected': 3,
                    'warehouse': 4,
                    'sanitised': 6,
                    'graded': 7,
                    'completed': 8,
                    'booked': 0,
                    'routed': 0,
                  };
                  
                  evidenceList.sort((a, b) => {
                    const orderA = workflowOrder[a.status] ?? 999;
                    const orderB = workflowOrder[b.status] ?? 999;
                    return orderA - orderB;
                  });

                  const getEvidenceStatusLabel = (status: string) => {
                    const normalized = status === 'en_route' ? 'en-route' : status;
                    return getWorkflowStatusLabel(normalized as WorkflowStatus, job.bookingType);
                  };

                  // Normalize status for comparison (handle both en-route and en_route, etc.)
                  const normalizeStatus = (status: string) => {
                    if (status === 'en_route') return 'en-route';
                    return status;
                  };
                  const statusesWithEvidence = new Set(
                    evidenceList.map((ev) => normalizeStatus(ev.status || ''))
                  );
                  
                  // Get required statuses based on booking type
                  const getRequiredStatuses = (): string[] => {
                    const bookingType = job.bookingType;
                    const jmlSubType = job.jmlSubType;
                    
                    // ITAD and Leaver: en-route, arrived, collected, warehouse
                    if (!bookingType || bookingType === 'itad_collection' || (bookingType === 'jml' && jmlSubType === 'leaver')) {
                      return ['en-route', 'arrived', 'collected', 'warehouse'];
                    }
                    
                    // New Starter: device-allocated, courier-booked, dispatched, delivered (courier-based)
                    if (bookingType === 'jml' && jmlSubType === 'new_starter') {
                      return ['device-allocated', 'courier-booked', 'dispatched', 'delivered'];
                    }
                    
                    // Mover: courier-booked, dispatched, collected, warehouse, inventory, device-allocated, delivery-courier-booked, delivery-dispatched, delivered
                    if (bookingType === 'jml' && jmlSubType === 'mover') {
                      return ['courier-booked', 'dispatched', 'collected', 'warehouse', 'inventory', 'device-allocated', 'delivery-courier-booked', 'delivery-dispatched', 'delivered'];
                    }
                    
                    // Breakfix: device-allocated, courier-booked, dispatched, delivered, collected, warehouse, sanitised, graded, inventory
                    if (bookingType === 'jml' && jmlSubType === 'breakfix') {
                      return ['device-allocated', 'courier-booked', 'dispatched', 'delivered', 'collected', 'warehouse', 'sanitised', 'graded'];
                    }
                    
                    // Default: ITAD workflow
                    return ['en-route', 'arrived', 'collected', 'warehouse'];
                  };
                  
                  const requiredStatuses = getRequiredStatuses();

                  if (evidenceList.length === 0) {
                    return (
                      <div className="py-8 text-center">
                        <FileCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          No evidence submitted yet
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col h-full min-h-0 space-y-3">
                      {/* Compact Summary */}
                      <div className="p-3 bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg border border-border/50 flex-shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-foreground">Status Summary</p>
                          <Badge variant="secondary" className="text-xs">
                            {evidenceList.length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {requiredStatuses.map((status) => {
                            const hasEvidence = statusesWithEvidence.has(status);
                            return (
                              <div
                                key={status}
                                className={`flex items-center gap-1.5 p-1.5 rounded border transition-colors ${
                                  hasEvidence
                                    ? 'bg-success/10 border-success/20 text-success'
                                    : 'bg-muted/30 border-border/50 text-muted-foreground'
                                }`}
                              >
                                <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${hasEvidence ? 'bg-success' : 'bg-muted-foreground/30'}`} />
                                <span className="text-xs font-medium truncate">{getEvidenceStatusLabel(status)}</span>
                                {hasEvidence && (
                                  <CheckCircle2 className="h-3 w-3 ml-auto flex-shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Compact Accordion with scroll */}
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <Accordion type="single" collapsible className="w-full space-y-1.5">
                        {evidenceList.map((evidence, idx: number) => {
                          const statusLabel = getEvidenceStatusLabel(normalizeStatus(evidence.status || '')) || 'Unknown';
                          const evidenceKey = `${job.id}-${evidence.status}-${idx}`;
                          const isCurrentStatusEvidence = normalizeStatus(evidence.status || '') === normalizeStatus(job.status);
                          
                          // Count evidence items
                          const hasPhotos = evidence.photos && evidence.photos.length > 0;
                          const hasSignature = !!evidence.signature;
                          const hasSealNumbers = evidence.sealNumbers && evidence.sealNumbers.length > 0;
                          const hasNotes = !!evidence.notes;
                          const itemCount = [hasPhotos, hasSignature, hasSealNumbers, hasNotes].filter(Boolean).length;
                          
                          const submissionDate = evidence.createdAt 
                            ? new Date(evidence.createdAt).toLocaleDateString('en-GB', { timeZone: UK_TIME_ZONE, 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : null;
                          
                          return (
                            <AccordionItem 
                              key={evidenceKey} 
                              value={evidenceKey} 
                              className={`border rounded-md overflow-hidden transition-colors ${
                                isCurrentStatusEvidence 
                                  ? 'border-primary/50 bg-primary/5 hover:bg-primary/10' 
                                  : 'border-border/50 bg-card hover:bg-muted/30'
                              }`}
                            >
                              <AccordionTrigger className="hover:no-underline px-3 py-2.5">
                                <div className="flex items-center justify-between w-full pr-2 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isCurrentStatusEvidence ? 'bg-primary' : 'bg-muted-foreground'}`} />
                                    <Badge 
                                      variant={isCurrentStatusEvidence ? "default" : "secondary"} 
                                      className="font-medium text-xs flex-shrink-0"
                                    >
                                      {statusLabel}
                                      {isCurrentStatusEvidence && (
                                        <span className="ml-1 text-xs">(Current)</span>
                                      )}
                                    </Badge>
                                    {submissionDate && (
                                      <span className="text-xs text-muted-foreground truncate hidden lg:inline">
                                        {submissionDate}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs flex-shrink-0 ml-2">
                                    {hasPhotos && (
                                      <span className="flex items-center gap-0.5 text-muted-foreground" title={`${evidence.photos.length} photos`}>
                                        <Camera className="h-3 w-3" />
                                        <span className="font-medium hidden sm:inline">{evidence.photos.length}</span>
                                      </span>
                                    )}
                                    {hasSignature && (
                                      <span className="text-muted-foreground" title="Signature">
                                        <PenTool className="h-3 w-3" />
                                      </span>
                                    )}
                                    {hasSealNumbers && (
                                      <span className="flex items-center gap-0.5 text-muted-foreground hidden sm:inline-flex" title={`${evidence.sealNumbers.length} seals`}>
                                        <Tag className="h-3 w-3" />
                                        <span className="font-medium">{evidence.sealNumbers.length}</span>
                                      </span>
                                    )}
                                    {hasNotes && (
                                      <span className="text-muted-foreground hidden sm:inline" title="Notes">
                                        <Pencil className="h-3 w-3" />
                                      </span>
                                    )}
                                    {itemCount === 0 && (
                                      <Badge variant="destructive" className="text-xs">
                                        Empty
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3 pt-2 max-h-[400px] overflow-y-auto">
                                <div className="space-y-3 border-t border-border/50 pt-3">
                                  {/* Photos */}
                                  {hasPhotos && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-xs font-semibold">Photos</p>
                                        <Badge variant="outline" className="text-xs ml-auto">
                                          {evidence.photos.length}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        {evidence.photos.map((photo: string, photoIdx: number) => {
                                          // Use regular URL for img src (data URLs work fine here)
                                          const imgUrl = getAuthenticatedFileUrl(photo, false);
                                          // Use blob URL for new tab opening (data URLs are blocked)
                                          const handleClick = () => {
                                            const newTabUrl = getAuthenticatedFileUrl(photo, true);
                                            if (newTabUrl && newTabUrl !== '#') {
                                              window.open(newTabUrl, '_blank');
                                            } else {
                                              log.error('Invalid photo URL:', photo);
                                            }
                                          };
                                          return (
                                            <div
                                              key={photoIdx}
                                              className="relative group cursor-pointer rounded overflow-hidden border border-border/50 hover:border-primary/50 transition-all"
                                              onClick={handleClick}
                                            >
                                              <img
                                                src={imgUrl}
                                                alt={`Photo ${photoIdx + 1}`}
                                                className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-200"
                                              />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <FileCheck className="h-4 w-4 text-white drop-shadow-lg" />
                                              </div>
                                            </div>
                                          </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Signature */}
                                  {hasSignature && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-xs font-semibold">Signature</p>
                                      </div>
                                      <div 
                                        className="inline-block border border-border rounded p-1.5 bg-white cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => {
                                          // Use blob URL for new tab opening (data URLs are blocked)
                                          const newTabUrl = getAuthenticatedFileUrl(evidence.signature, true);
                                          if (newTabUrl && newTabUrl !== '#') {
                                            window.open(newTabUrl, '_blank');
                                          } else {
                                            log.error('Invalid signature URL:', evidence.signature);
                                          }
                                        }}
                                      >
                                        <img
                                          src={getAuthenticatedFileUrl(evidence.signature, false)}
                                          alt="Signature"
                                          className="h-16 w-auto object-contain"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Seal Numbers */}
                                  {hasSealNumbers && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-xs font-semibold">Seals</p>
                                        <Badge variant="outline" className="text-xs ml-auto">
                                          {evidence.sealNumbers.length}
                                        </Badge>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {evidence.sealNumbers.map((seal: string, sealIdx: number) => (
                                          <Badge 
                                            key={sealIdx} 
                                            variant="secondary" 
                                            className="text-xs py-1 px-2 font-mono bg-muted hover:bg-muted/80 transition-colors"
                                          >
                                            {seal}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Notes */}
                                  {hasNotes && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-xs font-semibold">Notes</p>
                                      </div>
                                      <div className="bg-muted/50 p-2 rounded border border-border/50">
                                        <p className="text-xs whitespace-pre-wrap text-foreground leading-relaxed break-words">
                                          {evidence.notes}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {itemCount === 0 && (
                                    <div className="text-center py-4 space-y-1.5">
                                      <AlertCircle className="h-6 w-6 mx-auto text-muted-foreground/50" />
                                      <p className="text-xs font-medium text-muted-foreground">
                                        No data available
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                        </Accordion>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Documents & certificates */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents &amp; certificates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingJobDocuments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {jobDocuments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Stored documents
                      </p>
                      {jobDocuments.map((doc) => (
                        <Button
                          key={doc.id}
                          variant="outline"
                          className="w-full justify-between h-auto py-2 min-h-0"
                          onClick={async () => {
                            try {
                              const safe = doc.name.replace(/[^\w\s.-]/g, "_").slice(0, 120);
                              await documentsService.downloadDocument(doc.id, safe);
                            } catch {
                              toast.error("Download failed");
                            }
                          }}
                        >
                          <span className="text-left truncate flex-1 mr-2">
                            <span className="block font-medium truncate">{doc.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatStoredDocumentType(doc.type)}
                            </span>
                          </span>
                          <Download className="h-4 w-4 shrink-0" />
                        </Button>
                      ))}
                    </div>
                  )}

                  {job.certificates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Generated certificates
                      </p>
                      {job.certificates.map((cert, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="w-full justify-between"
                          asChild
                        >
                          <a href={cert.downloadUrl} download>
                            <span className="capitalize">
                              {cert.type.replace(/-/g, " ")}
                            </span>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}

                  {jobDocuments.length === 0 && job.certificates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Documents will appear here as the job progresses and after completion.
                    </p>
                  )}
                </>
              )}

              {isAdminLikeRole(user?.role) &&
                job.status === "completed" && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Upload completion documents
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Certificates, grading reports, or other files for the client (PDF, images, Excel, CSV, TXT, or ZIP — max 50MB per file, up to {MAX_COMPLETION_UPLOAD_FILES} at once). ZIP is stored as-is (not extracted). Folder pick uploads allowed files from all subfolders as separate documents.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="completion-doc-type">Document type</Label>
                    <Select
                      value={uploadDocType}
                      onValueChange={(v) => setUploadDocType(v as CompletionDocumentType)}
                    >
                      <SelectTrigger id="completion-doc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="certificate">Certificate</SelectItem>
                        <SelectItem value="grading-report">Grading report</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="completion-doc-name">Display name (optional)</Label>
                    <Input
                      id="completion-doc-name"
                      placeholder="e.g. WEEE certificate — March 2026"
                      value={uploadDocName}
                      onChange={(e) => setUploadDocName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      One file: this title is used as-is. Several files: each document is titled “your text — filename”.
                    </p>
                  </div>
                  <input
                    ref={completionFileInputRef}
                    type="file"
                    multiple
                    accept={COMPLETION_DOC_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const list = e.target.files;
                      if (list?.length) {
                        queueCompletionUpload(list, false);
                      }
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={completionFolderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    // Non-standard: recursive folder pick (Chromium / Safari / Edge)
                    {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)}
                    onChange={(e) => {
                      const list = e.target.files;
                      if (list?.length) {
                        queueCompletionUpload(list, true);
                      }
                      e.target.value = "";
                    }}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={uploadCompletionMutation.isPending}
                      >
                        {uploadCompletionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Choose &amp; upload
                        <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                      <DropdownMenuItem
                        disabled={uploadCompletionMutation.isPending}
                        onSelect={() => completionFileInputRef.current?.click()}
                      >
                        <Files className="h-4 w-4 mr-2" />
                        Files
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={uploadCompletionMutation.isPending}
                        onSelect={() => completionFolderInputRef.current?.click()}
                      >
                        <Folder className="h-4 w-4 mr-2" />
                        Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        )}
      </div>

      {/* Re-assign Driver Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-assign Driver</DialogTitle>
            <DialogDescription>
              Select a new driver to assign to this job, or choose to unassign the current driver. The current driver will be notified of the change.
              Only jobs with status 'routed' can be re-assigned or unassigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Driver</Label>
              <div className="p-2 rounded-md bg-muted">
                <p className="text-sm font-medium">{job?.driver?.name}</p>
                {job?.driver?.vehicleReg && (
                  <p className="text-xs text-muted-foreground font-mono">{job.driver.vehicleReg}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDriver">New Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger id="newDriver">
                  <SelectValue placeholder="Select a driver or unassign..." />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={5}>
                  <SelectItem value="unassign">
                    <div className="flex items-center gap-2 text-destructive">
                      <span>Unassign Driver</span>
                    </div>
                  </SelectItem>
                  {(() => {
                    // Get current driver and vehicle info
                    const currentDriverId = job?.driver?.id;
                    const currentVehicleReg = job?.driver?.vehicleReg;
                    
                    // Create separate entries for each driver-vehicle combination
                    // Exclude the current driver-vehicle combination
                    const driverVehicleCombinations: Array<{
                      driverId: string;
                      driverName: string;
                      vehicle: { id: string; vehicleReg: string; vehicleType: string; vehicleFuelType: string };
                    }> = [];
                    
                    driversWithVehicles.forEach((driver) => {
                      const driverVehicles = driver.vehicles && driver.vehicles.length > 0 
                        ? driver.vehicles 
                        : driver.vehicleReg 
                          ? [{ id: driver.vehicleId || '', vehicleReg: driver.vehicleReg, vehicleType: driver.vehicleType || 'van', vehicleFuelType: driver.vehicleFuelType || 'diesel' }]
                          : [];
                      
                      driverVehicles.forEach((vehicle) => {
                        // Exclude current driver-vehicle combination
                        const isCurrent = currentDriverId === driver.id && currentVehicleReg === vehicle.vehicleReg;
                        if (!isCurrent) {
                          driverVehicleCombinations.push({
                            driverId: driver.id,
                            driverName: driver.name,
                            vehicle,
                          });
                        }
                      });
                    });
                    
                    return driverVehicleCombinations.map((combo) => {
                      // Use vehicle.id if available, otherwise use a fallback
                      const vehicleId = combo.vehicle.id || combo.driverId;
                      const value = `${combo.driverId}:${vehicleId}`;
                      return (
                        <SelectItem key={value} value={value}>
                          <div className="flex flex-col gap-1">
                            <span>{combo.driverName}</span>
                            <div className="text-xs text-muted-foreground">
                              {combo.vehicle.vehicleReg} - {combo.vehicle.vehicleType} {combo.vehicle.vehicleFuelType}
                            </div>
                          </div>
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsReassignDialogOpen(false);
                setSelectedDriverId("");
              }}
              disabled={reassignDriver.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!job) {
                  toast.error("Job not found");
                  return;
                }

                if (job.status !== 'routed') {
                  toast.error("Can only re-assign/unassign driver when job status is 'routed'");
                  return;
                }

                if (selectedDriverId === 'unassign') {
                  // Unassign driver
                  reassignDriver.mutate(
                    { jobId: job.id, driverId: null },
                    {
                      onSuccess: () => {
                        toast.success("Driver unassigned successfully");
                        setIsReassignDialogOpen(false);
                        setSelectedDriverId("");
                      },
                      onError: (error) => {
                        toast.error("Failed to unassign driver", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      },
                    }
                  );
                } else if (selectedDriverId) {
                  // Re-assign to new driver-vehicle combination
                  // Parse driverId:vehicleId format
                  const [driverId, vehicleId] = selectedDriverId.split(':');
                  reassignDriver.mutate(
                    { jobId: job.id, driverId, vehicleId },
                    {
                      onSuccess: () => {
                        toast.success("Driver re-assigned successfully");
                        setIsReassignDialogOpen(false);
                        setSelectedDriverId("");
                      },
                      onError: (error) => {
                        toast.error("Failed to re-assign driver", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      },
                    }
                  );
                } else {
                  toast.error("Please select a driver or choose to unassign");
                }
              }}
              disabled={!selectedDriverId || reassignDriver.isPending || (selectedDriverId !== 'unassign' && selectedDriverId.split(':')[0] === job?.driver?.id)}
            >
              {reassignDriver.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {selectedDriverId === 'unassign' ? 'Unassigning...' : 'Re-assigning...'}
                </>
              ) : (
                selectedDriverId === 'unassign' ? 'Unassign Driver' : 'Re-assign Driver'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobDetail;
