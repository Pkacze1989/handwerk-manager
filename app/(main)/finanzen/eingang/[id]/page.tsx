import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { saveIncoming } from "@/actions/finance";
import { Card, Flash, PageHeader, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { dateInputValue, one } from "@/lib/format";

export default async function IncomingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const invoice = await prisma.incomingInvoice.findUnique({ where: { id } });
  if (!invoice) notFound();
  const [suppliers, projects] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { title: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Eingangsrechnung" title={invoice.number} text={invoice.fileName ?? "Ohne Datei"} />
      <Flash hinweis={one(query.hinweis)} fehler={one(query.fehler)} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <form action={saveIncoming} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="id" value={invoice.id} />
            <label><span className={labelClass}>Lieferant laut Beleg</span><input className={fieldClass} name="supplierName" defaultValue={invoice.supplierName ?? ""} /></label>
            <label>
              <span className={labelClass}>Stammdaten</span>
              <select className={fieldClass} name="supplierId" defaultValue={invoice.supplierId ?? ""}>
                <option value="">Nicht zuordnen</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label><span className={labelClass}>Nummer</span><input className={fieldClass} name="number" defaultValue={invoice.number} /></label>
            <label><span className={labelClass}>Datum</span><input className={fieldClass} type="date" name="date" defaultValue={dateInputValue(invoice.date)} /></label>
            <label><span className={labelClass}>Netto</span><input className={fieldClass} name="net" defaultValue={invoice.net} /></label>
            <label><span className={labelClass}>Steuer</span><input className={fieldClass} name="tax" defaultValue={invoice.tax} /></label>
            <label><span className={labelClass}>Brutto</span><input className={fieldClass} name="gross" defaultValue={invoice.gross} /></label>
            <label>
              <span className={labelClass}>Projekt</span>
              <select className={fieldClass} name="projectId" defaultValue={invoice.projectId ?? ""}>
                <option value="">Nicht zuordnen</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Status</span>
              <select className={fieldClass} name="status" defaultValue={invoice.status}>
                <option value="ENTWURF">Entwurf</option>
                <option value="GEBUCHT">Gebucht</option>
              </select>
            </label>
            <label className="md:col-span-2"><span className={labelClass}>Notizen</span><textarea className={fieldClass} name="notes" rows={3} defaultValue={invoice.notes ?? ""} /></label>
            <button className={btnPrimary}>Speichern</button>
          </form>
        </Card>
        <Card>
          {invoice.filePath ? <a className="font-semibold text-spruce" href={`/api/dateien/eingang/${invoice.id}`}>Datei öffnen</a> : null}
          {invoice.rawText ? <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap text-xs text-muted">{invoice.rawText}</pre> : <p className="text-sm text-muted">Kein auslesbarer Text. Beträge bitte von Hand eintragen.</p>}
        </Card>
      </div>
    </div>
  );
}
