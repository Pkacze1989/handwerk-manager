"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirectWith } from "@/lib/errors";
import { summarizeCalculation } from "@/lib/calc";
import { projectControlling } from "@/lib/controlling";
import { berlinToday, parseDateInput } from "@/lib/format";
import { lineNet, parseAmount, totalsOf } from "@/lib/money";
import { nextDocumentNumber } from "@/lib/numbers";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function addCalcLine(formData: FormData) {
  await requireUser();
  const projectId = text(formData, "projectId");
  let calcId = text(formData, "calculationId");
  if (!calcId) {
    const calc = await prisma.calculation.create({
      data: { projectId, title: "Vorkalkulation", surchargePercent: 15, marginPercent: 12 },
    });
    calcId = calc.id;
  }
  const quantity = parseAmount(formData.get("quantity"));
  const unitCost = parseAmount(formData.get("unitCost"));
  const surcharge = parseAmount(formData.get("surchargePercent") || "0");
  await prisma.calcLine.create({
    data: {
      calculationId: calcId,
      category: text(formData, "category") || "MATERIAL",
      title: text(formData, "title"),
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unit: text(formData, "unit") || "Stk",
      unitCost: Number.isFinite(unitCost) ? unitCost : 0,
      surchargePercent: Number.isFinite(surcharge) ? surcharge : 0,
    },
  });
  redirectWith(`/projekte/${projectId}?tab=kalkulation`, { hinweis: "Kostenposition ergänzt." });
}

export async function updateCalcSettings(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const calc = await prisma.calculation.update({
    where: { id },
    data: {
      title: text(formData, "title") || "Vorkalkulation",
      marginPercent: parseAmount(formData.get("marginPercent") || "0") || 0,
      surchargePercent: parseAmount(formData.get("surchargePercent") || "0") || 0,
    },
  });
  redirectWith(`/projekte/${calc.projectId}?tab=kalkulation`, { hinweis: "Zuschlag und Gewinn gespeichert." });
}

export async function deleteCalcLine(formData: FormData) {
  await requireUser();
  const line = await prisma.calcLine.delete({ where: { id: text(formData, "id") }, include: { calculation: true } });
  redirectWith(`/projekte/${line.calculation.projectId}?tab=kalkulation`, { hinweis: "Position entfernt." });
}

export async function quoteFromCalc(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const calc = await prisma.calculation.findUnique({ where: { id }, include: { lines: true, project: true } });
  if (!calc) redirectWith("/projekte", { fehler: "Kalkulation nicht gefunden." });
  const summary = summarizeCalculation(
    calc.lines.map((line) => ({
      category: line.category,
      title: line.title,
      quantity: line.quantity,
      unit: line.unit,
      unitCost: line.unitCost,
      surchargePercent: line.surchargePercent,
    })),
    calc.marginPercent,
  );
  const lines = summary.lines.map((line, position) => ({
    position,
    kind: "POSITION",
    source: "FREE",
    title: line.title,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitSales,
    lineTotal: lineNet(line.quantity, line.unitSales),
  }));
  const totals = totalsOf(lines, 19);
  const today = berlinToday();
  const document = await prisma.document.create({
    data: {
      type: "ANGEBOT",
      number: await nextDocumentNumber("ANGEBOT"),
      status: "ENTWURF",
      customerId: calc.project.customerId,
      projectId: calc.projectId,
      date: parseDateInput(today)!,
      intro: "vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen die folgenden Leistungen an.",
      outro: "Dieses Angebot ist 30 Tage gültig.",
      internalNote: `Aus Vorkalkulation. Selbstkosten ${summary.cost.toFixed(2)}, Verkauf ${summary.sales.toFixed(2)}.`,
      taxRate: 19,
      ...totals,
      lines: { create: lines },
    },
  });
  redirectWith(`/buero/${document.id}`, { hinweis: "Angebot aus der Vorkalkulation erzeugt. Einzelpreise sind auf Cent gerundet." });
}

export async function takeSnapshot(formData: FormData) {
  await requireUser();
  const projectId = text(formData, "projectId");
  const report = await projectControlling(projectId);
  await prisma.calcSnapshot.create({
    data: {
      projectId,
      label: text(formData, "label") || "Stand",
      sollNet: report.quoteNet ?? 0,
      istCost: report.actualCost,
      invoiced: report.invoicedNet,
      profit: report.profitOnInvoiced,
      detailJson: JSON.stringify({
        quoteNumber: report.quoteNumber,
        plannedCost: report.plannedCost,
        actualWage: report.actualWage,
        actualMaterial: report.actualMaterial,
        categories: report.categories,
      }),
    },
  });
  const close = formData.get("close") === "1";
  if (close) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "ABGESCHLOSSEN", closedAt: new Date() } });
  }
  redirectWith(`/projekte/${projectId}?tab=kalkulation`, { hinweis: close ? "Projekt abgeschlossen und Nachkalkulation festgehalten." : "Nachkalkulation festgehalten." });
}
