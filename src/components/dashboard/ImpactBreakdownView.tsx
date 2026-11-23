// Impact by organisation or by person: the dashboard's environmental figures (RTG's
// method, from graded stock), split up. The rows add up to the overview's totals.
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/services/api-error";
import { useEnvironmentalOverview } from "@/hooks/useEnvironmental";
import { formatFigure } from "@/lib/environmental-display";
import { ImpactRangeSelect } from "./ImpactRangeSelect";

type PageSize = "50" | "100" | "all";
const isPageSize = (value: string): value is PageSize => value === "50" || value === "100" || value === "all";

const COPY = {
  organisation: {
    title: "Impact by organisation",
    filterLabel: "Filter organisation",
    all: "All organisations",
    nameHeader: "Organisation",
    empty: "No graded stock from any organisation in this period.",
  },
  person: {
    title: "Impact by user",
    filterLabel: "Filter user",
    all: "All users",
    nameHeader: "User (employee or client contact)",
    empty: "No graded stock for any user in this period.",
  },
} as const;

export function ImpactBreakdownView({ by }: { by: keyof typeof COPY }) {
  const copy = COPY[by];
  const [months, setMonths] = useState(12);
  const [filterKey, setFilterKey] = useState("all");
  const [pageSize, setPageSize] = useState<PageSize>("50");
  const [page, setPage] = useState(1);
  const overview = useEnvironmentalOverview(null, months);

  const rows = useMemo(
    () => (by === "organisation" ? overview.data?.byOrganisation : overview.data?.byPerson) ?? [],
    [by, overview.data]
  );
  const filtered = filterKey === "all" ? rows : rows.filter((r) => r.key === filterKey);

  useEffect(() => {
    setPage(1);
  }, [filterKey, pageSize, months]);

  const size = pageSize === "all" ? null : Number(pageSize);
  const pageCount = size === null ? 1 : Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pageCount);
  const pageRows = size === null ? filtered : filtered.slice((safePage - 1) * size, safePage * size);
  const noFactorSet = overview.error instanceof ApiError && overview.error.statusCode === 409;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Avoided by reusing and recycling IT, worked out from graded stock in the month it was collected.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-[240px]">
            <label className="text-xs text-muted-foreground">{copy.filterLabel}</label>
            <Select value={filterKey} onValueChange={setFilterKey}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={copy.all} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.all}</SelectItem>
                {rows.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Period</label>
              <div className="mt-1">
                <ImpactRangeSelect months={months} onChange={setMonths} />
              </div>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground">Rows per page</label>
              <Select value={pageSize} onValueChange={(v) => { if (isPageSize(v)) setPageSize(v); }}>
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
        </div>

        {overview.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : noFactorSet ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No figures yet: RTG has not published its environmental factors.
          </p>
        ) : overview.error ? (
          <p className="py-8 text-center text-sm text-destructive">
            {overview.error instanceof Error ? overview.error.message : "Could not load the environmental figures"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.nameHeader}</TableHead>
                  <TableHead className="text-right">CO₂e avoided (t)</TableHead>
                  <TableHead className="text-right">Water saved (m³)</TableHead>
                  <TableHead className="text-right">Minerals (kg)</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFigure(Number(r.co2eKg) / 1000)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFigure(Number(r.waterLitres) / 1000)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFigure(Number(r.mineralsGrams) / 1000)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFigure(r.totalUnits)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.bookings}</TableCell>
                  </TableRow>
                ))}
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {copy.empty}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {size !== null && filtered.length > size && (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Showing {(safePage - 1) * size + 1} - {Math.min(safePage * size, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                Prev
              </Button>
              <span className="text-sm">
                Page {safePage} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
