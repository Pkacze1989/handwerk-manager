"use server";

import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirectWith, errorText, isRedirect } from "@/lib/errors";
import { parseGaeb } from "@/lib/gaeb";
import { parseDatanorm } from "@/lib/datanorm";
import { berlinToday, parseDateInput } from "@/lib/format";
import { saveUpload } from "@/lib/files";
import { lineNet, round2, totalsOf } from "@/lib/money";
import { nextDocumentNumber } from "@/lib/numbers";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function xmlFromForm(formData: FormData) {
  if (formData.get("sample") === "1") {
    return readFile(path.join(process.cwd(), "samples/gaeb/lv-tiefgarage.x83"), "utf8");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Keine GAEB-Datei gewählt.");
  return file.text();
}

export async function importGaeb(formData: FormData) {
  await requireUser();
  try {
    const parsed = parseGaeb(await xmlFromForm(formData));
    const customerId = text(formData, "customerId");
    if (!customerId) redirectWith("/schnittstellen", { fehler: "Bitte einen Kunden für den Import wählen." });
    const projectId = text(formData, "projectId") || null;
    const lines = parsed.items.map((item, position) => ({
      position,
      kind: "POSITION",
      source: "GAEB",
      sku: item.rno,
      title: item.title,
      description: item.description || null,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? 0,
      lineTotal: lineNet(item.quantity, item.unitPrice ?? 0),
    }));
    const totals = totalsOf(lines, 19);
    const today = berlinToday();
    const document = await prisma.document.create({
      data: {
        type: parsed.dp === "84" ? "AUFTRAGSBESTAETIGUNG" : "ANGEBOT",
        number: await nextDocumentNumber(parsed.dp === "84" ? "AUFTRAGSBESTAETIGUNG" : "ANGEBOT"),
        status: "ENTWURF",
        customerId,
        projectId,
        date: parseDateInput(today)!,
        intro: `Importiertes Leistungsverzeichnis „${parsed.boqName}“ (${parsed.projectName}).`,
        outro: "Bitte Positionen und Preise prüfen.",
        internalNote: `GAEB DP ${parsed.dp}, ${parsed.items.length} Positionen.`,
        taxRate: 19,
        ...totals,
        lines: { create: lines },
      },
    });
    redirectWith(`/buero/${document.id}`, { hinweis: `${parsed.items.length} GAEB-Positionen importiert.` });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/schnittstellen", { fehler: errorText(error) });
  }
}

async function datanormText(formData: FormData) {
  if (formData.get("sample") === "1" || text(formData, "stored") === "sample") {
    return readFile(path.join(process.cwd(), "samples/datanorm/elektro-nord.datanorm"), "utf8");
  }
  const storedName = text(formData, "stored");
  if (storedName) {
    const { readStored } = await import("@/lib/files");
    return (await readStored(storedName)).toString("utf8");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Keine DATANORM-Datei gewählt.");
  const saved = await saveUpload(file, "datanorm");
  if (!saved) throw new Error("Datei leer.");
  return { text: saved.bytes.toString("utf8"), stored: saved.path };
}

export async function previewDatanorm(formData: FormData) {
  await requireUser();
  try {
    const loaded = await datanormText(formData);
    const content = typeof loaded === "string" ? loaded : loaded.text;
    parseDatanorm(content);
    if (typeof loaded === "string") redirectWith("/schnittstellen?datanorm=sample", {});
    redirectWith(`/schnittstellen?datanorm=${encodeURIComponent(loaded.stored)}`, {});
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/schnittstellen", { fehler: errorText(error) });
  }
}

export async function applyDatanorm(formData: FormData) {
  await requireUser();
  try {
    const loaded = await datanormText(formData);
    const content = typeof loaded === "string" ? loaded : loaded.text;
    const parsed = parseDatanorm(content);
    const supplierId = text(formData, "supplierId") || null;
    let created = 0;
    let updated = 0;
    let removed = 0;
    for (const article of parsed.articles) {
      const existing = await prisma.article.findUnique({ where: { sku: article.sku } });
      if (article.action === "L") {
        if (existing) {
          await prisma.article.delete({ where: { id: existing.id } });
          removed += 1;
        }
        continue;
      }
      if (existing) {
        await prisma.article.update({
          where: { id: existing.id },
          data: {
            name: article.name,
            unit: article.unit,
            purchasePrice: round2(article.purchasePrice),
            salesPrice: round2(article.salesPrice),
            vatRate: article.vatRate,
            supplierId: supplierId || existing.supplierId,
          },
        });
        updated += 1;
      } else {
        await prisma.article.create({
          data: {
            sku: article.sku,
            name: article.name,
            unit: article.unit,
            purchasePrice: round2(article.purchasePrice),
            salesPrice: round2(article.salesPrice),
            vatRate: article.vatRate,
            supplierId,
            matchTerms: article.name,
          },
        });
        created += 1;
      }
    }
    redirectWith("/stammdaten/material", {
      hinweis: `DATANORM übernommen: ${created} neu, ${updated} Preise geändert, ${removed} gelöscht.`,
    });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/schnittstellen", { fehler: errorText(error) });
  }
}
