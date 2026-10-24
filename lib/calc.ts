import { round2 } from "./money";

export type CalcLineInput = {
  category: string;
  title: string;
  quantity: number;
  unit: string;
  unitCost: number;
  surchargePercent: number;
};

export function priceCalcLine(line: CalcLineInput, marginPercent: number) {
  const base = round2(line.quantity * line.unitCost);
  const withSurcharge = round2(base * (1 + line.surchargePercent / 100));
  const sales = round2(withSurcharge * (1 + marginPercent / 100));
  const unitSales = round2(line.unitCost * (1 + line.surchargePercent / 100) * (1 + marginPercent / 100));
  return { base, withSurcharge, sales, unitSales };
}

export function summarizeCalculation(lines: CalcLineInput[], marginPercent: number) {
  const priced = lines.map((line) => ({ ...line, ...priceCalcLine(line, marginPercent) }));
  const cost = round2(priced.reduce((sum, line) => sum + line.base, 0));
  const overhead = round2(priced.reduce((sum, line) => sum + line.withSurcharge, 0));
  const sales = round2(priced.reduce((sum, line) => sum + line.sales, 0));
  const profit = round2(sales - cost);
  return { lines: priced, cost, overhead, sales, profit };
}
