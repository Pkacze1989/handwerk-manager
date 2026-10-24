"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { errorText, isRedirect, redirectWith } from "@/lib/errors";
import { addDaysISO, berlinToday, formatDate, formatEuro, hoursBetween, parseDateInput } from "@/lib/format";
import { isInvoice, PAID_TIME } from "@/lib/labels";
import { lineNet, parseAmount, round2, totalsOf } from "@/lib/money";
import { nextDocumentNumber } from "@/lib/numbers";

export type SaveLine = {
  kind: string;
  source?: string | null;
  sourceId?: string | null;
  sku?: string | null;
  title: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
};

function defaultsFor(type: string) {
  if (type === "ANGEBOT") {
    return {
      intro: "vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen die folgenden Leistungen an.",
      outro: "Dieses Angebot ist 30 Tage gültig. Die Preise verstehen sich zuzüglich der gesetzlichen Mehrwertsteuer.",
      showPrices: true,
    };
  }
  if (type === "AUFTRAGSBESTAETIGUNG") {
    return {
      intro: "wir bestätigen den Auftrag zu den folgenden Konditionen.",
      outro: "Die Ausführung erfolgt nach Abstimmung des Baustellentermins.",
      showPrices: true,
    };
  }
  if (type === "LIEFERSCHEIN") {
    return {
      intro: "folgende Materialien haben wir geliefert:",
      outro: "Bitte prüfen Sie die Lieferung bei Erhalt.",
      showPrices: false,
    };
  }
  if (type === "ABNAHME") {
    return {
      intro: "die nachstehenden Leistungen wurden gemeinsam abgenommen.",
      outro: "Mit der Unterschrift gilt die Leistung als abgenommen, vorbehaltlich verdeckter Mängel.",
      showPrices: false,
    };
  }
  if (type === "REGIEBERICHT") {
    return {
      intro: "folgende Regieleistungen wurden erbracht:",
      outro: "Die Unterschrift bestätigt die ausgeführten Stunden und das eingesetzte Material.",
      showPrices: true,
    };
  }
  if (type === "STUNDENNACHWEIS") {
    return {
      intro: "nachgewiesen werden die folgenden Stunden.",
      outro: "Pause ist nicht enthalten. Die Unterschrift bestätigt die Aufstellung.",
      showPrices: true,
    };
  }
  return {
    intro: "wir berechnen vereinbarungsgemäß:",
    outro: "Zahlbar innerhalb von 14 Tagen ohne Abzug auf das in der Rechnung genannte Konto.",
    showPrices: true,
  };
}

async function replaceLines(documentId: string, lines: SaveLine[], taxRate: number) {
  const clean = lines
    .filter((line) => line.title.trim())
    .map((line, index) => {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = Number(line.unitPrice) || 0;
      const kind = line.kind === "TEXT" ? "TEXT" : "POSITION";
      return {
        documentId,
        position: index,
        kind,
        source: line.source || null,
        sourceId: line.sourceId || null,
        sku: line.sku || null,
        title: line.title.trim(),
        description: line.description?.trim() || null,
        quantity: kind === "TEXT" ? 0 : quantity,
        unit: line.unit || "Stk",
        unitPrice: kind === "TEXT" ? 0 : unitPrice,
        lineTotal: kind === "TEXT" ? 0 : lineNet(quantity, unitPrice),
      };
    });
  if (clean.length === 0) throw new Error("Mindestens eine Position mit Titel ist nötig.");
  const totals = totalsOf(clean, taxRate);
  await prisma.$transaction([
    prisma.documentLine.deleteMany({ where: { documentId } }),
    prisma.documentLine.createMany({ data: clean }),
    prisma.document.update({ where: { id: documentId }, data: { ...totals, taxRate } }),
  ]);
  return totals;
}

export async function syncPaymentStatus(documentId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId }, include: { payments: true } });
  if (!document || !isInvoice(document.type) || document.status === "STORNIERT") return;
  const paid = round2(document.payments.reduce((sum, payment) => sum + payment.amount, 0));
  let status = document.status;
  if (document.gross > 0 && paid >= document.gross - 0.009) status = "BEZAHLT";
  else if (paid > 0) status = "TEILBEZAHLT";
  else if (status === "BEZAHLT" || status === "TEILBEZAHLT") status = "OFFEN";
  if (status !== document.status) await prisma.document.update({ where: { id: documentId }, data: { status } });
}

