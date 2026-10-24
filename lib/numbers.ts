import { prisma } from "./db";
import { DOC_PREFIX } from "./labels";

export async function nextDocumentNumber(type: string) {
  const year = new Date().getFullYear();
  const prefix = `${DOC_PREFIX[type] ?? "DOK"}-${year}-`;
  const existing = await prisma.document.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  const max = existing.reduce((highest, doc) => {
    const value = Number(doc.number.slice(prefix.length));
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function nextCustomerNumber() {
  const count = await prisma.customer.count();
  return `KD-${1001 + count}`;
}

export async function nextSupplierNumber() {
  const count = await prisma.supplier.count();
  return `LF-${201 + count}`;
}

export async function nextProjectNumber() {
  const year = new Date().getFullYear();
  const prefix = `P-${year}-`;
  const existing = await prisma.project.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  const max = existing.reduce((highest, project) => {
    const value = Number(project.number.slice(prefix.length));
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
