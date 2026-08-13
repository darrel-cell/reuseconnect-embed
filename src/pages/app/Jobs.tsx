import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, ArrowRight, MapPin, Calendar, Package, Loader2, Filter, Truck, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { BookingTypeBadge } from "@/components/bookings/BookingTypeBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkflowStatus } from "@/types/jobs";
import { useJobs } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { UK_TIME_ZONE } from '@/lib/datetime';
import { ListPagination } from "@/components/common/ListPagination";
import { useClientPagination } from "@/hooks/useClientPagination";

// All workflow status filters (aligned with WorkflowStatus type). Dispatched statuses are kept in types but skipped in UI for now.
const allStatusFilters: { value: WorkflowStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  // ITAD collection flow
  { value: "booked", label: "Booked" },
  { value: "routed", label: "Routed" },
  { value: "en-route", label: "En Route" },
  { value: "arrived", label: "Arrived" },
  { value: "collected", label: "Collected" },
  { value: "warehouse", label: "Warehouse" },
  { value: "sanitised", label: "Sanitised" },
  { value: "graded", label: "Graded" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  // JML flow
  { value: "device-allocated", label: "Device Allocated" },
  { value: "courier-booked", label: "Courier Booked" },
  // dispatched / delivery-dispatched skipped in filter UI but not removed from types
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "delivery-courier-booked", label: "Delivery Courier Booked" },
  { value: "delivery-dispatched", label: "Delivery Dispatched" },
  { value: "inventory", label: "Inventory" },
];

// `readonly string[]`, not a literal tuple: this list is only ever searched,
// and typing it narrowly forced every caller to cast the value it looks up.
const STATUS_FILTER_SKIP_JOB: readonly string[] = ["dispatched", "delivery-dispatched"];

// Statuses drivers care about (assigned / in-transit jobs only)
const driverStatuses: (WorkflowStatus | "all")[] = ["all", "routed", "en-route", "arrived", "collected"];
const warehouseStatuses: (WorkflowStatus | "all")[] = ["all", "collected", "warehouse", "sanitised"];

const getStatusFilters = (userRole?: string) => {
  let list = allStatusFilters;
  if (userRole === "driver") {
    list = allStatusFilters.filter((f) => driverStatuses.includes(f.value));
  } else if (userRole === "warehouse_technician") {
    list = allStatusFilters.filter((f) => warehouseStatuses.includes(f.value));
  } else {
    list = allStatusFilters.filter((f) => f.value === "all" || !STATUS_FILTER_SKIP_JOB.includes(f.value));
  }
  return list;
};

const normalizeStatus = (status: string) => (status === "en_route" ? "en-route" : status);

const Jobs = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<WorkflowStatus | "all">("all");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);

  const { data: jobs = [], isLoading, error } = useJobs({
    status: activeFilter === "all" ? undefined : activeFilter,
    searchQuery: debouncedSearch || undefined,
  });
  const visibleJobs = useMemo(() => {
    if (user?.role === "driver") {
      const allowed = new Set<WorkflowStatus>(["routed", "en-route", "arrived", "collected"]);
      return jobs.filter((job) => allowed.has(normalizeStatus(job.status) as WorkflowStatus));
    }
    if (user?.role === "warehouse_technician") {
      const allowed = new Set<WorkflowStatus>(["collected", "warehouse", "sanitised"]);
      return jobs.filter((job) => allowed.has(normalizeStatus(job.status) as WorkflowStatus));
    }
    return jobs;
  }, [jobs, user?.role]);
  const { pagination, pagedItems, setPage, setLimit } = useClientPagination(
    visibleJobs,
    `${debouncedSearch}|${activeFilter}`
  );
  
  const isReseller = user?.role === 'partner';

  return (
    <div className="space-y-6">
      {/* Header for Resellers */}
      {isReseller && (
        <div className="mb-4 p-4 rounded-lg bg-info/10 border border-info/20">
          <p className="text-sm text-foreground">
            <strong>Note:</strong> You are viewing jobs for your clients. All ITAD operations (collection, sanitisation, grading, and disposal) are handled exclusively by Reuse. You can track the status and view reports here.
          </p>
        </div>
      )}
      
      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, job number, or site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        
        <div className="w-full sm:w-[260px]">
          <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as WorkflowStatus | "all")}>
            <SelectTrigger className="w-full">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue>
                {getStatusFilters(user?.role).find(f => f.value === activeFilter)?.label || "All"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {getStatusFilters(user?.role).map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Jobs List */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load jobs. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !visibleJobs || visibleJobs.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No jobs found matching your criteria</p>
          </div>
        ) : (
          pagedItems.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Link
              to={user?.role === "driver" ? `/driver/jobs/${job.id}` : user?.role === "warehouse_technician" ? `/warehouse/jobs/${job.id}` : `/jobs/${job.id}`}
              className="block rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-foreground truncate">{job.organisationName}</h3>
                    <BookingTypeBadge 
                      bookingType={job.bookingType} 
                      jmlSubType={job.jmlSubType}
                      size="sm"
                    />
                    <JobStatusBadge status={job.status} bookingType={job.bookingType} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
                      {job.erpJobNumber}
                    </span>
                    {job.createdByName && (
                      <span className="flex items-center gap-1" title="Booked by">
                        <User className="h-3.5 w-3.5" />
                        {job.createdByName}
                      </span>
                    )}
                    {job.jmlSubType === 'mover' && job.currentAddress ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="text-xs">From: <span className="truncate">{job.currentSiteName || 'Current'}</span></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span className="text-xs">To: <span className="truncate">{job.siteName}</span></span>
                        </span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.siteName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(job.scheduledDate).toLocaleDateString("en-GB", { timeZone: UK_TIME_ZONE,
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-semibold text-foreground">
                      {job.assets.reduce((sum, a) => sum + a.quantity, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Assets</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-success">
                      {(job.co2eSaved / 1000).toFixed(1)}t
                    </p>
                    <p className="text-xs text-muted-foreground">CO₂e</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">
                      £{job.buybackValue.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Buyback</p>
                  </div>
                  {job.roundTripDistanceKm && job.roundTripDistanceKm > 0 && (
                    <div className="text-center">
                      <p className="font-semibold text-foreground flex items-center justify-center gap-1">
                        <Truck className="h-3 w-3" />
                        {job.roundTripDistanceMiles 
                          ? `${job.roundTripDistanceMiles.toFixed(1)} mi`
                          : `${(job.roundTripDistanceKm * 0.621371).toFixed(1)} mi`}
                      </p>
                      <p className="text-xs text-muted-foreground">Return Journey</p>
                    </div>
                  )}
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Driver Info (if routed or en-route) */}
              {job.driver && (job.status === "routed" || job.status === "en-route") && (
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-4 text-sm">
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
                  <span className="text-muted-foreground">
                    Driver: <span className="text-foreground">{job.driver.name}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Vehicle: <span className="font-mono text-foreground">{job.driver.vehicleReg}</span>
                  </span>
                </div>
              )}
            </Link>
          </motion.div>
        ))
        )}
      </div>

      {!isLoading && visibleJobs.length > 0 && (
        <ListPagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          itemLabel="jobs"
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

export default Jobs;