export async function createDocument(formData: FormData) {
  await requireUser();
  const type = String(formData.get("type") || "ANGEBOT");
  const customerId = String(formData.get("customerId") || "");
  const projectId = String(formData.get("projectId") || "") || null;
  if (!customerId) redirectWith("/buero", { fehler: "Bitte einen Kunden wählen." });
  const today = berlinToday();
  const text = defaultsFor(type);
  const document = await prisma.document.create({
    data: {
      type,
      number: await nextDocumentNumber(type),
      status: isInvoice(type) ? "ENTWURF" : "ENTWURF",
      customerId,
      projectId,
      date: parseDateInput(today)!,
      validUntil: type === "ANGEBOT" ? parseDateInput(addDaysISO(today, 30)) : null,
      dueDate: isInvoice(type) ? parseDateInput(addDaysISO(today, 14)) : null,
      intro: text.intro,
      outro: text.outro,
      showPrices: text.showPrices,
      taxRate: 19,
      lines: {
        create: [
          {
            position: 0,
            kind: "POSITION",
            title: type === "ABSCHLAG_PAUSCHAL" ? "Abschlag pauschal" : "Neue Position",
            quantity: 1,
            unit: "psch",
            unitPrice: 0,
            lineTotal: 0,
            source: "FREE",
          },
        ],
      },
    },
  });
  redirectWith(`/buero/${document.id}`, { hinweis: "Beleg angelegt." });
}

export async function saveDocument(input: {
  id: string;
  customerId: string;
  projectId: string;
  status: string;
  date: string;
  validUntil: string;
  dueDate: string;
  serviceDate: string;
  intro: string;
  outro: string;
  internalNote: string;
  taxRate: number;
  showPrices: boolean;
  progressPercent: string;
  sourceDocumentId: string;
  lines: SaveLine[];
}) {
  await requireUser();
  try {
    if (!input.customerId) return { error: "Kunde fehlt." };
    const taxRate = Number(input.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { error: "Steuersatz ist ungültig." };
    await prisma.document.update({
      where: { id: input.id },
      data: {
        customerId: input.customerId,
        projectId: input.projectId || null,
        status: input.status,
        date: parseDateInput(input.date) ?? undefined,
        validUntil: input.validUntil ? parseDateInput(input.validUntil) : null,
        dueDate: input.dueDate ? parseDateInput(input.dueDate) : null,
        serviceDate: input.serviceDate ? parseDateInput(input.serviceDate) : null,
        intro: input.intro,
        outro: input.outro,
        internalNote: input.internalNote,
        showPrices: input.showPrices,
        progressPercent: input.progressPercent ? parseAmount(input.progressPercent) : null,
        sourceDocumentId: input.sourceDocumentId || null,
      },
    });
    await replaceLines(input.id, input.lines, taxRate);
    const document = await prisma.document.findUnique({ where: { id: input.id } });
    if (document && isInvoice(document.type)) await syncPaymentStatus(document.id);
    revalidatePath(`/buero/${input.id}`);
    revalidatePath("/buero");
    revalidatePath("/finanzen");
    return {};
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: errorText(error) };
  }
}

export async function deleteDocument(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  await prisma.document.delete({ where: { id } });
  redirectWith("/buero", { hinweis: "Beleg gelöscht." });
}

export async function createFollowUp(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const type = String(formData.get("type") || "AUFTRAGSBESTAETIGUNG");
  const source = await prisma.document.findUnique({ where: { id }, include: { lines: true } });
  if (!source) redirectWith("/buero", { fehler: "Beleg nicht gefunden." });
  const text = defaultsFor(type);
  const today = berlinToday();
  const copy = source.lines.map((line) => ({
    position: line.position,
    kind: line.kind,
    source: line.source,
    sourceId: line.sourceId,
    sku: line.sku,
    title: line.title,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  }));
  const document = await prisma.document.create({
    data: {
      type,
      number: await nextDocumentNumber(type),
      status: "ENTWURF",
      customerId: source.customerId,
      projectId: source.projectId,
      date: parseDateInput(today)!,
      dueDate: isInvoice(type) ? parseDateInput(addDaysISO(today, 14)) : null,
      intro: `Bezug: ${source.number}. ${text.intro}`,
      outro: text.outro,
      showPrices: type === "LIEFERSCHEIN" ? false : text.showPrices,
      taxRate: source.taxRate,
      sourceDocumentId: source.id,
      net: source.net,
      tax: source.tax,
      gross: source.gross,
      lines: { create: copy.length ? copy : [{ position: 0, kind: "POSITION", title: "Position", quantity: 1, unit: "psch", unitPrice: 0, lineTotal: 0 }] },
    },
  });
  redirectWith(`/buero/${document.id}`, { hinweis: "Folgebeleg angelegt." });
}

