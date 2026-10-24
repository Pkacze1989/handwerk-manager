import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readStored } from "@/lib/files";

export async function GET(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  await requireUser();
  const { kind, id } = await context.params;
  const record = await lookup(kind, id);
  if (!record) return new NextResponse("Nicht gefunden", { status: 404 });
  const bytes = await readStored(record.path);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": record.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${record.name.replace(/"/g, "")}"`,
    },
  });
}

async function lookup(kind: string, id: string) {
  if (kind === "projekt") {
    const file = await prisma.projectFile.findUnique({ where: { id } });
    return file ? { path: file.path, mime: file.mime, name: file.name } : null;
  }
  if (kind === "foto") {
    const photo = await prisma.sitePhoto.findUnique({ where: { id } });
    return photo ? { path: photo.path, mime: "image/png", name: photo.fileName } : null;
  }
  if (kind === "chat") {
    const message = await prisma.chatMessage.findUnique({ where: { id } });
    return message?.imagePath ? { path: message.imagePath, mime: "image/png", name: message.imageName || "bild.png" } : null;
  }
  if (kind === "eingang") {
    const invoice = await prisma.incomingInvoice.findUnique({ where: { id } });
    return invoice?.filePath ? { path: invoice.filePath, mime: "text/plain", name: invoice.fileName || "rechnung.txt" } : null;
  }
  return null;
}
