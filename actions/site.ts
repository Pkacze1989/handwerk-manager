"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirectWith } from "@/lib/errors";
import { berlinToday, parseDateInput } from "@/lib/format";
import { evaluateExpression } from "@/lib/expr";
import { saveUpload } from "@/lib/files";
import { parseAmount, round2 } from "@/lib/money";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function clockIn(formData: FormData) {
  const user = await requireUser();
  const back = text(formData, "back") || "/baustelle/zeit";
  const open = await prisma.timeEntry.findFirst({ where: { userId: user.id, end: null } });
  if (open) redirectWith(back, { fehler: "Es läuft bereits eine Zeit. Bitte zuerst ausstempeln." });
  const type = text(formData, "type") || "ARBEIT";
  const projectId = text(formData, "projectId") || null;
  if (type !== "URLAUB" && !projectId) redirectWith(back, { fehler: "Bitte ein Projekt wählen." });
  await prisma.timeEntry.create({
    data: { userId: user.id, type, projectId: type === "URLAUB" ? projectId : projectId, start: new Date(), note: text(formData, "note") || null },
  });
  redirectWith(back, { hinweis: "Zeit gestartet." });
}

export async function clockOut(formData: FormData) {
  const user = await requireUser();
  const back = text(formData, "back") || "/baustelle/zeit";
  const open = await prisma.timeEntry.findFirst({ where: { userId: user.id, end: null } });
  if (!open) redirectWith(back, { fehler: "Keine laufende Zeit." });
  await prisma.timeEntry.update({ where: { id: open.id }, data: { end: new Date() } });
  redirectWith(back, { hinweis: "Zeit beendet." });
}

export async function deleteTime(formData: FormData) {
  await requireUser();
  const entry = await prisma.timeEntry.delete({ where: { id: text(formData, "id") } });
  redirectWith(text(formData, "back") || `/projekte/${entry.projectId}?tab=zeiten`, { hinweis: "Zeit gelöscht." });
}

export async function addMeasurement(formData: FormData) {
  await requireUser();
  const projectId = text(formData, "projectId");
  const back = text(formData, "back") || `/projekte/${projectId}?tab=aufmass`;
  const kind = text(formData, "kind") || "LAENGE";
  const title = text(formData, "title");
  if (!title) redirectWith(back, { fehler: "Bezeichnung fehlt." });
  let formula = text(formData, "formula");
  const inputs: Record<string, number> = {};
  if (kind === "LAENGE") {
    formula = "laenge";
    inputs.laenge = parseAmount(formData.get("laenge"));
  } else if (kind === "FLAECHE") {
    formula = "l * b";
    inputs.l = parseAmount(formData.get("l"));
    inputs.b = parseAmount(formData.get("b"));
  } else if (kind === "VOLUMEN") {
    formula = "l * b * h";
    inputs.l = parseAmount(formData.get("l"));
    inputs.b = parseAmount(formData.get("b"));
    inputs.h = parseAmount(formData.get("h"));
  } else if (kind === "STUECK") {
    formula = "n";
    inputs.n = parseAmount(formData.get("n"));
  } else {
    const names = formData.getAll("varName");
    const values = formData.getAll("varValue");
    names.forEach((name, index) => {
      const key = String(name).trim();
      if (key) inputs[key] = parseAmount(values[index]);
    });
  }
  let result = 0;
  try {
    result = round2(evaluateExpression(formula, inputs));
  } catch (error) {
    redirectWith(back, { fehler: error instanceof Error ? error.message : "Formel ungültig." });
  }
  const unit = text(formData, "unit") || (kind === "FLAECHE" ? "m²" : kind === "VOLUMEN" ? "m³" : kind === "STUECK" ? "Stk" : "m");
  await prisma.measurement.create({
    data: { projectId, title, kind, formula, inputsJson: JSON.stringify(inputs), result, unit, note: text(formData, "note") || null },
  });
  redirectWith(back, { hinweis: `Aufmaß gespeichert: ${result} ${unit}.` });
}

export async function deleteMeasurement(formData: FormData) {
  await requireUser();
  const measurement = await prisma.measurement.delete({ where: { id: text(formData, "id") } });
  redirectWith(text(formData, "back") || `/projekte/${measurement.projectId}?tab=aufmass`, { hinweis: "Aufmaß gelöscht." });
}

export async function addSiteLog(formData: FormData) {
  const user = await requireUser();
  const projectId = text(formData, "projectId");
  const back = text(formData, "back") || `/projekte/${projectId}?tab=doku`;
  const body = text(formData, "text");
  if (!body) redirectWith(back, { fehler: "Text fehlt." });
  const log = await prisma.siteLog.create({
    data: {
      projectId,
      userId: user.id,
      date: parseDateInput(text(formData, "date") || berlinToday()) ?? new Date(),
      kind: text(formData, "kind") || "FORTSCHRITT",
      text: body,
      weather: text(formData, "weather") || null,
      materials: text(formData, "materials") || null,
      hours: text(formData, "hours") ? parseAmount(formData.get("hours")) : null,
    },
  });
  const photos = formData.getAll("photos");
  for (const photo of photos) {
    if (photo instanceof File && photo.size > 0) {
      const stored = await saveUpload(photo, "foto");
      if (stored) {
        await prisma.sitePhoto.create({
          data: { siteLogId: log.id, projectId, path: stored.path, fileName: stored.fileName, caption: text(formData, "caption") || null },
        });
      }
    }
  }
  const dataUrl = text(formData, "dataUrl");
  const signerName = text(formData, "signerName");
  if (dataUrl.startsWith("data:image/png") && signerName) {
    await prisma.signature.create({
      data: { siteLogId: log.id, signerName, role: text(formData, "role") || null, dataUrl },
    });
  }
  redirectWith(back, { hinweis: "Baudokumentation gespeichert." });
}
