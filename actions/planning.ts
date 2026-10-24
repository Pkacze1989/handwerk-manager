"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirectWith } from "@/lib/errors";
import { addDaysISO, dateInputValue, parseDateInput } from "@/lib/format";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function daySpan(start: string, end: string) {
  const [ay, am, ad] = start.split("-").map(Number);
  const [by, bm, bd] = end.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export async function createAssignment(formData: FormData) {
  await requireUser();
  const back = text(formData, "back") || "/plantafel";
  const resourceId = text(formData, "resourceId");
  const projectId = text(formData, "projectId");
  const start = parseDateInput(text(formData, "startDate"));
  const end = parseDateInput(text(formData, "endDate") || text(formData, "startDate"));
  if (!resourceId || !projectId || !start || !end) redirectWith(back, { fehler: "Ressource, Baustelle und Zeitraum fehlen." });
  if (end < start) redirectWith(back, { fehler: "Das Ende liegt vor dem Beginn." });
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  await prisma.assignment.create({
    data: {
      resourceId,
      projectId,
      startDate: start,
      endDate: end,
      note: text(formData, "note") || null,
      userId: resource?.userId ?? null,
    },
  });
  redirectWith(back, { hinweis: "Einsatz geplant." });
}

export async function moveAssignment(formData: FormData) {
  await requireUser();
  const back = text(formData, "back") || "/plantafel";
  const assignment = await prisma.assignment.findUnique({ where: { id: text(formData, "id") } });
  if (!assignment) redirectWith(back, { fehler: "Einsatz nicht gefunden." });
  const startISO = text(formData, "startDate");
  const resourceId = text(formData, "resourceId") || assignment.resourceId;
  const projectId = text(formData, "projectId") || assignment.projectId;
  const span = daySpan(dateInputValue(assignment.startDate), dateInputValue(assignment.endDate));
  const endISO = text(formData, "endDate") || addDaysISO(startISO, span);
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  await prisma.assignment.update({
    where: { id: assignment.id },
    data: {
      resourceId,
      projectId,
      startDate: parseDateInput(startISO)!,
      endDate: parseDateInput(endISO)!,
      userId: resource?.userId ?? null,
      note: text(formData, "note") || assignment.note,
    },
  });
  redirectWith(back, { hinweis: "Einsatz verschoben." });
}

export async function deleteAssignment(formData: FormData) {
  await requireUser();
  await prisma.assignment.delete({ where: { id: text(formData, "id") } });
  redirectWith(text(formData, "back") || "/plantafel", { hinweis: "Einsatz entfernt." });
}

export async function saveResource(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const data = {
    type: text(formData, "type") || "MASCHINE",
    name: text(formData, "name"),
    details: text(formData, "details") || null,
    userId: text(formData, "userId") || null,
  };
  if (!data.name) redirectWith("/stammdaten/team", { fehler: "Name fehlt." });
  if (id) await prisma.resource.update({ where: { id }, data });
  else await prisma.resource.create({ data });
  redirectWith("/stammdaten/team", { hinweis: "Ressource gespeichert." });
}

export async function setCrewMembers(formData: FormData) {
  await requireUser();
  const crewId = text(formData, "crewId");
  const userIds = formData.getAll("userId").map(String);
  await prisma.crewMember.deleteMany({ where: { crewId } });
  if (userIds.length) {
    await prisma.crewMember.createMany({ data: userIds.map((userId) => ({ crewId, userId })) });
  }
  redirectWith("/stammdaten/team", { hinweis: "Kolonne aktualisiert." });
}
