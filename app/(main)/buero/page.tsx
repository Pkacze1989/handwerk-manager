import Link from "next/link";
import { prisma } from "@/lib/db";
import { createDocument } from "@/actions/documents";
import { Badge, Card, Empty, Flash, PageHeader, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { formatDate, formatEuro, one } from "@/lib/format";
import { DOC_STATUS, DOC_TYPES, labelOf, statusTone } from "@/lib/labels";

export default async function OfficePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const type = one(params.typ) || "";
  const status = one(params.status) || "";
  const q = one(params.q) || "";
  const [documents, customers, projects] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ number: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
      },
      include: { customer: true, project: true },
      orderBy: { date: "desc" },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { number: "desc" } }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Büro" title="Dokumente" text="Angebote, Auftragsbestätigungen, Lieferscheine und Rechnungen." />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <h2 className="font-serif text-2xl">Neuer Beleg</h2>
          <form action={createDocument} className="mt-4 space-y-3">
            <label>
              <span className={labelClass}>Art</span>
              <select className={fieldClass} name="type" defaultValue="ANGEBOT">
                {DOC_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Kunde</span>
              <select className={fieldClass} name="customerId" required>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Projekt</span>
              <select className={fieldClass} name="projectId">
                <option value="">Ohne Projekt</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.number} {project.title}
                  </option>
                ))}
              </select>
            </label>
            <button className={btnPrimary}>Anlegen</button>
          </form>
        </Card>
        <div>
          <form className="mb-4 flex flex-wrap gap-2">
            <input className={`${fieldClass} max-w-xs`} name="q" defaultValue={q} placeholder="Nummer oder Kunde" />
            <select className={`${fieldClass} max-w-[14rem]`} name="typ" defaultValue={type}>
              <option value="">Alle Arten</option>
              {DOC_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select className={`${fieldClass} max-w-[12rem]`} name="status" defaultValue={status}>
              <option value="">Alle Status</option>
              {DOC_STATUS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className={btnPrimary}>Filtern</button>
          </form>
          {documents.length === 0 ? <Empty>Keine Belege für diesen Filter.</Empty> : null}
          <div className="overflow-x-auto rounded-3xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Beleg</th>
                  <th className="px-4 py-3">Kunde</th>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Brutto</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/buero/${document.id}`} className="font-semibold text-spruce">
                        {document.number}
                      </Link>
                      <p className="text-xs text-muted">{labelOf(DOC_TYPES, document.type)}</p>
                    </td>
                    <td className="px-4 py-3">{document.customer.name}</td>
                    <td className="px-4 py-3">{formatDate(document.date)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(document.status)}>{labelOf(DOC_STATUS, document.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEuro(document.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
