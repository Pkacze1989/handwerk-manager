"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirectWith } from "@/lib/errors";
import { looksLikeText, saveUpload } from "@/lib/files";
import { extractInvoice } from "@/lib/ai";
import { parseAmount, round2 } from "@/lib/money";
import { parseDateInput, berlinToday } from "@/lib/format";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function intakeInvoice(formData: FormData) {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirectWith("/finanzen/eingang", { fehler: "Bitte eine Datei wählen." });
  const stored = await saveUpload(file, "eingang");
  if (!stored) redirectWith("/finanzen/eingang", { fehler: "Datei leer." });
  const raw = looksLikeText(stored.bytes) ? stored.bytes.toString("utf8") : "";
  const extracted = raw ? extractInvoice(raw, stored.fileName) : { notes: ["Datei gespeichert. Kein Text erkannt, bitte die Felder füllen."] };
  const suppliers = await prisma.supplier.findMany();
  const supplier = extracted.supplierName
    ? suppliers.find((entry) => entry.name.toLowerCase().includes(extracted.supplierName!.toLowerCase()) || extracted.supplierName!.toLowerCase().includes(entry.name.toLowerCase()))
    : undefined;
  const invoice = await prisma.incomingInvoice.create({
    data: {
      supplierId: supplier?.id,
      supplierName: extracted.supplierName || supplier?.name || null,
      number: extracted.number || "ohne Nummer",
      date: extracted.date ? parseDateInput(extracted.date)! : parseDateInput(berlinToday())!,
      net: extracted.net ?? 0,
      tax: extracted.tax ?? 0,
      gross: extracted.gross ?? 0,
      filePath: stored.path,
      fileName: stored.fileName,
      rawText: raw.slice(0, 20000) || null,
      notes: extracted.notes.join("\n"),
      status: "ENTWURF",
    },
  });
  redirectWith(`/finanzen/eingang/${invoice.id}`, { hinweis: "Eingangsrechnung erkannt. Bitte prüfen." });
}

export async function saveIncoming(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const net = parseAmount(formData.get("net"));
  const tax = parseAmount(formData.get("tax"));
  const gross = parseAmount(formData.get("gross"));
  await prisma.incomingInvoice.update({
    where: { id },
    data: {
      supplierId: text(formData, "supplierId") || null,
      supplierName: text(formData, "supplierName") || null,
      projectId: text(formData, "projectId") || null,
      number: text(formData, "number"),
      date: parseDateInput(text(formData, "date")) ?? undefined,
      net: Number.isFinite(net) ? round2(net) : 0,
      tax: Number.isFinite(tax) ? round2(tax) : 0,
      gross: Number.isFinite(gross) ? round2(gross) : 0,
      status: text(formData, "status") || "ENTWURF",
      notes: text(formData, "notes") || null,
    },
  });
  redirectWith(`/finanzen/eingang/${id}`, { hinweis: "Eingangsrechnung gespeichert." });
}
