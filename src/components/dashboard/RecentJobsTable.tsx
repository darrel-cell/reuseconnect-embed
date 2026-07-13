import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statusConfig } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BookingTypeBadge } from "@/components/bookings/BookingTypeBadge";
import { useJobs } from "@/hooks/useJobs";

export function RecentJobsTable() {
  const { data: jobs, isLoading } = useJobs({ limit: 5 });
  
  const recentJobs = jobs || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Jobs</h3>
          <p className="text-sm text-muted-foreground">Latest collection activities</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/jobs" className="gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No recent jobs found</p>
          </div>
        ) : (
          recentJobs.map((job, index) => {
          const status = statusConfig[job.status];
          return (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-medium text-foreground truncate">{job.organisationName}</p>
                  <BookingTypeBadge 
                    bookingType={job.bookingType} 
                    jmlSubType={job.jmlSubType}
                    size="sm"
                  />
                  <Badge 
                    variant="secondary" 
                    className={cn("text-xs", status.bgColor, status.color)}
                  >
                    {status.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {job.jmlSubType === 'mover' && job.currentAddress ? (
                    <span className="truncate text-xs">
                      {job.currentSiteName || 'Current'} → {job.siteName}
                    </span>
                  ) : (
                    <span className="truncate">{job.siteName}</span>
                  )}
                  <span className="mx-1">•</span>
                  <span>{job.erpJobNumber}</span>
                  {job.createdByName && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="flex items-center gap-1" title="Booked by">
                        <User className="h-3 w-3" />
                        <span className="truncate">{job.createdByName}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">
                  {job.assets.reduce((sum, a) => sum + a.quantity, 0)} assets
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(job.scheduledDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short"
                  })}
                </p>
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })
        )}
      </div>
    </motion.div>
  );
}
