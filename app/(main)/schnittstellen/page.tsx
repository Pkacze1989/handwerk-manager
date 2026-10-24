import Link from "next/link";
import { prisma } from "@/lib/db";
import { applyDatanorm, importGaeb, previewDatanorm } from "@/actions/interfaces";
import { Card, Flash, PageHeader, btnGhost, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { berlinToday, formatEuro, one } from "@/lib/format";
import { parseDatanorm } from "@/lib/datanorm";
import { readFile } from "fs/promises";
import path from "path";
import { readStored } from "@/lib/files";

export default async function InterfacesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [customers, projects, suppliers, articles] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { title: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.article.findMany({ orderBy: { sku: "asc" } }),
  ]);
  const datanorm = one(params.datanorm);
  let preview: ReturnType<typeof parseDatanorm> | null = null;
  let previewError = "";
  if (datanorm) {
    try {
      const content = datanorm === "sample"
        ? await readFile(path.join(process.cwd(), "samples/datanorm/elektro-nord.datanorm"), "utf8")
        : (await readStored(datanorm)).toString("utf8");
      preview = parseDatanorm(content);
    } catch (error) {
      previewError = error instanceof Error ? error.message : "Vorschau fehlgeschlagen.";
    }
  }
  const today = berlinToday();
  const yearStart = `${today.slice(0, 4)}-01-01`;

  return (
    <div>
      <PageHeader eyebrow="Schnittstellen" title="GAEB, DATANORM, DATEV" text="Dokumentierte Teilmengen für den Alltag. Keine Zertifizierung von GAEB oder DATEV." />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler) || previewError} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-2xl">GAEB DA XML</h2>
          <p className="mt-2 text-sm text-muted">Import und Export der Austauschphasen X83 und X84: Projekt, LV, Bereiche, Positionen mit Menge, Einheit, Kurz- und Langtext und Preis.</p>
          <form action={importGaeb} className="mt-4 space-y-3">
            <label><span className={labelClass}>Kunde</span>
              <select className={fieldClass} name="customerId" required>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
            </label>
            <label><span className={labelClass}>Projekt</span>
              <select className={fieldClass} name="projectId"><option value="">Ohne Projekt</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
            </label>
            <input className={fieldClass} type="file" name="file" accept=".x83,.x84,.xml,text/xml" />
            <div className="flex gap-2">
              <button className={btnPrimary}>Datei importieren</button>
              <button className={btnGhost} name="sample" value="1">Beispiel-LV importieren</button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted">Beispiel: samples/gaeb/lv-tiefgarage.x83. Export steht an jedem Beleg.</p>
        </Card>
        <Card>
          <h2 className="font-serif text-2xl">DATANORM-Auszug</h2>
          <p className="mt-2 text-sm text-muted">Satzart V und A, Semikolon. Kennzeichen N, A und L aktualisieren Einkauf, Verkauf und Bestand.</p>
          <form action={previewDatanorm} className="mt-4 space-y-3">
            <input className={fieldClass} type="file" name="file" accept=".datanorm,.txt,.001,text/plain" />
            <div className="flex gap-2">
              <button className={btnPrimary}>Vorschau</button>
              <button className={btnGhost} name="sample" value="1">Beispiel anzeigen</button>
            </div>
          </form>
          <a className="mt-3 inline-block text-sm font-semibold text-spruce" href="/api/datanorm">Aktuellen Katalog exportieren</a>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-serif text-2xl">DATEV-Buchungsstapel</h2>
          <p className="mt-2 text-sm text-muted">EXTF-Datei in Windows-1252 plus Debitoren- und Kreditorenstamm. Spalten stehen in der README und in LESEN.txt im Zip.</p>
          <form className="mt-4 flex flex-wrap items-end gap-3" action="/api/datev">
            <label><span className={labelClass}>Von</span><input className={fieldClass} type="date" name="von" defaultValue={yearStart} /></label>
            <label><span className={labelClass}>Bis</span><input className={fieldClass} type="date" name="bis" defaultValue={today} /></label>
            <button className={btnPrimary}>Zip laden</button>
          </form>
        </Card>
      </div>
      {preview ? (
        <Card className="mt-6">
          <h2 className="font-serif text-2xl">DATANORM-Vorschau {preview.supplierName ? `· ${preview.supplierName}` : ""}</h2>
          <form action={applyDatanorm} className="mt-4 space-y-3">
            <input type="hidden" name="stored" value={datanorm === "sample" ? "sample" : datanorm} />
            <label><span className={labelClass}>Lieferant für neue Artikel</span>
              <select className={fieldClass} name="supplierId">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
            </label>
            <button className={btnPrimary}>Katalog aktualisieren</button>
          </form>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th>Satz</th><th>Nr.</th><th>Text</th><th>Bisher</th><th>Neu</th></tr></thead>
            <tbody>
              {preview.articles.map((article) => {
                const current = articles.find((item) => item.sku === article.sku);
                return (
                  <tr key={article.sku} className="border-t border-line">
                    <td className="py-2">{article.action}</td>
                    <td>{article.sku}</td>
                    <td>{article.name}</td>
                    <td>{current ? `${formatEuro(current.purchasePrice)} / ${formatEuro(current.salesPrice)}` : "—"}</td>
                    <td>{article.action === "L" ? "löschen" : `${formatEuro(article.purchasePrice)} / ${formatEuro(article.salesPrice)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}
      <p className="mt-6 text-sm text-muted">Die Beispieldateien liegen im Ordner <Link className="font-semibold text-spruce" href="/schnittstellen">samples/</Link> des Projekts.</p>
    </div>
  );
}
