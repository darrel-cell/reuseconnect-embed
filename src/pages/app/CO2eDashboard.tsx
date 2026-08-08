import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Leaf, 
  TreeDeciduous, 
  Home, 
  Car, 
  Plane,
  TrendingUp,
  Download,
  Users,
  Search,
  Building2,
  CheckCircle2,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList
} from "recharts";
import { co2eEquivalencies } from "@/lib/constants";
import { useJobs } from "@/hooks/useJobs";
import { useAssetCategories } from "@/hooks/useAssets";
import { useDashboardStats } from "@/hooks/useJobs";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { co2Service } from "@/services/co2.service";

const CO2eDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isReseller = user?.role === 'partner';
  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { data: jobs = [], isLoading: isLoadingJobs } = useJobs(
    isReseller && selectedClientId ? { clientId: selectedClientId } : undefined
  );
  const { data: stats, isLoading: isLoadingStats } = useDashboardStats();
  const { data: assetCategories = [] } = useAssetCategories();
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [orgFilterName, setOrgFilterName] = useState<string>("all");
  const [orgPageSize, setOrgPageSize] = useState<"50" | "100" | "all">("50");
  const [orgPage, setOrgPage] = useState<number>(1);

  const [userFilterName, setUserFilterName] = useState<string>("all");
  const [userPageSize, setUserPageSize] = useState<"50" | "100" | "all">("50");
  const [userPage, setUserPage] = useState<number>(1);

  const [serialCategoryFilter, setSerialCategoryFilter] = useState<string>("all");
  const [serialDeviceTypeFilter, setSerialDeviceTypeFilter] = useState<string>("all");
  const [serialPageSize, setSerialPageSize] = useState<"50" | "100" | "all">("50");
  const [serialPage, setSerialPage] = useState<number>(1);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
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

  // Detect narrow screen for chart margins
  useEffect(() => {
    const checkScreenSize = () => {
      setIsNarrowScreen(window.innerWidth < 640); // sm breakpoint
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const filteredJobs = jobs;
  const { data: serialStats = [], isLoading: isLoadingSerialStats } = useQuery({
    queryKey: ["co2SerialStats", user?.id],
    queryFn: () => co2Service.getTenantSerialStats(),
    enabled: user?.role === "admin",
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
  const clientStats = useMemo(() => {
    const clientJobs = filteredJobs;
    const totalReuseSaved = clientJobs.reduce((sum, j) => sum + (j.co2eSaved || 0), 0);
    const totalTravel = clientJobs.reduce((sum, j) => sum + j.travelEmissions, 0);
    const netBenefit = totalReuseSaved - totalTravel;
    const completedJobs = clientJobs.filter(j => j.status === 'completed');
    const bookedJobs = clientJobs.filter(j => j.status !== 'completed');
    
    return {
      // For UI: "CO₂e Saved" = reuse savings - travel emissions (net benefit)
      totalSaved: netBenefit,
      totalTravel,
      netBenefit,
      completedJobsCount: completedJobs.length,
      bookedJobsCount: bookedJobs.length,
      completedCO2eSaved: completedJobs.reduce((sum, j) => sum + ((j.co2eSaved || 0) - (j.travelEmissions || 0)), 0),
      estimatedCO2eSaved: bookedJobs.reduce((sum, j) => sum + ((j.co2eSaved || 0) - (j.travelEmissions || 0)), 0),
      totalJobs: clientJobs.length,
    };
  }, [filteredJobs]);

  const monthlyData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    const monthlyTotals: Record<string, { saved: number; travel: number }> = {};
    const monthsToShow: Array<{ month: string; year: number; saved: number; travel: number }> = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      const monthKey = `${monthNames[monthIndex]}-${year}`;
      
      monthlyTotals[monthKey] = { saved: 0, travel: 0 };
      
      monthsToShow.push({
        month: monthNames[monthIndex],
        year: year,
        saved: 0,
        travel: 0,
      });
    }
    
    // Fill in actual data from jobs
    filteredJobs.forEach(job => {
      const date = new Date(job.scheduledDate);
      const jobYear = date.getFullYear();
      const jobMonth = date.getMonth();
      const monthKey = `${monthNames[jobMonth]}-${jobYear}`;
      
      if (monthlyTotals[monthKey] !== undefined) {
        monthlyTotals[monthKey].saved += (job.co2eSaved || 0) - (job.travelEmissions || 0);
        monthlyTotals[monthKey].travel += job.travelEmissions;
      }
    });
    
    let monthIndex = 0;
    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      const monthKey = `${monthNames[monthIdx]}-${year}`;
      
      monthsToShow[monthIndex].saved = monthlyTotals[monthKey].saved;
      monthsToShow[monthIndex].travel = monthlyTotals[monthKey].travel;
      monthIndex++;
    }
    
    return monthsToShow;
  }, [filteredJobs]);

  const clientCO2Stats = useMemo(() => {
    if (!isReseller) return [];
    
    return clients.map(client => {
      const clientOrgNameKey = normalizeOrganisationName(client.organisationName);
      const clientNameKey = normalizeOrganisationName(client.name);

      const clientJobs = jobs.filter(j => {
        const jobOrgKey = normalizeOrganisationName(j.organisationName);
        return (jobOrgKey && jobOrgKey === clientOrgNameKey) || (jobOrgKey && jobOrgKey === clientNameKey);
      });
      const totalCO2eReuse = clientJobs.reduce((sum, j) => sum + (j.co2eSaved || 0), 0);
      const totalTravel = clientJobs.reduce((sum, j) => sum + (j.travelEmissions || 0), 0);
      const netBenefit = totalCO2eReuse - totalTravel;
      const jobCount = clientJobs.length;
      const completedCount = clientJobs.filter(j => j.status === 'completed').length;
      
      return {
        clientId: client.id,
        clientName: client.organisationName || client.name,
        // UI meaning
        totalCO2e: netBenefit,
        totalTravel,
        netBenefit,
        jobCount,
        completedCount,
      };
    }).sort((a, b) => b.totalCO2e - a.totalCO2e); // Sort by CO2e descending
  }, [clients, jobs, isReseller]);

  // Filter clients by search query
  const filteredClientStats = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientCO2Stats;
    const query = clientSearchQuery.toLowerCase();
    return clientCO2Stats.filter(c => 
      c.clientName.toLowerCase().includes(query)
    );
  }, [clientCO2Stats, clientSearchQuery]);

  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    
    assetCategories.forEach(category => {
      categoryTotals[category.id] = 0;
    });
    
    // Fill in actual data from jobs
    filteredJobs.forEach(job => {
      job.assets.forEach(asset => {
        const categoryId = asset.categoryId || asset.category;
        const category = assetCategories.find(c => 
          c.id === categoryId || c.name === (asset.categoryName || asset.category)
        );
        
        if (category) {
          const categoryKey = category.id;
          const co2eForAsset = category.co2ePerUnit * asset.quantity;
          categoryTotals[categoryKey] = (categoryTotals[categoryKey] || 0) + co2eForAsset;
        }
      });
    });
    
    const categoryArray = assetCategories
      .map(category => ({
        id: category.id,
        name: category.name,
        value: categoryTotals[category.id] || 0,
      }))
      .sort((a, b) => b.value - a.value); // Sort by value descending
    
    const totalCO2e = categoryArray.reduce((sum, cat) => sum + cat.value, 0);
    
    const colors = [
      "hsl(168, 70%, 35%)",  // Teal
      "hsl(168, 60%, 45%)",  // Teal lighter
      "hsl(180, 50%, 40%)",  // Cyan
      "hsl(205, 60%, 45%)",  // Blue
      "hsl(38, 95%, 55%)",   // Orange
      "hsl(280, 60%, 50%)",  // Purple
      "hsl(340, 70%, 50%)",  // Pink
    ];
    
    return categoryArray.map((cat, i) => ({
    name: cat.name,
      value: totalCO2e > 0 ? Math.round((cat.value / totalCO2e) * 100) : 0,
      color: colors[i] || colors[colors.length - 1],
      actualValue: cat.value, // Store actual CO2e value for tooltip if needed
  }));
  }, [filteredJobs, assetCategories]);
  
  const totalSaved = clientStats.totalSaved;
  const totalTravel = clientStats.totalTravel;
  const netBenefit = clientStats.netBenefit;

  const selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
  const organisationRows = useMemo(() => {
    // Group by a normalized (case-insensitive) organisation key so "Sergio company" and "Sergio Company"
    // are treated as the same organisation in the UI.
    const map = new Map<string, { organisationName: string; totalSaved: number; totalTravel: number; jobs: number }>();
    for (const job of filteredJobs) {
      const normalizedKey = normalizeOrganisationName(job.organisationName) || "unknown";
      const displayName = job.organisationName?.trim() || normalizedKey;

      const row = map.get(normalizedKey) || { organisationName: displayName, totalSaved: 0, totalTravel: 0, jobs: 0 };
      row.totalSaved += (job.co2eSaved || 0) - (job.travelEmissions || 0);
      row.totalTravel += job.travelEmissions || 0;
      row.jobs += 1;
      // Prefer the first non-empty casing we encounter for display.
      if (!row.organisationName && displayName) row.organisationName = displayName;
      map.set(normalizedKey, row);
    }
    return [...map.values()].sort((a, b) => b.totalSaved - a.totalSaved);
  }, [filteredJobs]);

  const userRows = useMemo(() => {
    const map = new Map<string, { name: string; jobs: number; totalSaved: number; totalTravel: number }>();
    for (const job of filteredJobs) {
      // CO₂e by User should always be attributed to the human client/employee,
      // not the admin who created the booking, and not the company/organisation name.
      const organisationNameRaw = (job.organisationName || "").trim();
      const employeeNameRaw = (job.employeeName || "").trim();
      const clientNameRaw = (job.clientName || "").trim();
      const createdByNameRaw = (job.createdByName || "").trim();

      const organisationNameNormalized = organisationNameRaw ? organisationNameRaw.toLowerCase() : "";
      const employeeNameNormalized = employeeNameRaw ? employeeNameRaw.toLowerCase() : "";
      const createdByNameNormalized = createdByNameRaw ? createdByNameRaw.toLowerCase() : "";

      // If employeeName matches the organisation name, don't show it (prevents company leak).
      const employeeName =
        employeeNameNormalized &&
        employeeNameNormalized !== organisationNameNormalized &&
        employeeNameNormalized !== createdByNameNormalized
          ? employeeNameRaw
          : "";

      const displayName = employeeName || clientNameRaw || "Unknown User";
      const normalizedKey = displayName.toLowerCase();

      const row = map.get(normalizedKey) || { name: displayName, jobs: 0, totalSaved: 0, totalTravel: 0 };
      row.jobs += 1;
      row.totalSaved += (job.co2eSaved || 0) - (job.travelEmissions || 0);
      row.totalTravel += job.travelEmissions || 0;
      map.set(normalizedKey, row);
    }
    return [...map.values()].sort((a, b) => b.totalSaved - a.totalSaved);
  }, [filteredJobs]);

  const filteredorganisationRows = useMemo(() => {
    if (orgFilterName === "all") return organisationRows;
    const normalized = normalizeOrganisationName(orgFilterName);
    return organisationRows.filter(r => normalizeOrganisationName(r.organisationName) === normalized);
  }, [organisationRows, orgFilterName]);

  const filteredUserRows = useMemo(() => {
    if (userFilterName === "all") return userRows;
    const normalized = userFilterName.trim().toLowerCase();
    return userRows.filter(r => r.name.trim().toLowerCase() === normalized);
  }, [userRows, userFilterName]);

  useEffect(() => {
    setOrgPage(1);
  }, [orgFilterName, orgPageSize]);

  useEffect(() => {
    setUserPage(1);
  }, [userFilterName, userPageSize]);

  // Important: do not return before declaring all hooks above.
  if (isAuthLoading || isLoadingJobs || isLoadingStats || (isReseller && isLoadingClients)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedView !== "overview") {
    const orgPageSizeNum = orgPageSize === "all" ? null : parseInt(orgPageSize, 10);
    const orgTotal = filteredorganisationRows.length;
    const orgPageCount =
      orgPageSizeNum === null ? 1 : Math.max(1, Math.ceil(orgTotal / orgPageSizeNum));
    const safeOrgPage = orgPageSizeNum === null ? 1 : Math.min(orgPage, orgPageCount);
    const orgPageRows =
      orgPageSizeNum === null
        ? filteredorganisationRows
        : filteredorganisationRows.slice(
            (safeOrgPage - 1) * orgPageSizeNum,
            safeOrgPage * orgPageSizeNum
          );

    const userPageSizeNum = userPageSize === "all" ? null : parseInt(userPageSize, 10);
    const userTotal = filteredUserRows.length;
    const userPageCount =
      userPageSizeNum === null ? 1 : Math.max(1, Math.ceil(userTotal / userPageSizeNum));
    const safeUserPage = userPageSizeNum === null ? 1 : Math.min(userPage, userPageCount);
    const userPageRows =
      userPageSizeNum === null
        ? filteredUserRows
        : filteredUserRows.slice(
            (safeUserPage - 1) * userPageSizeNum,
            safeUserPage * userPageSizeNum
          );

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
        {selectedView === "organisation" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CO₂e by organisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
                <div className="min-w-[240px]">
                  <label className="text-xs text-muted-foreground">Filter organisation</label>
                  <Select value={orgFilterName} onValueChange={setOrgFilterName}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All organisations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All organisations</SelectItem>
                      {organisationRows.map((row) => (
                        <SelectItem key={row.organisationName} value={row.organisationName}>
                          {row.organisationName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[140px]">
                  <label className="text-xs text-muted-foreground">Rows per page</label>
                  <Select value={orgPageSize} onValueChange={setOrgPageSize}>
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
                    <TableHead>organisation</TableHead>
                    <TableHead className="text-right">Net saved (t)</TableHead>
                    <TableHead className="text-right">Travel (kg)</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgPageRows.map((row) => (
                    <TableRow key={row.organisationName}>
                      <TableCell className="font-medium">{row.organisationName}</TableCell>
                      <TableCell className="text-right">
                        {(row.totalSaved / 1000).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{row.totalTravel.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.jobs}</TableCell>
                    </TableRow>
                  ))}
                  {orgPageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No organisation CO₂e data yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {orgPageSizeNum !== null && orgTotal > orgPageSizeNum && (
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    {(safeOrgPage - 1) * orgPageSizeNum + 1} -{" "}
                    {Math.min(safeOrgPage * orgPageSizeNum, orgTotal)} of {orgTotal}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrgPage((p) => Math.max(1, p - 1))}
                      disabled={safeOrgPage <= 1}
                    >
                      Prev
                    </Button>
                    <span className="text-sm">
                      Page {safeOrgPage} / {orgPageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrgPage((p) => Math.min(orgPageCount, p + 1))}
                      disabled={safeOrgPage >= orgPageCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedView === "user" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CO₂e by User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
                <div className="min-w-[240px]">
                  <label className="text-xs text-muted-foreground">Filter user</label>
                  <Select value={userFilterName} onValueChange={setUserFilterName}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {userRows.map((row) => (
                        <SelectItem key={row.name} value={row.name}>
                          {row.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[140px]">
                  <label className="text-xs text-muted-foreground">Rows per page</label>
                  <Select value={userPageSize} onValueChange={setUserPageSize}>
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
                        <TableHead>User (Client)</TableHead>
                    <TableHead className="text-right">Net saved (t)</TableHead>
                    <TableHead className="text-right">Travel (kg)</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userPageRows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">
                        {(row.totalSaved / 1000).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{row.totalTravel.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.jobs}</TableCell>
                    </TableRow>
                  ))}
                  {userPageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No user-level CO₂e data yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {userPageSizeNum !== null && userTotal > userPageSizeNum && (
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    {(safeUserPage - 1) * userPageSizeNum + 1} -{" "}
                    {Math.min(safeUserPage * userPageSizeNum, userTotal)} of {userTotal}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={safeUserPage <= 1}
                    >
                      Prev
                    </Button>
                    <span className="text-sm">
                      Page {safeUserPage} / {userPageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserPage((p) => Math.min(userPageCount, p + 1))}
                      disabled={safeUserPage >= userPageCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedView === "serial" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CO₂e by Serial Number</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user?.role !== "admin" && (
                <Alert>
                  <AlertDescription>Serial-level CO₂ stats are available for admin users.</AlertDescription>
                </Alert>
              )}

              {user?.role === "admin" && isLoadingSerialStats && (
                <p className="text-sm text-muted-foreground">Loading serial CO₂ stats...</p>
              )}

              {user?.role === "admin" && !isLoadingSerialStats && (
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
                      <Select value={serialPageSize} onValueChange={setSerialPageSize}>
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
                        <TableHead className="text-right">Total saved (t)</TableHead>
                        <TableHead className="text-right">Avg saved (t)</TableHead>
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
  }

  const equivalencies = [
    { 
      icon: TreeDeciduous, 
      value: co2eEquivalencies.treesPlanted(netBenefit).toLocaleString(), 
      label: "Trees planted", 
      sublabel: "for one year" 
    },
    { 
      icon: Home, 
      value: co2eEquivalencies.householdDays(netBenefit).toLocaleString(), 
      label: "Household days", 
      sublabel: "of energy offset" 
    },
    { 
      icon: Car, 
      value: co2eEquivalencies.carMiles(netBenefit).toLocaleString(), 
      label: "Car miles", 
      sublabel: "avoided" 
    },
    { 
      icon: Plane, 
      value: co2eEquivalencies.flightHours(netBenefit).toLocaleString(), 
      label: "Flight hours", 
      sublabel: "offset" 
    },
  ];

  if (user && (user.role === 'partner' || isReseller)) {
    return (
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Left Sidebar - Client List */}
        <div className="w-80 flex-shrink-0 border-r border-border">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Clients</h3>
                </div>
                {selectedClientId && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSelectedClientId(null);
                      setClientSearchQuery("");
                    }}
                    className="h-7 px-3 bg-primary text-inherit font-medium shadow-sm"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    View All
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto">
              {filteredClientStats.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No clients found</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {filteredClientStats.map((clientStat) => {
                    const isSelected = selectedClientId === clientStat.clientId;
                    return (
                      <motion.button
                        key={clientStat.clientId}
                        onClick={() => setSelectedClientId(
                          isSelected ? null : clientStat.clientId
                        )}
                        className={cn(
                          "w-full p-3 rounded-lg border text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/50 hover:bg-accent/5"
                        )}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">
                              {clientStat.clientName}
                            </h4>
                            {isSelected && (
                              <Badge className="bg-primary text-primary-foreground text-xs mt-1">
                                Selected
                              </Badge>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                          )}
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">CO₂e Saved</span>
                            <span className="font-bold text-success">
                              {(clientStat.totalCO2e / 1000).toFixed(1)}t
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Net Benefit</span>
                            <span className="font-semibold text-foreground">
                              {(clientStat.netBenefit / 1000).toFixed(1)}t
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border/50">
                            <span className="text-muted-foreground">Jobs</span>
                            <span className="font-medium text-foreground">
                              {clientStat.completedCount}/{clientStat.jobCount}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary Footer */}
            {!selectedClientId && clientCO2Stats.length > 0 && (
              <div className="p-4 border-t border-border bg-muted/30">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total CO₂e Saved</span>
                    <span className="font-bold text-success">
                      {(clientCO2Stats.reduce((sum, c) => sum + c.totalCO2e, 0) / 1000).toFixed(1)}t
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Jobs</span>
                    <span className="font-semibold text-foreground">
                      {clientCO2Stats.reduce((sum, c) => sum + c.jobCount, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Active Clients</span>
                    <span className="font-semibold text-primary">
                      {clientCO2Stats.length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Content - Dashboard */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 pr-2">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Environmental Impact
                  {selectedClient && (
                    <span className="text-lg text-primary ml-2">- {selectedClient.name}</span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedClient 
                    ? `${selectedClient.name}'s CO₂e savings and ESG metrics`
                    : "Your clients' CO₂e savings and ESG metrics"}
                </p>
              </div>
            </motion.div>

            {/* Main Stats - Reduced Size */}
            <div className="grid gap-3 md:grid-cols-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
              >
                <Card className="bg-gradient-eco border-primary/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-success/10">
                        <TrendingUp className="h-4 w-4 text-success" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">CO₂e Saved</span>
                    </div>
                    <p className="text-2xl font-bold text-success">{(totalSaved / 1000).toFixed(1)}t</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Through IT asset reuse</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-destructive/10">
                        <Car className="h-4 w-4 text-destructive" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Travel Emissions</span>
                    </div>
                    <p className="text-2xl font-bold text-destructive">{totalTravel.toFixed(2)}kg</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Collection logistics</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="bg-gradient-hero text-primary-foreground">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-primary-foreground/10">
                        <Leaf className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium text-primary-foreground/80">Net Benefit</span>
                    </div>
                    <p className="text-2xl font-bold">{(netBenefit / 1000).toFixed(1)}t</p>
                    <p className="text-xs text-primary-foreground/70 mt-0.5">Total environmental impact</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Equivalencies - Reduced Size */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Impact Equivalencies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {equivalencies.map((item, index) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        className="text-center p-3 rounded-lg bg-secondary/50"
                      >
                        <item.icon className="h-6 w-6 mx-auto mb-1.5 text-primary" />
                        <p className="text-lg font-bold text-foreground">{item.value}</p>
                        <p className="text-xs font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Charts - Reduced Size */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Trend Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">CO₂e Savings Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData}>
                          <defs>
                            <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(168, 70%, 35%)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(168, 70%, 35%)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="month" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickFormatter={(value, index) => {
                              const dataPoint = monthlyData[index];
                              return dataPoint ? `${value} ${dataPoint.year}` : value;
                            }}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickFormatter={(v) => `${v/1000}t`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px"
                            }}
                            formatter={(value: number) => [`${(value/1000).toFixed(1)}t`, "CO₂e Saved"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="saved"
                            stroke="hsl(168, 70%, 35%)"
                            fillOpacity={1}
                            fill="url(#colorSaved)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Category Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Savings by Asset Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px"
                            }}
                            formatter={(value: number, name: string, props: any) => {
                              const actualValue = props.payload?.actualValue || 0;
                              return [
                                `${value}% (${(actualValue / 1000).toFixed(2)}t CO₂e)`,
                                "Contribution"
                              ];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 ml-3">
                        {categoryData.map((item) => (
                          <div key={item.name} className="flex items-center gap-2 text-xs">
                            <div 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="font-medium">{item.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Per-Job Breakdown - Reduced Size */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">CO₂e by Job</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        const chartData = filteredJobs.slice(0, 5).map(j => {
                          const date = new Date(j.scheduledDate);
                          const month = date.toLocaleDateString('en-GB', { month: 'short' });
                          const year = date.getFullYear();
                          return {
                            name: j.erpJobNumber, // Use full job number as key
                            jobNumber: j.erpJobNumber,
                            organisationName: j.organisationName,
                            siteName: j.siteName,
                            date: `${month} ${year}`,
                            fullName: `${j.erpJobNumber} - ${j.siteName} (${month} ${year})`,
                            // UI meaning: CO₂e Saved (net benefit) = reuse savings - travel emissions
                            saved: ((j.co2eSaved || 0) - (j.travelEmissions || 0)) / 1000,
                            travel: j.travelEmissions / 1000
                          };
                        });
                        
                        return (
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="name" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={10}
                              angle={-45}
                              textAnchor="end"
                              height={selectedClientId ? 80 : 100}
                              tick={(props: any) => {
                                const { x, y, payload, index } = props;
                                if (!payload) return null;
                                
                                const value = payload.value || payload;
                                const data = chartData.find(d => d.name === value);
                                if (!data) return null;
                                
                                // Estimate bar width: chart width / number of bars
                                // Approximate chart width for h-48 container (192px minus margins)
                                const estimatedChartWidth = 180;
                                const barCount = chartData.length;
                                const estimatedBarWidth = estimatedChartWidth / barCount;
                                
                                // Character width estimation (approximate: 6px per character at fontSize 10)
                                const charWidth = 6;
                                const maxChars = Math.floor((estimatedBarWidth * 0.9) / charWidth);
                                
                                // Show full text, but italicize if it would overflow
                                const organisationName = data.organisationName || '';
                                const siteName = data.siteName || '';
                                const date = data.date || '';
                                
                                const organisationOverflow = organisationName.length > maxChars;
                                const siteNameOverflow = siteName.length > maxChars;
                                const dateOverflow = date.length > maxChars;
                                
                                // Show organisation name when in "View All" state (no client selected)
                                const showOrganisationName = !selectedClientId;
                                
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    {showOrganisationName && (
                                      <text
                                        x={0}
                                        y={0}
                                        dy={16}
                                        textAnchor="middle"
                                        fill="hsl(var(--muted-foreground))"
                                        fontSize={10}
                                        fontStyle={organisationOverflow ? 'italic' : 'normal'}
                                      >
                                        {organisationName}
                                      </text>
                                    )}
                                    <text
                                      x={0}
                                      y={0}
                                      dy={showOrganisationName ? 28 : 16}
                                      textAnchor="middle"
                                      fill="hsl(var(--muted-foreground))"
                                      fontSize={10}
                                      fontStyle={siteNameOverflow ? 'italic' : 'normal'}
                                    >
                                      {siteName}
                                    </text>
                                    <text
                                      x={0}
                                      y={0}
                                      dy={showOrganisationName ? 40 : 28}
                                      textAnchor="middle"
                                      fill="hsl(var(--muted-foreground))"
                                      fontSize={10}
                                      fontStyle={dateOverflow ? 'italic' : 'normal'}
                                    >
                                      {date}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(v) => `${v}t`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px"
                          }}
                          formatter={(value: number) => [`${value.toFixed(2)}t`]}
                          labelFormatter={(label, payload) => {
                            if (payload && payload[0] && payload[0].payload) {
                              return payload[0].payload.fullName;
                            }
                            return label;
                          }}
                        />
                            <Bar dataKey="saved" name="CO₂e Saved" fill="hsl(168, 70%, 35%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        );
                      })()}
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // For non-resellers or when no clients: show original layout
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Environmental Impact</h2>
          <p className="text-muted-foreground">Your CO₂e savings and ESG metrics</p>
        </div>
      </motion.div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="bg-gradient-eco border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">CO₂e Saved</span>
              </div>
              <p className="text-4xl font-bold text-success">{(totalSaved / 1000).toFixed(1)}t</p>
              <p className="text-sm text-muted-foreground mt-1">Through IT asset reuse</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Car className="h-5 w-5 text-destructive" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Travel Emissions</span>
              </div>
              <p className="text-4xl font-bold text-destructive">{totalTravel.toFixed(2)}kg</p>
              <p className="text-sm text-muted-foreground mt-1">Collection logistics</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-hero text-primary-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary-foreground/10">
                  <Leaf className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-primary-foreground/80">Net Benefit</span>
              </div>
              <p className="text-4xl font-bold">{(netBenefit / 1000).toFixed(1)}t</p>
              <p className="text-sm text-primary-foreground/70 mt-1">Total environmental impact</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Equivalencies */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impact Equivalencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {equivalencies.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="text-center p-4 rounded-xl bg-secondary/50"
                >
                  <item.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-foreground">{item.value}</p>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CO₂e Savings Trend</CardTitle>
            </CardHeader>
            <CardContent className="pl-0 sm:pl-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ left: isNarrowScreen ? 0 : 10, right: 10, top: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(168, 70%, 35%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(168, 70%, 35%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value, index) => {
                        const dataPoint = monthlyData[index];
                        return dataPoint ? `${value} ${dataPoint.year}` : value;
                      }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => `${v/1000}t`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value: number) => [`${(value/1000).toFixed(1)}t`, "CO₂e Saved"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="saved"
                      stroke="hsl(168, 70%, 35%)"
                      fillOpacity={1}
                      fill="url(#colorSaved)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Savings by Asset Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 sm:h-64 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isNarrowScreen ? 40 : 60}
                      outerRadius={isNarrowScreen ? 60 : 90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value: number, name: string, props: any) => {
                        const actualValue = props.payload?.actualValue || 0;
                        return [
                          `${value}% (${(actualValue / 1000).toFixed(2)}t CO₂e)`,
                          "Contribution"
                        ];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 ml-4">
                  {categoryData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Per-Job Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CO₂e by Job</CardTitle>
          </CardHeader>
          <CardContent className="pl-0 sm:pl-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const chartData = filteredJobs.slice(0, 5).map(j => {
                    // Format date to show month and year
                    const date = new Date(j.scheduledDate);
                    const month = date.toLocaleDateString('en-GB', { month: 'short' });
                    const year = date.getFullYear();
                    return {
                      name: j.erpJobNumber, // Use full job number as key
                      jobNumber: j.erpJobNumber,
                      organisationName: j.organisationName,
                      siteName: j.siteName,
                      date: `${month} ${year}`,
                      fullName: `${j.erpJobNumber} - ${j.siteName} (${month} ${year})`,
                  saved: ((j.co2eSaved || 0) - (j.travelEmissions || 0)) / 1000,
                  travel: j.travelEmissions / 1000
                    };
                  });
                  
                  return (
                    <BarChart data={chartData} margin={{ left: isNarrowScreen ? 0 : 10, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                        fontSize={isNarrowScreen ? 9 : 11}
                        angle={isNarrowScreen ? -60 : -45}
                        textAnchor="end"
                        height={selectedClientId ? 80 : 100}
                         tick={(props: any) => {
                           const { x, y, payload, index } = props;
                          if (!payload) return null;
                          
                          const value = payload.value || payload;
                           const data = chartData.find(d => d.name === value);
                           if (!data) return null;
                           
                           // Estimate bar width: chart width / number of bars
                           // Adjust chart width estimation based on screen size
                           const estimatedChartWidth = isNarrowScreen ? (window.innerWidth - 40) : 240;
                           const barCount = chartData.length;
                           const estimatedBarWidth = estimatedChartWidth / barCount;
                           
                           // Character width estimation (adjust based on font size)
                           const fontSize = isNarrowScreen ? 9 : 11;
                           const charWidth = isNarrowScreen ? 5.5 : 6.5;
                           const maxChars = Math.floor((estimatedBarWidth * 0.8) / charWidth);
                           
                           // Helper function to truncate text
                           const truncateText = (text: string, maxLength: number) => {
                             if (text.length <= maxLength) return text;
                             return text.substring(0, maxLength - 3) + '...';
                           };
                           
                           // Show full text, but truncate if it would overflow on narrow screens
                           let organisationName = data.organisationName || '';
                           let siteName = data.siteName || '';
                           const date = data.date || '';
                           
                           if (isNarrowScreen) {
                             // Truncate text on narrow screens to prevent overflow
                             organisationName = truncateText(organisationName, maxChars);
                             siteName = truncateText(siteName, maxChars);
                          }
                          
                          const organisationOverflow = organisationName.length > maxChars;
                           const siteNameOverflow = siteName.length > maxChars;
                           const dateOverflow = date.length > maxChars;
                           
                           // Always show organisation name in the top line
                           const showOrganisationName = true;
                           
                           return (
                             <g transform={`translate(${x},${y})`}>
                               {showOrganisationName && (
                                 <text
                                   x={0}
                                   y={0}
                                   dy={16}
                                   textAnchor="middle"
                                   fill="hsl(var(--muted-foreground))"
                                   fontSize={fontSize}
                                   fontStyle={organisationOverflow ? 'italic' : 'normal'}
                                 >
                                   {organisationName}
                                 </text>
                               )}
                               <text
                                 x={0}
                                 y={0}
                                 dy={showOrganisationName ? 28 : 16}
                                 textAnchor="middle"
                                 fill="hsl(var(--muted-foreground))"
                                 fontSize={fontSize}
                                 fontStyle={siteNameOverflow ? 'italic' : 'normal'}
                               >
                                 {siteName}
                               </text>
                               <text
                                 x={0}
                                 y={0}
                                 dy={showOrganisationName ? 40 : 28}
                                 textAnchor="middle"
                                 fill="hsl(var(--muted-foreground))"
                                 fontSize={fontSize}
                                 fontStyle={dateOverflow ? 'italic' : 'normal'}
                               >
                                 {date}
                               </text>
                             </g>
                           );
                         }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `${v}t`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}t`]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0] && payload[0].payload) {
                        return payload[0].payload.fullName;
                      }
                      return label;
                    }}
                  />
                  <Bar dataKey="saved" name="CO₂e Saved" fill="hsl(168, 70%, 35%)" radius={[4, 4, 0, 0]} />
                </BarChart>
                  );
                })()}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default CO2eDashboard;
