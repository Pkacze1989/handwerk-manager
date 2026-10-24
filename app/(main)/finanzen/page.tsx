import Link from "next/link";
import { prisma } from "@/lib/db";
import { createDunning, recordPayment } from "@/actions/documents";
import { Badge, Card, Flash, PageHeader, btnPrimary, fieldClass } from "@/components/ui";
import { berlinToday, formatDate, formatEuro, one } from "@/lib/format";
import { labelOf, DOC_TYPES, statusTone } from "@/lib/labels";
import { round2 } from "@/lib/money";

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const [invoices, payments, outbox] = await Promise.all([
    prisma.document.findMany({
      where: { type: { in: ["ABSCHLAG_PAUSCHAL", "ABSCHLAG_KUMULATIV", "SCHLUSSRECHNUNG"] }, status: { not: "STORNIERT" } },
      include: { customer: true, payments: true },
      orderBy: { date: "desc" },
    }),
    prisma.payment.findMany({ include: { document: true }, orderBy: { date: "desc" } }),
    prisma.outboxMessage.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const open = invoices
    .map((invoice) => ({ ...invoice, open: round2(invoice.gross - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)) }))
    .filter((invoice) => invoice.open > 0.009 && invoice.status !== "ENTWURF");
  const month = payments.filter((payment) => payment.date >= monthStart).reduce((sum, payment) => sum + payment.amount, 0);
  const year = payments.filter((payment) => payment.date >= yearStart).reduce((sum, payment) => sum + payment.amount, 0);
  const invoicedYear = invoices.filter((invoice) => invoice.date >= yearStart && invoice.status !== "ENTWURF").reduce((sum, invoice) => sum + invoice.net, 0);

  return (
    <div>
      <PageHeader eyebrow="Finanzen" title="Posten, Zahlungen, Mahnungen" text="Offene Forderungen, gebuchte Zahlungen und der Postausgang." actions={<Link className="rounded-full bg-spruce px-4 py-2 text-sm font-semibold text-white" href="/finanzen/eingang">Eingangsrechnungen</Link>} />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs uppercase tracking-wide text-muted">Offen</p><p className="font-serif text-3xl">{formatEuro(open.reduce((sum, invoice) => sum + invoice.open, 0))}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-muted">Zahlungen Monat</p><p className="font-serif text-3xl">{formatEuro(month)}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-muted">Umsatz Jahr (netto fakturiert)</p><p className="font-serif text-3xl">{formatEuro(invoicedYear)}</p><p className="text-xs text-muted">Zahlungen {formatEuro(year)}</p></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-2xl">Offene Posten</h2>
          <ul className="mt-4 space-y-3">
            {open.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <Link href={`/buero/${invoice.id}`} className="font-semibold text-spruce">{invoice.number}</Link>
                  <p className="text-muted">{invoice.customer.name} · fällig {formatDate(invoice.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">{formatEuro(invoice.open)}</p>
                  <Badge tone={statusTone(invoice.status)}>{labelOf(DOC_TYPES, invoice.type)}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <form action={recordPayment} className="mt-4 grid gap-2">
            <select className={fieldClass} name="documentId" required>
              {open.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>{invoice.number} · offen {formatEuro(invoice.open)}</option>
              ))}
            </select>
            <input type="hidden" name="back" value="/finanzen" />
            <input className={fieldClass} type="date" name="date" defaultValue={berlinToday()} />
            <input className={fieldClass} name="amount" placeholder="Betrag" required />
            <input type="hidden" name="method" value="UEBERWEISUNG" />
            <button className={btnPrimary}>Zahlung buchen</button>
          </form>
        </Card>
        <Card>
          <h2 className="font-serif text-2xl">Mahnwesen</h2>
          <form action={createDunning} className="mt-4 grid gap-2">
            <select className={fieldClass} name="documentId">
              {open.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>{invoice.number}</option>
              ))}
            </select>
            <select className={fieldClass} name="level"><option value="ERINNERUNG">Zahlungserinnerung</option><option value="MAHNUNG">Mahnung</option></select>
            <input className={fieldClass} name="fee" placeholder="Gebühr optional" />
            <button className={btnPrimary}>Erzeugen</button>
          </form>
          <h3 className="mt-6 text-sm font-semibold">Postausgang</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {outbox.map((message) => (
              <li key={message.id}>
                <span className="font-semibold">{message.subject}</span>
                <span className="text-muted"> · {message.status === "VERSENDET" ? "versendet" : "Entwurf"} · {message.toAddr || "ohne Adresse"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
