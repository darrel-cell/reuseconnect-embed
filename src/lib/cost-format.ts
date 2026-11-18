const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const qty = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });

/** Cost-calculator figures arrive as unrounded decimal strings; round to pence for display only. */
export const formatGbp = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : gbp.format(Number(value));

export const formatQuantity = (value: string | number) => qty.format(Number(value));
