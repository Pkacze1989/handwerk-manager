"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { errorText, isRedirect, redirectWith } from "@/lib/errors";
import { parseAmount } from "@/lib/money";
import { nextCustomerNumber, nextSupplierNumber } from "@/lib/numbers";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveCustomer(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const data = {
    name: text(formData, "name"),
    contact: text(formData, "contact") || null,
    street: text(formData, "street") || null,
    zip: text(formData, "zip") || null,
    city: text(formData, "city") || null,
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    notes: text(formData, "notes") || null,
    vatId: text(formData, "vatId") || null,
    leitwegId: text(formData, "leitwegId") || null,
    debtorNo: text(formData, "debtorNo") || null,
  };
  if (!data.name) redirectWith("/stammdaten/kunden", { fehler: "Name fehlt." });
  try {
    if (id) await prisma.customer.update({ where: { id }, data });
    else await prisma.customer.create({ data: { ...data, number: text(formData, "number") || (await nextCustomerNumber()) } });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/stammdaten/kunden", { fehler: errorText(error) });
  }
  redirectWith("/stammdaten/kunden", { hinweis: "Kunde gespeichert." });
}

export async function deleteCustomer(formData: FormData) {
  await requireUser();
  try {
    await prisma.customer.delete({ where: { id: text(formData, "id") } });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/stammdaten/kunden", { fehler: errorText(error) });
  }
  redirectWith("/stammdaten/kunden", { hinweis: "Kunde gelöscht." });
}

export async function saveSupplier(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const data = {
    name: text(formData, "name"),
    contact: text(formData, "contact") || null,
    street: text(formData, "street") || null,
    zip: text(formData, "zip") || null,
    city: text(formData, "city") || null,
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    creditorNo: text(formData, "creditorNo") || null,
  };
  if (!data.name) redirectWith("/stammdaten/lieferanten", { fehler: "Name fehlt." });
  try {
    if (id) await prisma.supplier.update({ where: { id }, data });
    else await prisma.supplier.create({ data: { ...data, number: text(formData, "number") || (await nextSupplierNumber()) } });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/stammdaten/lieferanten", { fehler: errorText(error) });
  }
  redirectWith("/stammdaten/lieferanten", { hinweis: "Lieferant gespeichert." });
}

export async function deleteSupplier(formData: FormData) {
  await requireUser();
  try {
    await prisma.supplier.delete({ where: { id: text(formData, "id") } });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/stammdaten/lieferanten", { fehler: errorText(error) });
  }
  redirectWith("/stammdaten/lieferanten", { hinweis: "Lieferant gelöscht." });
}

export async function saveArticle(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const purchase = parseAmount(formData.get("purchasePrice"));
  const sales = parseAmount(formData.get("salesPrice"));
  const data = {
    sku: text(formData, "sku"),
    name: text(formData, "name"),
    unit: text(formData, "unit") || "Stk",
    purchasePrice: Number.isFinite(purchase) ? purchase : 0,
    salesPrice: Number.isFinite(sales) ? sales : 0,
    vatRate: parseAmount(formData.get("vatRate") || "19") || 19,
    supplierId: text(formData, "supplierId") || null,
    matchTerms: text(formData, "matchTerms") || null,
  };
  if (!data.sku || !data.name) redirectWith("/stammdaten/material", { fehler: "Artikelnummer und Name sind nötig." });
  try {
    if (id) await prisma.article.update({ where: { id }, data });
    else await prisma.article.create({ data });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/stammdaten/material", { fehler: errorText(error) });
  }
  redirectWith("/stammdaten/material", { hinweis: "Artikel gespeichert." });
}

export async function deleteArticle(formData: FormData) {
  await requireUser();
  await prisma.article.delete({ where: { id: text(formData, "id") } });
  redirectWith("/stammdaten/material", { hinweis: "Artikel gelöscht." });
}

export async function saveService(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const data = {
    code: text(formData, "code"),
    name: text(formData, "name"),
    description: text(formData, "description") || null,
    unit: text(formData, "unit") || "Stk",
    minutes: parseAmount(formData.get("minutes") || "0") || 0,
    costPrice: parseAmount(formData.get("costPrice") || "0") || 0,
    salesPrice: parseAmount(formData.get("salesPrice") || "0") || 0,
    matchTerms: text(formData, "matchTerms") || null,
  };
  if (!data.code || !data.name) redirectWith("/stammdaten/leistungen", { fehler: "Kennung und Name sind nötig." });
  try {
    if (id) await prisma.serviceItem.update({ where: { id }, data });
    else await prisma.serviceItem.create({ data });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectWith("/stammdaten/leistungen", { fehler: errorText(error) });
  }
  redirectWith("/stammdaten/leistungen", { hinweis: "Leistung gespeichert." });
}

export async function deleteService(formData: FormData) {
  await requireUser();
  await prisma.serviceItem.delete({ where: { id: text(formData, "id") } });
  redirectWith("/stammdaten/leistungen", { hinweis: "Leistung gelöscht." });
}

export async function saveCompany(formData: FormData) {
  await requireUser();
  await prisma.company.update({
    where: { id: "company" },
    data: {
      name: text(formData, "name"),
      street: text(formData, "street"),
      zip: text(formData, "zip"),
      city: text(formData, "city"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      website: text(formData, "website"),
      taxNumber: text(formData, "taxNumber"),
      vatId: text(formData, "vatId"),
      bankName: text(formData, "bankName"),
      iban: text(formData, "iban"),
      bic: text(formData, "bic"),
      tradeRegister: text(formData, "tradeRegister"),
      owner: text(formData, "owner"),
      datevBerater: text(formData, "datevBerater"),
      datevMandant: text(formData, "datevMandant"),
      datevRevenueAccount: text(formData, "datevRevenueAccount") || "8400",
      datevExpenseAccount: text(formData, "datevExpenseAccount") || "3400",
      datevBankAccount: text(formData, "datevBankAccount") || "1200",
      datevAccountLength: Number(text(formData, "datevAccountLength") || "4"),
    },
  });
  redirectWith("/stammdaten/betrieb", { hinweis: "Betrieb gespeichert." });
}

export async function saveEmployee(formData: FormData) {
  await requireUser();
  const id = text(formData, "id");
  const rate = parseAmount(formData.get("hourlyRate"));
  await prisma.user.update({
    where: { id },
    data: {
      name: text(formData, "name"),
      phone: text(formData, "phone") || null,
      role: text(formData, "role") || "MONTEUR",
      hourlyRate: Number.isFinite(rate) ? rate : 0,
      color: text(formData, "color") || "#1e4638",
    },
  });
  redirectWith("/stammdaten/team", { hinweis: "Mitarbeiter gespeichert." });
}
