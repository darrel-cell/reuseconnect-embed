import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, ArrowRight, MapPin, Calendar, Package, Loader2, Clock, TrendingUp, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { BookingTypeBadge } from "@/components/bookings/BookingTypeBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobs } from "@/hooks/useJobs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { canDriverEditJob } from "@/utils/job-helpers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { UK_TIME_ZONE } from '@/lib/datetime';
import { ListPagination } from "@/components/common/ListPagination";
import { ViewModeToggle } from "@/components/common/ViewModeToggle";
import { usePersistedViewMode } from "@/hooks/usePersistedViewMode";
import { useClientPagination } from "@/hooks/useClientPagination";
import { cn } from "@/lib/utils";

const JobHistory = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = usePersistedViewMode("job-history-view", "card");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);

  // Fetch jobs without status narrowing.
  // History visibility is controlled by role-based filtering below.
  const { data: allJobs = [], isLoading, error } = useJobs({
    searchQuery: debouncedSearch || undefined,
  });

  const roleBasedJobs = useMemo(() => {
    const jobs = allJobs || [];
    if (user?.role === "warehouse_technician") {
      // Warehouse history focuses on processed jobs beyond active handling stages.
      return jobs.filter(
        (job) =>
          job.bookingType === "itad_collection" &&
          ["graded", "completed", "cancelled"].includes(job.status)
      );
    }

    // Driver history behavior (existing)
    return jobs.filter((job) => {
      if (!job.driver || (job.driver.id !== user?.id && job.driver.name !== user?.name)) {
        return false;
      }
      if (job.bookingType !== "itad_collection") {
        return false;
      }
      return !canDriverEditJob(job) || ["warehouse", "sanitised", "graded", "completed"].includes(job.status);
    });
  }, [allJobs, user?.id, user?.name, user?.role]);

  // Apply date range filter
  const jobs = useMemo(() => {
    if (dateRangeFilter === "all") return roleBasedJobs;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (dateRangeFilter) {
      case "today":
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "month":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case "year":
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return roleBasedJobs;
    }
    
    return roleBasedJobs.filter(job => {
      // Use completedDate if available, otherwise use scheduledDate
      const dateToCheck = job.completedDate 
        ? new Date(job.completedDate)
        : job.scheduledDate 
        ? new Date(job.scheduledDate)
        : null;
      
      if (!dateToCheck) return false;
      return dateToCheck >= cutoffDate;
    });
  }, [roleBasedJobs, dateRangeFilter]);

  const {
    pagedItems: pagedJobs,
    pagination,
    setPage,
    setLimit,
  } = useClientPagination(jobs, `${debouncedSearch}|${dateRangeFilter}`);

  // Calculate statistics based on filtered jobs
  const totalJobs = jobs.length;
  const totalAssets = jobs.reduce((sum, job) => 
    sum + job.assets.reduce((assetSum, asset) => assetSum + asset.quantity, 0), 0
  );
  const totalCO2e = jobs.reduce((sum, job) => sum + job.co2eSaved, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div>
          <p className="text-muted-foreground">
            {user?.role === "warehouse_technician"
              ? "View your processed warehouse jobs"
              : "View your completed collection jobs"}
          </p>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      {!isLoading && jobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{totalJobs}</p>
                </div>
                <Package className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">{totalAssets.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CO₂e Saved</p>
                  <p className="text-2xl font-bold">{(totalCO2e / 1000).toFixed(1)}t</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, job number, or site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="quarter">Last 3 Months</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
          </SelectContent>
        </Select>
        <ViewModeToggle value={viewMode} onChange={setViewMode} className="self-end sm:self-auto" />
      </motion.div>

      {/* Jobs List */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load job history. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      )}
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchQuery 
              ? "No completed jobs found matching your search" 
              : "No completed jobs yet. Completed jobs will appear here."}
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {pagedJobs.map((job, index) => {
            const assetCount = job.assets.reduce((sum, asset) => sum + asset.quantity, 0);
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.15) }}
              >
                <Link
                  to={`/jobs/${job.id}`}
                  className={cn(
                    "block rounded-lg border bg-card px-4 py-3 shadow-sm",
                    "hover:shadow-md transition-all duration-200 group"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">{job.organisationName}</h3>
                        <BookingTypeBadge
                          bookingType={job.bookingType}
                          jmlSubType={job.jmlSubType}
                          size="sm"
                        />
                        <JobStatusBadge status={job.status} bookingType={job.bookingType} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{job.erpJobNumber}</span>
                        {job.jmlSubType === 'mover' && job.currentAddress ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {job.currentSiteName || 'Current'} → {job.siteName}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{job.siteName}</span>
                          </span>
                        )}
                        {job.completedDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {new Date(job.completedDate).toLocaleDateString("en-GB", {
                              timeZone: UK_TIME_ZONE,
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        <span>{assetCount} assets</span>
                        <span>{(job.co2eSaved / 1000).toFixed(1)}t CO₂e</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {pagedJobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link
                to={`/jobs/${job.id}`}
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
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">{job.erpJobNumber}</span>
                      </div>
                      {job.jmlSubType === 'mover' && job.currentAddress ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate text-xs">
                            {job.currentSiteName || 'Current'} → {job.siteName}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{job.siteName}</span>
                        </div>
                      )}
                      {job.completedDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            Completed {new Date(job.completedDate).toLocaleDateString("en-GB", { timeZone: UK_TIME_ZONE,
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 lg:gap-8">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Assets</p>
                      <p className="font-semibold">
                        {job.assets.reduce((sum, asset) => sum + asset.quantity, 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">CO₂e Saved</p>
                      <p className="font-semibold">{(job.co2eSaved / 1000).toFixed(1)}t</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <ListPagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="jobs"
        isLoading={isLoading}
      />
    </div>
  );
};

export default JobHistory;
