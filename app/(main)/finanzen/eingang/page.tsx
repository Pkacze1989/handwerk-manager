import Link from "next/link";
import { prisma } from "@/lib/db";
import { intakeInvoice } from "@/actions/finance";
import { Card, Flash, PageHeader, btnPrimary, fieldClass } from "@/components/ui";
import { formatDate, formatEuro, one } from "@/lib/format";

export default async function IncomingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const invoices = await prisma.incomingInvoice.findMany({ include: { supplier: true, project: true }, orderBy: { date: "desc" } });
  return (
    <div>
      <PageHeader eyebrow="KI" title="Eingangsrechnungen" text="Datei ablegen. Text, CSV und XML werden ausgelesen, danach korrigieren Sie die Felder." />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <Card className="mb-6">
        <form action={intakeInvoice} className="flex flex-wrap items-end gap-3">
          <label className="min-w-[16rem] flex-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Datei</span>
            <input className={fieldClass} type="file" name="file" accept=".txt,.csv,.xml,.pdf,text/plain,text/csv,application/pdf,application/xml" required />
          </label>
          <button className={btnPrimary}>Erkennen</button>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-3xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted"><tr><th className="px-4 py-3">Beleg</th><th className="px-4 py-3">Lieferant</th><th className="px-4 py-3">Projekt</th><th className="px-4 py-3 text-right">Brutto</th></tr></thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-line">
                <td className="px-4 py-3"><Link className="font-semibold text-spruce" href={`/finanzen/eingang/${invoice.id}`}>{invoice.number}</Link><p className="text-xs text-muted">{formatDate(invoice.date)} · {invoice.status === "GEBUCHT" ? "Gebucht" : "Entwurf"}</p></td>
                <td className="px-4 py-3">{invoice.supplier?.name || invoice.supplierName}</td>
                <td className="px-4 py-3">{invoice.project?.title ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatEuro(invoice.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
