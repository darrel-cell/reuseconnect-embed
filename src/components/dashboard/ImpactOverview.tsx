// The Impact Overview: one set of filters (client, period) for every impact section.
// Every figure comes from graded stock by RTG's method, job buyback and costs, or donations RTG recorded.
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useClients } from "@/hooks/useClients";
import { isAdminLikeRole } from "@/lib/roles";
import { ClientPicker, useClientOptions } from "@/components/environmental/ClientPicker";
import { EnvironmentalOverviewSection } from "./EnvironmentalOverviewSection";
import { FinancialImpactSection } from "./FinancialImpactSection";
import { ImpactRangeSelect } from "./ImpactRangeSelect";
import { SocialImpactSection } from "./SocialImpactSection";

export function ImpactOverview() {
  const { user } = useAuth();
  const isStaff = isAdminLikeRole(user?.role);
  // Staff and partners can narrow to one client; a client user always sees their own organisation.
  const canPickClient = isStaff || user?.role === "partner";
  const clients = useClients();
  const clientOptions = useClientOptions(clients.data);
  const [clientId, setClientId] = useState<string | null>(null);
  const [months, setMonths] = useState(12);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          The environmental, financial and social impact of reuse: graded stock, buyback and the donations RTG has made.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canPickClient && (
            <ClientPicker
              id="impact-client"
              options={clientOptions}
              value={clientId}
              onChange={setClientId}
              loading={clients.isLoading}
              allLabel="All clients"
              className="w-full sm:w-64"
            />
          )}
          <ImpactRangeSelect months={months} onChange={setMonths} />
        </div>
      </div>

      <EnvironmentalOverviewSection clientId={clientId} months={months} />
      <FinancialImpactSection
        clientId={clientId}
        months={months}
        showClient={canPickClient && !clientId}
        viewer={isStaff ? "staff" : user?.role === "partner" ? "partner" : "client"}
      />
      <SocialImpactSection clientId={clientId} months={months} showClient={canPickClient && !clientId} />
    </div>
  );
}
