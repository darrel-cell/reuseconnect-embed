/**
 * Which way the money goes between RTG and the client once the buyback (after the
 * charity share) and the cost of collection and processing are set against each
 * other. Replaces "Client responsibility", which read as money the client owes.
 *
 * @param net buyback after charity - cost of service (negative when the client pays)
 */
export function clientSettlement(net: number, viewerIsClient: boolean): { label: string; amount: number } {
  const rtgPays = net >= 0;
  const label = rtgPays
    ? viewerIsClient
      ? "RTG pays you"
      : "RTG pays the client"
    : viewerIsClient
      ? "You pay RTG"
      : "The client pays RTG";
  return { label, amount: Math.abs(net) };
}
