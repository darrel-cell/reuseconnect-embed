import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { co2Service } from "@/services/co2.service";
import { isAdminLikeRole } from '@/lib/roles';
import { ImpactOverview } from "@/components/dashboard/ImpactOverview";
import { ImpactBreakdownView } from "@/components/dashboard/ImpactBreakdownView";

/** Rows-per-page choices offered by the serial table select. */
type PageSize = '50' | '100' | 'all';
const isPageSize = (value: string): value is PageSize =>
  value === '50' || value === '100' || value === 'all';

const CO2eDashboard = () => {
  const [searchParams] = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [serialCategoryFilter, setSerialCategoryFilter] = useState<string>("all");
  const [serialDeviceTypeFilter, setSerialDeviceTypeFilter] = useState<string>("all");
  const [serialPageSize, setSerialPageSize] = useState<PageSize>("50");
  const [serialPage, setSerialPage] = useState<number>(1);
  const selectedView = (searchParams.get("view") || "overview") as "overview" | "organisation" | "user" | "serial";

  // Normalize organisation name for grouping/comparisons:
  // - case-insensitive
  // - trims whitespace
  // - collapses multiple spaces
  const normalizeOrganisationName = (value?: string | null) => {
    const normalized = (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return normalized;
  };

  const { data: serialStats = [], isLoading: isLoadingSerialStats } = useQuery({
    queryKey: ["co2SerialStats", user?.id],
    queryFn: () => co2Service.getTenantSerialStats(),
    enabled: isAdminLikeRole(user?.role),
    staleTime: 60000,
  });

  const filteredSerialStats = useMemo(() => {
    const categoryKey = serialCategoryFilter !== "all" ? normalizeOrganisationName(serialCategoryFilter) : null;
    const deviceTypeKey = serialDeviceTypeFilter !== "all" ? normalizeOrganisationName(serialDeviceTypeFilter) : null;

    return serialStats.filter((row) => {
      const rowCategory = normalizeOrganisationName(row.category || "Unknown");
      const rowDeviceType = normalizeOrganisationName(row.deviceType || "Unknown");
      const categoryOk = categoryKey === null || rowCategory === categoryKey;
      const deviceTypeOk = deviceTypeKey === null || rowDeviceType === deviceTypeKey;
      return categoryOk && deviceTypeOk;
    });
  }, [serialCategoryFilter, serialDeviceTypeFilter, serialStats]);

  const serialCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of serialStats) {
      set.add((row.category || "Unknown").trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [serialStats]);

  const serialDeviceTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of serialStats) {
      set.add((row.deviceType || "Unknown").trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [serialStats]);

  useEffect(() => {
    // Keep pagination stable when filters change.
    setSerialPage(1);
  }, [serialCategoryFilter, serialDeviceTypeFilter, serialPageSize]);

  // Important: do not return before declaring all hooks above.
  // The overview and the organisation / user views share the RTG figures from graded stock;
  // the serial view counts devices passed between employees.
  if (selectedView === "overview") return <ImpactOverview />;
  if (selectedView === "organisation") return <ImpactBreakdownView by="organisation" />;
  if (selectedView === "user") return <ImpactBreakdownView by="person" />;

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const serialPageSizeNum =
    serialPageSize === "all" ? null : parseInt(serialPageSize, 10);
  const serialTotal = filteredSerialStats.length;
  const serialPageCount =
    serialPageSizeNum === null ? 1 : Math.max(1, Math.ceil(serialTotal / serialPageSizeNum));
  const safeSerialPage = serialPageSizeNum === null ? 1 : Math.min(serialPage, serialPageCount);
  const serialPageRows =
    serialPageSizeNum === null
      ? filteredSerialStats
      : filteredSerialStats.slice(
          (safeSerialPage - 1) * serialPageSizeNum,
          safeSerialPage * serialPageSizeNum
        );

  return (
    <div className="space-y-4">
      {selectedView === "serial" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CO₂e by Serial Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isAdminLikeRole(user?.role) && (
              <Alert>
                <AlertDescription>Serial-level CO₂ stats are available for admin users.</AlertDescription>
              </Alert>
            )}

            {isAdminLikeRole(user?.role) && isLoadingSerialStats && (
              <p className="text-sm text-muted-foreground">Loading serial CO₂ stats...</p>
            )}

            {isAdminLikeRole(user?.role) && !isLoadingSerialStats && (
              <>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
                  <div className="min-w-[220px]">
                    <label className="text-xs text-muted-foreground">Category</label>
                    <Select value={serialCategoryFilter} onValueChange={setSerialCategoryFilter}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {serialCategoryOptions.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[220px]">
                    <label className="text-xs text-muted-foreground">Device type</label>
                    <Select
                      value={serialDeviceTypeFilter}
                      onValueChange={setSerialDeviceTypeFilter}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All device types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All device types</SelectItem>
                        {serialDeviceTypeOptions.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[140px]">
                    <label className="text-xs text-muted-foreground">Rows per page</label>
                    <Select value={serialPageSize} onValueChange={(v) => { if (isPageSize(v)) setSerialPageSize(v); }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="50" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Make / Model</TableHead>
                      <TableHead className="text-right">Reuse</TableHead>
                      <TableHead className="text-right">Total avoided (t)</TableHead>
                      <TableHead className="text-right">Avg avoided (t)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serialPageRows.map((row) => (
                      <TableRow key={row.serialNumber}>
                        <TableCell className="font-mono">{row.serialNumber}</TableCell>
                        <TableCell>{row.category || "Unknown"}</TableCell>
                        <TableCell>{row.deviceType || "Unknown"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {[row.make, row.model].filter(Boolean).join(" ")}
                        </TableCell>
                        <TableCell className="text-right">{row.reuseCount}</TableCell>
                        <TableCell className="text-right">
                          {(row.totalCO2eSaved / 1000).toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(row.averageCO2ePerReuse / 1000).toFixed(3)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {serialPageRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No serial reuse records yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {serialPageSizeNum !== null && serialTotal > serialPageSizeNum && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground">
                      Showing{" "}
                      {(safeSerialPage - 1) * serialPageSizeNum + 1} -{" "}
                      {Math.min(safeSerialPage * serialPageSizeNum, serialTotal)} of {serialTotal}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSerialPage((p) => Math.max(1, p - 1))}
                        disabled={safeSerialPage <= 1}
                      >
                        Prev
                      </Button>
                      <span className="text-sm">
                        Page {safeSerialPage} / {serialPageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSerialPage((p) => Math.min(serialPageCount, p + 1))}
                        disabled={safeSerialPage >= serialPageCount}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CO2eDashboard;
