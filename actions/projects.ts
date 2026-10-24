"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirectWith, errorText, isRedirect } from "@/lib/errors";
import { parseDateInput } from "@/lib/format";
import { saveUpload } from "@/lib/files";
import { nextProjectNumber } from "@/lib/numbers";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveProject(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const customerId = text(formData, "customerId");
  if (!customerId || !text(formData, "title")) redirectWith("/projekte", { fehler: "Titel und Kunde sind nötig." });
  const data = {
    title: text(formData, "title"),
    customerId,
    status: text(formData, "status") || "ANFRAGE",
    street: text(formData, "street") || null,
    zip: text(formData, "zip") || null,
    city: text(formData, "city") || null,
    description: text(formData, "description") || null,
    startDate: text(formData, "startDate") ? parseDateInput(text(formData, "startDate")) : null,
    endDate: text(formData, "endDate") ? parseDateInput(text(formData, "endDate")) : null,
  };
  try {
    if (id) {
      await prisma.project.update({ where: { id }, data });
      redirectWith(`/projekte/${id}`, { hinweis: "Projekt gespeichert." });
    }
    const project = await prisma.project.create({ data: { ...data, number: await nextProjectNumber() } });
    redirectWith(`/projekte/${project.id}`, { hinweis: "Projekt angelegt." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/projekte", { fehler: errorText(error) });
  }
}

export async function addProjectFile(formData: FormData) {
  await requireUser();
  const projectId = text(formData, "projectId");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirectWith(`/projekte/${projectId}?tab=dateien`, { fehler: "Keine Datei gewählt." });
  const stored = await saveUpload(file, "akte");
  if (!stored) redirectWith(`/projekte/${projectId}?tab=dateien`, { fehler: "Datei leer." });
  const mime = stored.mime;
  const kind = mime.startsWith("image/") ? "BILD" : mime === "application/pdf" ? "DOKUMENT" : text(formData, "kind") || "SONSTIGES";
  await prisma.projectFile.create({
    data: {
      projectId,
      kind,
      name: text(formData, "name") || stored.fileName,
      path: stored.path,
      mime,
    },
  });
  redirectWith(`/projekte/${projectId}?tab=dateien`, { hinweis: "Datei in der Bauakte." });
}

export async function deleteProjectFile(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const file = await prisma.projectFile.delete({ where: { id } });
  redirectWith(`/projekte/${file.projectId}?tab=dateien`, { hinweis: "Datei entfernt." });
}

export async function addEmail(formData: FormData) {
  await requireUser();
  const projectId = text(formData, "projectId");
  const sent = text(formData, "sentAt");
  await prisma.projectEmail.create({
    data: {
      projectId,
      direction: text(formData, "direction") || "EINGANG",
      fromAddr: text(formData, "fromAddr"),
      toAddr: text(formData, "toAddr"),
      subject: text(formData, "subject"),
      body: text(formData, "body"),
      sentAt: sent ? parseDateInput(sent) ?? new Date() : new Date(),
    },
  });
  redirectWith(`/projekte/${projectId}?tab=emails`, { hinweis: "E-Mail abgelegt." });
}

export async function postChat(formData: FormData) {
  const user = await requireUser();
  const projectId = text(formData, "projectId");
  const body = text(formData, "body");
  const image = formData.get("image");
  if (!body && (!(image instanceof File) || image.size === 0)) {
    redirectWith(`/projekte/${projectId}?tab=chat`, { fehler: "Nachricht oder Bild fehlt." });
  }
  let imagePath: string | null = null;
  let imageName: string | null = null;
  if (image instanceof File && image.size > 0) {
    const stored = await saveUpload(image, "chat");
    imagePath = stored?.path ?? null;
    imageName = stored?.fileName ?? null;
  }
  const colleagues = await prisma.user.findMany();
  const mentions = colleagues.filter((colleague) => body.includes(`@${colleague.name}`)).map((colleague) => colleague.id);
  await prisma.chatMessage.create({
    data: { projectId, userId: user.id, body: body || "Bild", imagePath, imageName, mentions: mentions.join(",") || null },
  });
  redirectWith(`/projekte/${projectId}?tab=chat`, { hinweis: "Nachricht gesendet." });
}

export async function saveInstruction(formData: FormData) {
  const user = await requireUser();
  const projectId = text(formData, "projectId");
  const materials = text(formData, "materials")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line, done: false }));
  await prisma.workInstruction.create({
    data: {
      projectId,
      assigneeId: text(formData, "assigneeId"),
      authorId: user.id,
      title: text(formData, "title"),
      body: text(formData, "body"),
      materials: JSON.stringify(materials),
      status: "OFFEN",
      dueDate: text(formData, "dueDate") ? parseDateInput(text(formData, "dueDate")) : null,
    },
  });
  const back = text(formData, "back") || `/projekte/${projectId}?tab=anweisungen`;
  redirectWith(back, { hinweis: "Arbeitsanweisung angelegt." });
}

export async function updateInstruction(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const instruction = await prisma.workInstruction.findUnique({ where: { id } });
  if (!instruction) redirectWith("/baustelle/anweisungen", { fehler: "Anweisung nicht gefunden." });
  const materials = JSON.parse(instruction.materials || "[]") as { text: string; done: boolean }[];
  const doneIndex = formData.get("doneIndex");
  if (doneIndex !== null && doneIndex !== "") {
    const index = Number(doneIndex);
    if (materials[index]) materials[index].done = formData.get("done") === "1";
  }
  await prisma.workInstruction.update({
    where: { id },
    data: {
      status: text(formData, "status") || instruction.status,
      materials: JSON.stringify(materials),
    },
  });
  redirectWith(text(formData, "back") || "/baustelle/anweisungen", { hinweis: "Anweisung aktualisiert." });
}
