"use server";

import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirectWith } from "@/lib/errors";
import { createQuoteDraft } from "@/lib/ai";
import { berlinToday, parseDateInput } from "@/lib/format";
import { saveUpload } from "@/lib/files";
import { lineNet, totalsOf } from "@/lib/money";
import { nextCustomerNumber, nextDocumentNumber, nextProjectNumber } from "@/lib/numbers";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function draftQuote(formData: FormData) {
  await requireUser();
  let body = text(formData, "text");
  if (formData.get("sample") === "1") {
    body = await readFile(path.join(process.cwd(), "samples/ki/anfrage-richter.txt"), "utf8");
  }
  const file = formData.get("file");
  let stored: { path: string; fileName: string; mime: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const saved = await saveUpload(file, "anfrage");
    stored = saved;
    if (!body && saved) body = `Datei: ${saved.fileName}`;
  }
  if (!body) redirectWith("/ki/angebot", { fehler: "Bitte Text einfügen oder eine Datei wählen." });

  const [articles, services, customers] = await Promise.all([
    prisma.article.findMany(),
    prisma.serviceItem.findMany(),
    prisma.customer.findMany(),
  ]);
  const draft = await createQuoteDraft({
    text: body,
    fileName: stored?.fileName,
    articles,
    services,
    customers,
  });

  let customerId = text(formData, "customerId") || draft.customerId || "";
  if (!customerId) {
    const customer = await prisma.customer.create({
      data: {
        number: await nextCustomerNumber(),
        name: draft.customerName || "Neuer Interessent",
        notes: "Aus dem KI-Angebot angelegt.",
      },
    });
    customerId = customer.id;
  }
  let projectId = text(formData, "projectId");
  if (!projectId) {
    const project = await prisma.project.create({
      data: {
        number: await nextProjectNumber(),
        title: draft.title,
        customerId,
        status: "ANFRAGE",
        description: draft.notes.join("\n"),
      },
    });
    projectId = project.id;
  }
  if (stored) {
    await prisma.projectFile.create({
      data: {
        projectId,
        kind: stored.mime.startsWith("image/") ? "BILD" : "DOKUMENT",
        name: stored.fileName,
        path: stored.path,
        mime: stored.mime,
      },
    });
  }
  const lines = draft.lines.map((line, position) => ({
    position,
    kind: "POSITION",
    source: line.source,
    sourceId: line.sourceId || null,
    sku: line.sku || null,
    title: line.title,
    description: line.description || null,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    lineTotal: lineNet(line.quantity, line.unitPrice),
  }));
  const totals = totalsOf(lines, 19);
  const today = berlinToday();
  const document = await prisma.document.create({
    data: {
      type: "ANGEBOT",
      number: await nextDocumentNumber("ANGEBOT"),
      status: "ENTWURF",
      customerId,
      projectId,
      date: parseDateInput(today)!,
      validUntil: parseDateInput(today) ? new Date(new Date(`${today}T00:00:00.000Z`).getTime() + 30 * 86400000) : null,
      intro: "vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen die folgenden Leistungen an.",
      outro: "Dieses Angebot ist 30 Tage gültig.",
      internalNote: [`Motor: ${draft.engine}`, ...draft.notes, "", "---", body].join("\n"),
      taxRate: 19,
      showPrices: true,
      ...totals,
      lines: { create: lines },
    },
  });
  redirectWith(`/buero/${document.id}`, { hinweis: `Angebotsentwurf (${draft.engine === "llm" ? "Modell" : "lokale Engine"}) mit ${lines.length} Positionen.` });
}

export async function fileReception(formData: FormData) {
  await requireUser();
  const callerName = text(formData, "callerName");
  const phone = text(formData, "phone");
  const concern = text(formData, "concern");
  const urgency = text(formData, "urgency") || "NORMAL";
  if (!callerName || !concern) redirectWith("/ki/empfang", { fehler: "Name und Anliegen sind nötig." });
  let customerId = text(formData, "customerId");
  if (!customerId && phone) {
    const existing = await prisma.customer.findFirst({ where: { phone } });
    if (existing) customerId = existing.id;
  }
  if (!customerId) {
    const byName = await prisma.customer.findFirst({ where: { name: { contains: callerName } } });
    if (byName) customerId = byName.id;
  }
  if (!customerId) {
    const customer = await prisma.customer.create({
      data: { number: await nextCustomerNumber(), name: callerName, phone, notes: "Über den virtuellen Empfang angelegt." },
    });
    customerId = customer.id;
  }
  let projectId = text(formData, "projectId");
  if (!projectId) {
    const project = await prisma.project.create({
      data: {
        number: await nextProjectNumber(),
        title: concern.slice(0, 80),
        customerId,
        status: urgency === "NOTDIENST" || urgency === "HOCH" ? "ANFRAGE" : "ANFRAGE",
        description: concern,
      },
    });
    projectId = project.id;
  }
  await prisma.receptionNote.create({
    data: { customerId, projectId, callerName, phone, concern, urgency, simulated: true },
  });
  redirectWith(`/projekte/${projectId}`, { hinweis: "Anliegen in der Bauakte abgelegt." });
}