export async function rebuildCumulative(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const sourceId = String(formData.get("sourceDocumentId") || "");
  const percent = parseAmount(formData.get("progressPercent"));
  const back = `/buero/${id}`;
  if (!sourceId || !Number.isFinite(percent)) redirectWith(back, { fehler: "Angebot und Prozent angeben." });
  const [document, source] = await Promise.all([
    prisma.document.findUnique({ where: { id } }),
    prisma.document.findUnique({ where: { id: sourceId } }),
  ]);
  if (!document || !source) redirectWith("/buero", { fehler: "Beleg nicht gefunden." });
  const previous = await prisma.document.findMany({
    where: {
      id: { not: document.id },
      projectId: document.projectId ?? undefined,
      type: { in: ["ABSCHLAG_PAUSCHAL", "ABSCHLAG_KUMULATIV"] },
      status: { not: "STORNIERT" },
    },
  });
  const previousNet = round2(previous.reduce((sum, entry) => sum + entry.net, 0));
  const cumulativeNet = round2((source.net * percent) / 100);
  const lines: SaveLine[] = [
    {
      kind: "POSITION",
      title: `Kumulierte Leistung ${formatPercent(percent)} laut ${source.number}`,
      quantity: 1,
      unit: "psch",
      unitPrice: cumulativeNet,
      source: "FREE",
    },
  ];
  if (previousNet !== 0) {
    lines.push({
      kind: "POSITION",
      title: "Abzüglich bereits gestellte Abschläge",
      description: previous.map((entry) => entry.number).join(", "),
      quantity: 1,
      unit: "psch",
      unitPrice: -previousNet,
      source: "FREE",
    });
  }
  await prisma.document.update({
    where: { id },
    data: { progressPercent: percent, sourceDocumentId: source.id, type: "ABSCHLAG_KUMULATIV" },
  });
  await replaceLines(id, lines, document.taxRate);
  redirectWith(back, { hinweis: "Kumulative Abschlagspositionen neu berechnet." });
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)} %`;
}

export async function rebuildFinal(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const sourceId = String(formData.get("sourceDocumentId") || "");
  const back = `/buero/${id}`;
  const [document, source] = await Promise.all([
    prisma.document.findUnique({ where: { id } }),
    prisma.document.findUnique({ where: { id: sourceId } }),
  ]);
  if (!document || !source) redirectWith("/buero", { fehler: "Beleg nicht gefunden." });
  const previous = await prisma.document.findMany({
    where: {
      id: { not: document.id },
      projectId: document.projectId ?? undefined,
      type: { in: ["ABSCHLAG_PAUSCHAL", "ABSCHLAG_KUMULATIV"] },
      status: { not: "STORNIERT" },
    },
  });
  const lines: SaveLine[] = [
    {
      kind: "POSITION",
      title: `Leistung laut Angebot ${source.number}`,
      quantity: 1,
      unit: "psch",
      unitPrice: source.net,
      source: "FREE",
      sourceId: source.id,
    },
    ...previous.map((entry) => ({
      kind: "POSITION",
      title: `Abzüglich ${entry.number}`,
      quantity: 1,
      unit: "psch",
      unitPrice: -entry.net,
      source: "FREE" as const,
    })),
  ];
  await prisma.document.update({
    where: { id },
    data: { sourceDocumentId: source.id, type: "SCHLUSSRECHNUNG" },
  });
  await replaceLines(id, lines, document.taxRate);
  redirectWith(back, { hinweis: "Schlussrechnung aus Angebot und Abschlägen gesetzt." });
}

export async function pullMeasurements(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const document = await prisma.document.findUnique({ where: { id }, include: { lines: { orderBy: { position: "asc" } } } });
  if (!document?.projectId) redirectWith(`/buero/${id}`, { fehler: "Dem Beleg ist kein Projekt zugeordnet." });
  const measurements = await prisma.measurement.findMany({ where: { projectId: document.projectId } });
  const known = new Set(document.lines.map((line) => line.sourceId).filter(Boolean));
  const extra: SaveLine[] = measurements
    .filter((measurement) => !known.has(measurement.id))
    .map((measurement) => ({
      kind: "POSITION",
      source: "MEASUREMENT",
      sourceId: measurement.id,
      title: measurement.title,
      description: `Aufmaß ${measurement.formula} = ${measurement.result} ${measurement.unit}`,
      quantity: measurement.result,
      unit: measurement.unit,
      unitPrice: 0,
    }));
  if (extra.length === 0) redirectWith(`/buero/${id}`, { hinweis: "Keine neuen Aufmaßmengen." });
  const lines: SaveLine[] = [
    ...document.lines.map((line) => ({
      kind: line.kind,
      source: line.source,
      sourceId: line.sourceId,
      sku: line.sku,
      title: line.title,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
    })),
    ...extra,
  ];
  await replaceLines(id, lines, document.taxRate);
  redirectWith(`/buero/${id}`, { hinweis: `${extra.length} Aufmaßmengen übernommen. Einzelpreise bitte prüfen.` });
}

export async function recordPayment(formData: FormData) {
  await requireUser();
  const documentId = String(formData.get("documentId") || "");
  const amount = parseAmount(formData.get("amount"));
  const date = parseDateInput(String(formData.get("date") || berlinToday()));
  const method = String(formData.get("method") || "UEBERWEISUNG");
  const note = String(formData.get("note") || "");
  const back = String(formData.get("back") || `/buero/${documentId}`);
  if (!date || !Number.isFinite(amount) || amount <= 0) redirectWith(back, { fehler: "Betrag und Datum prüfen." });
  await prisma.payment.create({ data: { documentId, amount: round2(amount), date, method, note: note || null } });
  await syncPaymentStatus(documentId);
  revalidatePath(back);
  redirectWith(back, { hinweis: "Zahlung gebucht." });
}

export async function deletePayment(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const payment = await prisma.payment.delete({ where: { id } });
  await syncPaymentStatus(payment.documentId);
  redirectWith(String(formData.get("back") || `/buero/${payment.documentId}`), { hinweis: "Zahlung gelöscht." });
}

export async function createDunning(formData: FormData) {
  await requireUser();
  const documentId = String(formData.get("documentId") || "");
  const level = String(formData.get("level") || "ERINNERUNG");
  const fee = parseAmount(formData.get("fee") || "0");
  const document = await prisma.document.findUnique({ where: { id: documentId }, include: { customer: true, payments: true } });
  if (!document) redirectWith("/finanzen", { fehler: "Rechnung nicht gefunden." });
  const company = await prisma.company.findUnique({ where: { id: "company" } });
  const paid = round2(document.payments.reduce((sum, payment) => sum + payment.amount, 0));
  const open = round2(document.gross - paid);
  const title = level === "MAHNUNG" ? "Mahnung" : "Zahlungserinnerung";
  const text = [
    `${title} zu ${document.number}`,
    "",
    `Guten Tag ${document.customer.contact || document.customer.name},`,
    "",
    level === "MAHNUNG"
      ? `zu unserer Rechnung ${document.number} vom ${formatDate(document.date)} ist weiterhin ein Betrag von ${formatEuro(open)} offen.`
      : `freundliche Erinnerung: zu Rechnung ${document.number} stehen noch ${formatEuro(open)} offen.`,
    fee > 0 ? `Zuzüglich Mahngebühr ${formatEuro(round2(fee))}.` : "",
    "Bitte überweisen Sie den offenen Betrag auf das in der Rechnung genannte Konto.",
    "",
    "Mit freundlichen Grüßen",
    company?.name ?? "Werkplan",
  ]
    .filter((line) => line !== "")
    .join("\n");
  const dunning = await prisma.dunning.create({
    data: { documentId, level, fee: Number.isFinite(fee) ? round2(fee) : 0, text, status: "ENTWURF" },
  });
  await prisma.outboxMessage.create({
    data: {
      kind: level,
      toAddr: document.customer.email || "",
      subject: `${title} ${document.number}`,
      body: text,
      status: "ENTWURF",
      relatedId: dunning.id,
    },
  });
  redirectWith(`/buero/${documentId}`, { hinweis: `${title} liegt im Postausgang.` });
}

export async function markDunningSent(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const dunning = await prisma.dunning.update({ where: { id }, data: { status: "VERSENDET", sentAt: new Date() } });
  await prisma.outboxMessage.updateMany({ where: { relatedId: id }, data: { status: "VERSENDET", sentAt: new Date() } });
  redirectWith(`/buero/${dunning.documentId}`, { hinweis: "Als versendet markiert." });
}

export async function markDocumentSent(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const document = await prisma.document.findUnique({ where: { id }, include: { customer: true } });
  if (!document) redirectWith("/buero", { fehler: "Beleg nicht gefunden." });
  const status = isInvoice(document.type) ? "OFFEN" : "VERSENDET";
  await prisma.document.update({ where: { id }, data: { status } });
  await prisma.outboxMessage.create({
    data: {
      kind: document.type,
      toAddr: document.customer.email || "",
      subject: `${document.number}`,
      body: `Beleg ${document.number} wurde als versendet markiert.`,
      status: "VERSENDET",
      sentAt: new Date(),
      relatedId: document.id,
    },
  });
  redirectWith(`/buero/${id}`, { hinweis: "Als versendet markiert." });
}

export async function saveSignature(formData: FormData) {
  await requireUser();
  const documentId = String(formData.get("documentId") || "") || null;
  const siteLogId = String(formData.get("siteLogId") || "") || null;
  const signerName = String(formData.get("signerName") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const dataUrl = String(formData.get("dataUrl") || "");
  const back = String(formData.get("back") || "/baustelle");
  if (!signerName || !dataUrl.startsWith("data:image/png")) redirectWith(back, { fehler: "Name und Unterschrift fehlen." });
  await prisma.signature.create({
    data: { documentId, siteLogId, signerName, role: role || null, dataUrl },
  });
  redirectWith(back, { hinweis: "Unterschrift gespeichert." });
}

export async function createHoursDocument(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { times: { include: { user: true } } } });
  if (!project) redirectWith("/projekte", { fehler: "Projekt nicht gefunden." });
  const today = berlinToday();
  const lines = project.times
    .filter((entry) => entry.end && PAID_TIME.has(entry.type))
    .map((entry) => {
      const hours = round2(hoursBetween(entry.start, entry.end!));
      return {
        kind: "POSITION",
        title: `${entry.user.name} · ${entry.type === "FAHRT" ? "Fahrt" : entry.type === "SCHLECHTWETTER" ? "Schlechtwetter" : "Arbeit"}`,
        description: entry.note,
        quantity: hours,
        unit: "h",
        unitPrice: entry.user.hourlyRate,
        lineTotal: lineNet(hours, entry.user.hourlyRate),
        source: "FREE",
      };
    });
  if (lines.length === 0) redirectWith(`/projekte/${projectId}?tab=zeiten`, { fehler: "Keine abgeschlossenen bezahlten Stunden." });
  const totals = totalsOf(lines, 19);
  const text = defaultsFor("STUNDENNACHWEIS");
  const document = await prisma.document.create({
    data: {
      type: "STUNDENNACHWEIS",
      number: await nextDocumentNumber("STUNDENNACHWEIS"),
      status: "ENTWURF",
      customerId: project.customerId,
      projectId,
      date: parseDateInput(today)!,
      intro: text.intro,
      outro: text.outro,
      showPrices: true,
      taxRate: 19,
      ...totals,
      lines: { create: lines.map((line, position) => ({ ...line, position })) },
    },
  });
  redirectWith(`/buero/${document.id}`, { hinweis: "Stundennachweis erzeugt." });
}

export async function createFromSiteLog(formData: FormData) {
  await requireUser();
  const logId = String(formData.get("logId") || "");
  const log = await prisma.siteLog.findUnique({ where: { id: logId }, include: { project: true, user: true, signatures: true } });
  if (!log) redirectWith("/baustelle/doku", { fehler: "Bericht nicht gefunden." });
  const type = log.kind === "ABNAHME" ? "ABNAHME" : "REGIEBERICHT";
  const today = berlinToday();
  const text = defaultsFor(type);
  const hours = log.hours ?? 0;
  const lines = [
    {
      position: 0,
      kind: "POSITION",
      title: log.text.slice(0, 120),
      description: log.materials,
      quantity: hours || 1,
      unit: hours ? "h" : "psch",
      unitPrice: hours ? log.user.hourlyRate : 0,
      lineTotal: hours ? lineNet(hours, log.user.hourlyRate) : 0,
      source: "FREE",
    },
  ];
  const totals = totalsOf(lines, 19);
  const document = await prisma.document.create({
    data: {
      type,
      number: await nextDocumentNumber(type),
      status: "ENTWURF",
      customerId: log.project.customerId,
      projectId: log.projectId,
      date: parseDateInput(today)!,
      intro: text.intro,
      outro: text.outro,
      showPrices: type !== "ABNAHME",
      taxRate: 19,
      ...totals,
      lines: { create: lines },
      signatures: {
        create: log.signatures.map((signature) => ({
          signerName: signature.signerName,
          role: signature.role,
          dataUrl: signature.dataUrl,
          signedAt: signature.signedAt,
        })),
      },
    },
  });
  redirectWith(`/buero/${document.id}`, { hinweis: "Beleg aus dem Bericht erzeugt." });
}
