export function round2(value: number) {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

export function parseAmount(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  let raw = String(input ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace("€", "")
    .replace("EUR", "");
  if (!raw) return NaN;
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export function lineNet(quantity: number, unitPrice: number) {
  return round2(quantity * unitPrice);
}

export function totalsOf(
  lines: { kind: string; quantity: number; unitPrice: number }[],
  taxRate: number,
) {
  const net = round2(
    lines.filter((line) => line.kind !== "TEXT").reduce((sum, line) => sum + lineNet(line.quantity, line.unitPrice), 0),
  );
  const tax = round2((net * taxRate) / 100);
  const gross = round2(net + tax);
  return { net, tax, gross };
}
