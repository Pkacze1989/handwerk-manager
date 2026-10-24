import { prisma } from "./db";
import { labelOf, DOC_TYPES, isInvoice } from "./labels";
import type { InvoiceXmlInput } from "./einvoice";
import { dateInputValue, addDaysISO } from "./format";
import { lineNet } from "./money";

export async function loadDocument(id: string) {
  const [document, company] = await Promise.all([
    prisma.document.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { position: "asc" } },
        customer: true,
        project: true,
        payments: { orderBy: { date: "asc" } },
        signatures: { orderBy: { signedAt: "asc" } },
      },
    }),
    prisma.company.findUnique({ where: { id: "company" } }),
  ]);
  if (!document || !company) throw new Error("Dokument nicht gefunden.");
  return { document, company };
}

export function invoiceXmlFromBundle(bundle: Awaited<ReturnType<typeof loadDocument>>): InvoiceXmlInput {
  const { document, company } = bundle;
  const issueDate = dateInputValue(document.date);
  const dueDate = dateInputValue(document.dueDate) || addDaysISO(issueDate, 14);
  const lines = document.lines
    .filter((line) => line.kind !== "TEXT" && line.quantity !== 0)
    .map((line) => ({
      title: line.title,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      total: line.lineTotal || lineNet(line.quantity, line.unitPrice),
    }));
  return {
    number: document.number,
    issueDate,
    dueDate,
    typeLabel: labelOf(DOC_TYPES, document.type),
    taxRate: document.taxRate,
    net: document.net,
    tax: document.tax,
    gross: document.gross,
    buyerReference: document.customer.leitwegId || document.customer.number,
    iban: company.iban,
    bic: company.bic,
    bankName: company.bankName,
    seller: {
      name: company.name,
      street: company.street,
      zip: company.zip,
      city: company.city,
      email: company.email,
      phone: company.phone,
      vatId: company.vatId,
      contact: company.owner,
      companyId: company.tradeRegister,
    },
    buyer: {
      name: document.customer.name,
      street: document.customer.street || "",
      zip: document.customer.zip || "",
      city: document.customer.city || "",
      email: document.customer.email || "",
      phone: document.customer.phone || "",
      vatId: document.customer.vatId || undefined,
      buyerReference: document.customer.leitwegId || document.customer.number,
    },
    lines,
  };
}

export function assertInvoice(type: string) {
  if (!isInvoice(type)) throw new Error("XRechnung und ZUGFeRD gibt es nur für Rechnungen.");
}
