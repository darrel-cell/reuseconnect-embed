// The dashboard's social section: donations RTG made to social projects, as
// recorded by RTG staff. Independent of the charity % chosen on each booking.
// Read only in the embed: RTG records donations on the platform.
import { HandHeart, Loader2, Receipt, Sprout } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDonationSummary } from "@/hooks/useDonations";
import type { DonationSummary } from "@/services/donations.service";
import { formatGbp } from "@/lib/cost-format";
import { formatDateShort } from "@/lib/datetime";
import { SectionHeading, StatTile } from "./impact-ui";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

export function SocialImpactSection({
  clientId,
  months,
  showClient,
}: {
  clientId: string | null;
  months: number;
  /** Show which client each donation was for (partners looking across clients). */
  showClient: boolean;
}) {
  const summary = useDonationSummary(clientId, months);

  return (
    <section className="space-y-4" aria-labelledby="social-impact-title">
      <SectionHeading
        id="social-impact-title"
        icon={HandHeart}
        title="Social impact"
        description="Donations RTG has made to social projects from the value recovered."
        busy={summary.isFetching}
      />

      {summary.isLoading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : summary.error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">{errorMessage(summary.error)}</CardContent>
        </Card>
      ) : summary.data ? (
        <SocialFigures data={summary.data} showClient={showClient} />
      ) : null}
    </section>
  );
}

function SocialFigures({ data, showClient }: { data: DonationSummary; showClient: boolean }) {
  const first = data.monthly[0]?.label;
  const last = data.monthly[data.monthly.length - 1]?.label;

  if (data.count === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No donations have been recorded between {first} and {last}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={HandHeart} label="Donated" value={formatGbp(data.total)} />
        <StatTile icon={Sprout} label="Projects supported" value={String(data.byProject.length)} />
        <StatTile icon={Receipt} label="Donations" value={String(data.count)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By project</CardTitle>
          <CardDescription>
            {first} to {last}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="text-right">Donations</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byProject.map((p) => (
                <TableRow key={`${p.project}|${p.recipient}`}>
                  <TableCell>{p.project}</TableCell>
                  <TableCell>{p.recipient}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatGbp(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Donations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {showClient && <TableHead>Client</TableHead>}
                <TableHead>Project</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.donations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap">{formatDateShort(d.donatedOn)}</TableCell>
                  {showClient && <TableCell>{d.clientName}</TableCell>}
                  <TableCell>
                    {d.project}
                    {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                  </TableCell>
                  <TableCell>{d.recipient}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatGbp(d.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        These are the donations actually made, recorded by RTG. They are separate from the charity percentage chosen on
        each booking.
      </p>
    </div>
  );
}
