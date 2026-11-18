// The dashboard's environmental section: CO2e avoided, water saved and minerals
// conserved by RTG's method, from graded stock, over the last N months.
import { AlertTriangle, Car, Droplets, Gem, Leaf, Loader2, Recycle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/services/api-error";
import { useEnvironmentalOverview } from "@/hooks/useEnvironmental";
import type { EquivalencyResult, OverviewImpact } from "@/services/environmental.service";
import { formatFigure } from "@/lib/environmental-display";
import { SectionHeading, StatTile } from "./impact-ui";

const BAR = "hsl(var(--primary))";
/** Axis ticks: short at any scale, from 0.025 kg to 3.4K m³. */
const TICK = new Intl.NumberFormat("en-GB", { notation: "compact", maximumSignificantDigits: 3 });

type Measure = {
  key: "co2eKg" | "waterLitres" | "mineralsGrams";
  title: string;
  unit: string;
  /** Raw value (kg, litres, grams) -> the unit shown. */
  scale: number;
};

const MEASURES: Measure[] = [
  { key: "co2eKg", title: "CO₂e avoided", unit: "t", scale: 1000 },
  { key: "waterLitres", title: "Water saved", unit: "m³", scale: 1000 },
  { key: "mineralsGrams", title: "Critical minerals conserved", unit: "kg", scale: 1000 },
];

export function EnvironmentalOverviewSection({ clientId, months }: { clientId: string | null; months: number }) {
  const overview = useEnvironmentalOverview(clientId, months);

  // Nothing to show until RTG publishes a factor set.
  if (overview.error instanceof ApiError && overview.error.statusCode === 409) return null;

  return (
    <section className="space-y-4" aria-labelledby="env-overview-title">
      <SectionHeading
        id="env-overview-title"
        icon={Leaf}
        title="Environmental impact"
        description="Avoided by reusing and recycling IT, worked out from graded stock in the month it was collected."
        busy={overview.isFetching}
      />

      {overview.isLoading ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : overview.error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {overview.error instanceof Error ? overview.error.message : "Could not load the environmental figures"}
          </CardContent>
        </Card>
      ) : overview.data ? (
        <OverviewFigures data={overview.data} />
      ) : null}
    </section>
  );
}

function OverviewFigures({ data }: { data: OverviewImpact }) {
  const { display, result, monthly, unmapped, warnings, factorSet, equivalencies } = data;
  const first = monthly[0]?.label;
  const last = monthly[monthly.length - 1]?.label;

  if (result.totalUnits === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No graded stock was collected between {first} and {last}, so there are no figures to show yet.
        </CardContent>
      </Card>
    );
  }

  // Footnote numbers for the comparisons that have a published source.
  const sourced = [equivalencies.car_miles, equivalencies.household_water_days].filter((e) => e.value !== null);
  const noteOf = (e: EquivalencyResult) => (e.value === null ? "" : "¹²"[sourced.indexOf(e)]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Leaf} label="CO₂e avoided" value={formatFigure(display.co2eTonnes)} unit="tonnes" />
        <StatTile icon={Droplets} label="Water saved" value={formatFigure(display.waterM3)} unit="m³" />
        <StatTile icon={Gem} label="Critical minerals conserved" value={formatFigure(display.mineralsKg)} unit="kg" />
        <StatTile
          icon={Recycle}
          label="Reuse rate"
          value={`${formatFigure(display.reuseRatePct)}%`}
          note={`${formatFigure(result.unitsReused)} of ${formatFigure(result.totalUnits)} units reused`}
        />
      </div>

      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
          <Comparison
            icon={Car}
            equivalency={equivalencies.car_miles}
            text={(v) => `${formatFigure(v)} miles not driven by an average UK car`}
            missing="Miles not driven"
            note={noteOf(equivalencies.car_miles)}
          />
          <Comparison
            icon={Droplets}
            equivalency={equivalencies.household_water_days}
            text={(v) => `${formatFigure(v)} days of average household water use`}
            missing="Household water use"
            note={noteOf(equivalencies.household_water_days)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {MEASURES.map((m) => (
          <MonthlyChart key={m.key} measure={m} monthly={monthly} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">By stock class</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stock class</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">CO₂e (t)</TableHead>
                <TableHead className="text-right">Water (m³)</TableHead>
                <TableHead className="text-right">Minerals (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...result.categories]
                .sort((a, b) => Number(b.co2eKg) - Number(a.co2eKg))
                .map((c) => (
                  <TableRow key={c.rtgCategoryName}>
                    <TableCell className="py-2">{c.rtgCategoryName}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatFigure(c.unitsReused + c.unitsRecycled)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatFigure(Number(c.co2eKg) / 1000)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatFigure(Number(c.waterLitres) / 1000)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatFigure(Number(c.mineralsGrams) / 1000)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(unmapped.length > 0 || warnings.missingCollectionDate > 0) && (
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {unmapped.length > 0 &&
              `Not included, as no environmental factor is set for the category yet: ${unmapped
                .map((u) => `${u.assetCategoryName} (${formatFigure(u.unitsReused + u.unitsRecycled)})`)
                .join(", ")}. `}
            {warnings.missingCollectionDate > 0 &&
              `${formatFigure(warnings.missingCollectionDate)} graded record${
                warnings.missingCollectionDate === 1 ? " has" : "s have"
              } no collection date, so ${warnings.missingCollectionDate === 1 ? "it is" : "they are"} not counted.`}
          </p>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        {sourced.map((e) => (
          <p key={e.key}>
            {noteOf(e)} Source: {e.source}
            {e.year ? ` (${e.year})` : ""}.{e.scopeNote ? ` ${e.scopeNote}.` : ""}
          </p>
        ))}
        <p>
          Figures follow {factorSet.methodologyLabel} (factor set v{factorSet.version}), {first} to {last}.
        </p>
      </div>
    </div>
  );
}

function Comparison({
  icon: Icon,
  equivalency,
  text,
  missing,
  note,
}: {
  icon: typeof Car;
  equivalency: EquivalencyResult;
  text: (value: number) => string;
  missing: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </div>
      <p className="text-sm">
        {equivalency.value === null ? (
          <>
            {missing}: <span className="text-muted-foreground">no verifiable data available.</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Equivalent to about</span>{" "}
            <span className="font-medium">{text(equivalency.value)}</span>
            <span className="ml-0.5 align-super text-xs text-muted-foreground">{note}</span>
          </>
        )}
      </p>
    </div>
  );
}

function MonthlyChart({ measure, monthly }: { measure: Measure; monthly: OverviewImpact["monthly"] }) {
  const rows = monthly.map((m) => ({ label: m.label, value: Number(m[measure.key]) / measure.scale }));
  const fmt = (v: number) => `${formatFigure(v)} ${measure.unit}`;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {measure.title} by month ({measure.unit})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => v.slice(0, 3)}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => TICK.format(v)}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v: number) => [fmt(v), measure.title]}
              />
              <Bar dataKey="value" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
