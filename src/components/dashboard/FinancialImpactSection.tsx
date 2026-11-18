// The dashboard's financial section: buyback from the equipment collected, less the
// charity share and the cost of collection and processing, both as confirmed by RTG
// (final) and as estimated at booking for work still in progress. The embed does not
// show the partner revenue share; that stays on the main platform.
import { AlertTriangle, Loader2, PoundSterling, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinancialOverview } from "@/hooks/useFinancialImpact";
import type { FinancialOverview } from "@/services/financial-impact.service";
import { clientSettlement } from "@/lib/client-settlement";
import { formatGbp } from "@/lib/cost-format";
import { cn } from "@/lib/utils";
import { SectionHeading, StatTile } from "./impact-ui";

const FINAL = "hsl(var(--primary))";
/** The estimate is the same measure, not yet confirmed: the same hue, lighter, with a dashed edge. */
const ESTIMATED_OPACITY = 0.25;
const TICK = new Intl.NumberFormat("en-GB", { notation: "compact", maximumSignificantDigits: 3, style: "currency", currency: "GBP" });

const jobsLabel = (n: number) => `${n} job${n === 1 ? "" : "s"}`;

/** Who is looking: decides the wording ("RTG pays you") and what is shown. */
type Viewer = "client" | "partner" | "staff";

export function FinancialImpactSection({
  clientId,
  months,
  showClient,
  viewer,
}: {
  clientId: string | null;
  months: number;
  /** Show the by-client table (staff and partners looking across clients). */
  showClient: boolean;
  viewer: Viewer;
}) {
  const overview = useFinancialOverview(clientId, months);

  return (
    <section className="space-y-4" aria-labelledby="financial-impact-title">
      <SectionHeading
        id="financial-impact-title"
        icon={PoundSterling}
        title="Financial impact"
        description="Buyback for the equipment collected, less the charity share and the cost of collection and processing."
        busy={overview.isFetching}
      />

      {overview.isLoading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : overview.error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {overview.error instanceof Error ? overview.error.message : "Could not load the financial figures"}
          </CardContent>
        </Card>
      ) : overview.data ? (
        <FinancialFigures data={overview.data} showClient={showClient} viewer={viewer} acrossClients={!clientId} />
      ) : null}
    </section>
  );
}

function FinancialFigures({
  data,
  showClient,
  viewer,
  acrossClients,
}: {
  data: FinancialOverview;
  showClient: boolean;
  viewer: Viewer;
  acrossClients: boolean;
}) {
  const { final, estimated, monthly } = data;
  const first = monthly[0]?.label;
  const last = monthly[monthly.length - 1]?.label;

  if (final.jobs === 0 && estimated.jobs === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No collections between {first} and {last}, and none booked since, so there are no figures to show yet.
        </CardContent>
      </Card>
    );
  }

  const withoutCost = final.withoutCost + estimated.withoutCost;
  // Which way the money goes, as on the job page; across several clients it is the overall balance.
  const balanceNote = (net: string) =>
    viewer !== "client" && acrossClients
      ? Number(net) < 0
        ? "Clients pay RTG, overall"
        : "RTG pays clients, overall"
      : clientSettlement(Number(net), viewer === "client").label;
  const hasEstimates = monthly.some((m) => Number(m.estimated) > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={PoundSterling} label="Buyback, final" value={formatGbp(final.buyback)} note={`${jobsLabel(final.jobs)}, confirmed by RTG`} />
        <StatTile
          icon={PoundSterling}
          label="Buyback, estimated"
          value={formatGbp(estimated.buyback)}
          note={`${jobsLabel(estimated.jobs)} in progress`}
        />
        <StatTile
          icon={Wallet}
          label="Balance, final"
          value={formatGbp(Math.abs(Number(final.net)))}
          note={final.jobs ? balanceNote(final.net) : "None confirmed yet"}
        />
        <StatTile
          icon={Wallet}
          label="Balance, estimated"
          value={formatGbp(Math.abs(Number(estimated.net)))}
          note={estimated.jobs ? balanceNote(estimated.net) : "Nothing in progress"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">How the net is worked out</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead className="text-right">Final</TableHead>
                  <TableHead className="text-right">Estimated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <StatementRow label="Buyback" final={final.buyback} estimated={estimated.buyback} />
                <StatementRow label="Charity share" final={final.charity} estimated={estimated.charity} minus />
                <StatementRow label="Collection and processing" final={final.cost} estimated={estimated.cost} minus />
                <StatementRow label="Net to client" final={final.net} estimated={estimated.net} total />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Buyback by month</CardTitle>
            {/* Drawn here rather than by Recharts, whose legend ignores the estimate's lighter fill. */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
                Final
              </span>
              {hasEstimates && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-primary bg-primary/25" aria-hidden />
                  Estimated
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthly.map((m) => ({ label: m.label, final: Number(m.final), estimated: Number(m.estimated) }))}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  barCategoryGap={2}
                >
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
                    width={52}
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
                    formatter={(v: number, name: string) => [formatGbp(v), name]}
                  />
                  <Bar dataKey="final" name="Final" stackId="buyback" fill={FINAL} maxBarSize={28} />
                  {hasEstimates && (
                    <Bar
                      dataKey="estimated"
                      name="Estimated"
                      stackId="buyback"
                      fill={FINAL}
                      fillOpacity={ESTIMATED_OPACITY}
                      stroke={FINAL}
                      strokeDasharray="3 2"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {showClient && data.byClient.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">By client</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Buyback, final</TableHead>
                  <TableHead className="text-right">Buyback, estimated</TableHead>
                  <TableHead className="text-right">Net to client, final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byClient.map((c) => (
                  <TableRow key={c.clientId ?? c.clientName}>
                    <TableCell className="py-2">
                      {c.clientName}
                      {c.contactName && <span className="text-muted-foreground"> · {c.contactName}</span>}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatGbp(c.final.buyback)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatGbp(c.estimated.buyback)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatGbp(c.final.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {withoutCost > 0 && (
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {jobsLabel(withoutCost)} {withoutCost === 1 ? "has" : "have"} no collection and processing cost yet, so{" "}
            {withoutCost === 1 ? "it is" : "they are"} counted at £0 until the cost is set.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Final: buyback values RTG has confirmed, for equipment collected {first} to {last}. Estimated: the value worked out
        at booking, for work still in progress, including bookings not yet collected; it is replaced once RTG confirms the
        final value. The charity share is the percentage chosen on each booking.
      </p>
    </div>
  );
}

function StatementRow({
  label,
  final,
  estimated,
  minus,
  total,
}: {
  label: string;
  final: string;
  estimated: string;
  minus?: boolean;
  total?: boolean;
}) {
  const fmt = (v: string) => (minus && Number(v) !== 0 ? `−${formatGbp(v)}` : formatGbp(v));
  return (
    <TableRow className={cn(total && "border-t-2 font-semibold hover:bg-transparent")}>
      <TableCell className="py-2">{label}</TableCell>
      <TableCell className="whitespace-nowrap py-2 text-right tabular-nums">{fmt(final)}</TableCell>
      <TableCell className="whitespace-nowrap py-2 text-right tabular-nums">{fmt(estimated)}</TableCell>
    </TableRow>
  );
}

