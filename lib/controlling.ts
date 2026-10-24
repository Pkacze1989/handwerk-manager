import { prisma } from "./db";
import { hoursBetween } from "./format";
import { PAID_TIME, CALC_CATEGORIES, labelOf } from "./labels";
import { summarizeCalculation, type CalcLineInput } from "./calc";
import { round2 } from "./money";

export async function projectControlling(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: { include: { lines: true, payments: true } },
      times: { include: { user: true } },
      invoices: true,
      calcs: { include: { lines: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) throw new Error("Projekt nicht gefunden.");

  const quotes = project.documents.filter((doc) => doc.type === "ANGEBOT" && doc.status !== "STORNIERT");
  const accepted = quotes.find((doc) => doc.status === "ANGENOMMEN") ?? quotes[0];
  const invoices = project.documents.filter(
    (doc) =>
      ["ABSCHLAG_PAUSCHAL", "ABSCHLAG_KUMULATIV", "SCHLUSSRECHNUNG"].includes(doc.type) &&
      !["STORNIERT", "ENTWURF"].includes(doc.status),
  );
  const invoicedNet = round2(invoices.reduce((sum, doc) => sum + doc.net, 0));

  const calc = project.calcs[0];
  const calcLines: CalcLineInput[] =
    calc?.lines.map((line) => ({
      category: line.category,
      title: line.title,
      quantity: line.quantity,
      unit: line.unit,
      unitCost: line.unitCost,
      surchargePercent: line.surchargePercent,
    })) ?? [];
  const summary = calc ? summarizeCalculation(calcLines, calc.marginPercent) : null;

  const wageMap = new Map<string, { name: string; hours: number; rate: number; cost: number }>();
  let hours = 0;
  for (const entry of project.times) {
    if (!PAID_TIME.has(entry.type)) continue;
    const end = entry.end ?? new Date();
    const duration = hoursBetween(entry.start, end);
    hours += duration;
    const current = wageMap.get(entry.userId) ?? {
      name: entry.user.name,
      hours: 0,
      rate: entry.user.hourlyRate,
      cost: 0,
    };
    current.hours = round2(current.hours + duration);
    current.cost = round2(current.hours * current.rate);
    wageMap.set(entry.userId, current);
  }
  const wages = [...wageMap.values()];
  const actualWage = round2(wages.reduce((sum, wage) => sum + wage.cost, 0));
  const actualMaterial = round2(
    project.invoices.filter((invoice) => invoice.status !== "ENTWURF").reduce((sum, invoice) => sum + invoice.net, 0),
  );
  const actualCost = round2(actualWage + actualMaterial);

  const sollByCategory = new Map<string, number>();
  if (summary) {
    for (const line of summary.lines) {
      sollByCategory.set(line.category, round2((sollByCategory.get(line.category) ?? 0) + line.base));
    }
  }
  const categories = CALC_CATEGORIES.map(([key, label]) => ({
    key,
    label,
    soll: summary ? (sollByCategory.get(key) ?? 0) : null,
    ist: key === "LOHN" ? actualWage : key === "MATERIAL" ? actualMaterial : 0,
  }));

  return {
    project,
    quoteNet: accepted ? accepted.net : null,
    quoteNumber: accepted?.number ?? null,
    invoicedNet,
    plannedCost: summary ? summary.cost : null,
    plannedSales: summary ? summary.sales : null,
    actualWage,
    actualMaterial,
    actualCost,
    hours: round2(hours),
    profitOnInvoiced: round2(invoicedNet - actualCost),
    profitOnQuote: accepted ? round2(accepted.net - actualCost) : null,
    categories,
    wages,
    categoryLabel: (key: string) => labelOf(CALC_CATEGORIES, key),
  };
}
