import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Calendar, MapPin, ArrowRight, Loader2, FileText, Truck, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBookingsPage } from "@/hooks/useBookings";
import { ListPagination } from "@/components/common/ListPagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { getStatusLabelExtended, getStatusColor } from "@/types/booking-lifecycle";
import type { BookingLifecycleStatus } from "@/types/booking-lifecycle";
import { BookingTypeBadge } from "@/components/bookings/BookingTypeBadge";
import { BuybackEstimateDisclaimer } from "@/components/booking/BuybackEstimateDisclaimer";
import { UK_TIME_ZONE } from '@/lib/datetime';

const BookingsHistory = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Search is sent to the server rather than applied to the current page.
  // Filtering client-side only searched the 20 rows that happened to be loaded,
  // so a booking on page 3 could not be found at all.
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const { bookings, pagination, isLoading, isFetching, error } = useBookingsPage({
    status: statusFilter !== "all" ? statusFilter : undefined,
    searchQuery: debouncedSearch || undefined,
    page,
    limit,
  });

  // Any filter change invalidates the current page number.
  const resetToFirstPage = () => setPage(1);

  const filteredBookings = bookings;

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load bookings. Please try refreshing the page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subtitle only — page title comes from AppLayout */}
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-1.5 text-muted-foreground"
      >
        <span>
          {user?.role === "partner" ? "View all bookings for your clients" : "Track your booking requests"}
        </span>
        <BuybackEstimateDisclaimer variant="icon" />
      </motion.p>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, booking number, or site..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetToFirstPage(); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetToFirstPage(); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="collection_scheduled">Collection Scheduled</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="warehouse">At Warehouse</SelectItem>
            <SelectItem value="sanitised">Sanitised</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
            <SelectItem value="device_allocated">Device Allocated</SelectItem>
            <SelectItem value="courier_booked">Courier Booked</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No bookings found matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking, index) => {
            const statusColor = getStatusColor(booking.status);
            const statusLabel = getStatusLabelExtended(booking.status, booking.bookingType);
            const totalAssets = booking.assets.reduce((sum, a) => sum + a.quantity, 0);

            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link
                  to={`/bookings/${booking.id}`}
                  className="block rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">{booking.organisationName || booking.clientName}</h3>
                        <BookingTypeBadge 
                          bookingType={booking.bookingType} 
                          jmlSubType={booking.jmlSubType}
                          size="sm"
                        />
                        <Badge className={statusColor}>{statusLabel}</Badge>
                        {booking.resellerName && (
                          <Badge variant="outline" className="text-xs">
                            Via {booking.resellerName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
                          {booking.bookingNumber}
                        </span>
                        {booking.createdByName && (
                          <span className="flex items-center gap-1" title="Booked by">
                            <User className="h-3.5 w-3.5" />
                            {booking.createdByName}
                          </span>
                        )}
                        {booking.jmlSubType === 'mover' && booking.currentAddress ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="text-xs">From: <span className="truncate">{booking.currentSiteName || 'Current'}</span></span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-primary" />
                              <span className="text-xs">To: <span className="truncate">{booking.siteName}</span></span>
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {booking.siteName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(booking.scheduledDate).toLocaleDateString("en-GB", { timeZone: UK_TIME_ZONE,
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
                        <p className="font-semibold text-foreground">{totalAssets}</p>
                        <p className="text-xs text-muted-foreground">Assets</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-success">
                          {(booking.estimatedCO2e / 1000).toFixed(1)}t
                        </p>
                        <p className="text-xs text-muted-foreground">Est. CO₂e</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">£{booking.estimatedBuyback.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Est. Buyback</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{booking.charityPercent}%</p>
                        <p className="text-xs text-muted-foreground">Charity</p>
                      </div>
                      {booking.roundTripDistanceKm && booking.roundTripDistanceKm > 0 && (
                        <div className="text-center">
                          <p className="font-semibold text-foreground flex items-center justify-center gap-1">
                            <Truck className="h-3 w-3" />
                            {booking.roundTripDistanceMiles 
                              ? `${booking.roundTripDistanceMiles.toFixed(1)} mi`
                              : `${(booking.roundTripDistanceKm * 0.621371).toFixed(1)} mi`}
                          </p>
                          <p className="text-xs text-muted-foreground">Return Journey</p>
                        </div>
                      )}
                      <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      <ListPagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        itemLabel="bookings"
        isLoading={isFetching}
      />
    </div>
  );
};

export default BookingsHistory;
