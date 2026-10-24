import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildDatevZip, buildExtfBookings, buildPartyCsv, datevReadme, type DatevBooking } from "@/lib/datev";
import { parseDateInput } from "@/lib/format";
import { labelOf, DOC_TYPES } from "@/lib/labels";
import { round2 } from "@/lib/money";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const from = parseDateInput(url.searchParams.get("von") || "2026-01-01");
  const to = parseDateInput(url.searchParams.get("bis") || "2026-12-31");
  if (!from || !to) return NextResponse.json({ fehler: "Zeitraum ungültig." }, { status: 400 });
  const end = new Date(to.getTime() + 86_400_000 - 1);
  const company = await prisma.company.findUnique({ where: { id: "company" } });
  if (!company) return NextResponse.json({ fehler: "Betrieb fehlt." }, { status: 500 });
  const [outgoing, incoming, payments] = await Promise.all([
    prisma.document.findMany({
      where: {
        type: { in: ["ABSCHLAG_PAUSCHAL", "ABSCHLAG_KUMULATIV", "SCHLUSSRECHNUNG"] },
        status: { notIn: ["STORNIERT", "ENTWURF"] },
        date: { gte: from, lte: end },
      },
      include: { customer: true },
    }),
    prisma.incomingInvoice.findMany({
      where: { status: "GEBUCHT", date: { gte: from, lte: end } },
      include: { supplier: true },
    }),
    prisma.payment.findMany({
      where: { date: { gte: from, lte: end } },
      include: { document: { include: { customer: true } } },
    }),
  ]);
  const bookings: DatevBooking[] = [];
  for (const invoice of outgoing) {
    bookings.push({
      amount: round2(invoice.gross),
      debitCredit: "S",
      account: invoice.customer.debtorNo || "10000",
      contraAccount: company.datevRevenueAccount,
      date: invoice.date,
      documentNumber: invoice.number,
      text: `${labelOf(DOC_TYPES, invoice.type)} ${invoice.customer.name}`,
    });
  }
  for (const payment of payments) {
    if (!["ABSCHLAG_PAUSCHAL", "ABSCHLAG_KUMULATIV", "SCHLUSSRECHNUNG"].includes(payment.document.type)) continue;
    bookings.push({
      amount: round2(payment.amount),
      debitCredit: "S",
      account: company.datevBankAccount,
      contraAccount: payment.document.customer.debtorNo || "10000",
      date: payment.date,
      documentNumber: payment.document.number,
      text: `Zahlung ${payment.document.number}`,
    });
  }
  for (const invoice of incoming) {
    bookings.push({
      amount: round2(invoice.gross),
      debitCredit: "S",
      account: company.datevExpenseAccount,
      contraAccount: invoice.supplier?.creditorNo || "70000",
      date: invoice.date,
      documentNumber: invoice.number,
      text: `Eingang ${invoice.supplier?.name || invoice.supplierName || invoice.number}`,
    });
  }
  const debtors = new Map<string, { account: string; name: string; street: string; zip: string; city: string; email: string; phone: string; number: string; extra?: string }>();
  for (const invoice of outgoing) {
    const account = invoice.customer.debtorNo || "10000";
    debtors.set(account, {
      account,
      name: invoice.customer.name,
      street: invoice.customer.street || "",
      zip: invoice.customer.zip || "",
      city: invoice.customer.city || "",
      email: invoice.customer.email || "",
      phone: invoice.customer.phone || "",
      number: invoice.customer.number,
      extra: invoice.customer.leitwegId || "",
    });
  }
  const creditors = new Map<string, { account: string; name: string; street: string; zip: string; city: string; email: string; phone: string; number: string }>();
  for (const invoice of incoming) {
    if (!invoice.supplier) continue;
    creditors.set(invoice.supplier.creditorNo || invoice.supplier.number, {
      account: invoice.supplier.creditorNo || "70000",
      name: invoice.supplier.name,
      street: invoice.supplier.street || "",
      zip: invoice.supplier.zip || "",
      city: invoice.supplier.city || "",
      email: invoice.supplier.email || "",
      phone: invoice.supplier.phone || "",
      number: invoice.supplier.number,
    });
  }
  const extf = buildExtfBookings({
    bookings,
    from,
    to,
    consultant: company.datevBerater,
    client: company.datevMandant,
    accountLength: company.datevAccountLength,
    exportedBy: user.name,
    label: "Werkplan Export",
  });
  const zip = await buildDatevZip([
    { name: "EXTF_Buchungsstapel.csv", content: extf, encoding: "win1252" },
    { name: "EXT_Debitoren.csv", content: buildPartyCsv("debitor", [...debtors.values()]), encoding: "win1252" },
    { name: "EXT_Kreditoren.csv", content: buildPartyCsv("kreditor", [...creditors.values()]), encoding: "win1252" },
    { name: "LESEN.txt", content: datevReadme(), encoding: "utf8" },
  ]);
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="werkplan-datev-${url.searchParams.get("von") ?? "export"}.zip"`,
    },
  });
}
