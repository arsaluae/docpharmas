/**
 * Single source of truth for invoice / order / return line math.
 *
 * Rules:
 *  - `amount` (line) is always EX-TAX (gross − discount). Tax is carried at the header,
 *    derived from per-line `gst_rate`, so reports can mix it freely with ex-tax COGS.
 *  - All monetary values are rounded to 2 dp using banker-safe rounding before persistence
 *    or display, eliminating float drift between Σ(lines) and header totals.
 *  - MRP is informational only and never enters any calculation here.
 */

export const round2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export interface CalcLineInput {
  quantity: number | string;
  rate: number | string;
  discount_pct?: number | string;
  gst_rate?: number | string;
}

export interface CalcLineResult {
  gross: number;       // qty × rate (no discount, no tax)
  discount: number;    // gross × disc%
  net: number;         // gross − discount (ex-tax) — this is `amount`
  tax: number;         // net × gst%
  total: number;       // net + tax (inc-tax)
}

export const calcLine = (i: CalcLineInput, gstEnabled = true): CalcLineResult => {
  const qty = Number(i.quantity) || 0;
  const rate = Number(i.rate) || 0;
  const discPct = Number(i.discount_pct || 0);
  const gstRate = gstEnabled ? Number(i.gst_rate || 0) : 0;

  const gross = round2(qty * rate);
  const discount = round2(gross * discPct / 100);
  const net = round2(gross - discount);
  const tax = round2(net * gstRate / 100);
  const total = round2(net + tax);
  return { gross, discount, net, tax, total };
};

export interface CalcTotalsResult {
  subtotal: number; // Σ net   (ex-tax)
  gst: number;      // Σ tax
  total: number;    // subtotal + gst
}

export const calcTotals = (lines: CalcLineInput[], gstEnabled = true): CalcTotalsResult => {
  let subtotal = 0;
  let gst = 0;
  for (const line of lines) {
    const c = calcLine(line, gstEnabled);
    subtotal += c.net;
    gst += c.tax;
  }
  subtotal = round2(subtotal);
  gst = round2(gst);
  return { subtotal, gst, total: round2(subtotal + gst) };
};
