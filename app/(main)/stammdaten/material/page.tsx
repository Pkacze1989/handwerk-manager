import { prisma } from "@/lib/db";
import { deleteArticle, saveArticle } from "@/actions/master";
import { MasterNav } from "@/components/master-nav";
import { Card, Flash, PageHeader, btnDanger, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { formatEuro, one } from "@/lib/format";

export default async function MaterialPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [articles, suppliers] = await Promise.all([
    prisma.article.findMany({ include: { supplier: true }, orderBy: { sku: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);
  const editing = articles.find((article) => article.id === one(params.edit));
  return (
    <div>
      <PageHeader eyebrow="Stammdaten" title="Materialkatalog" />
      <MasterNav current="/stammdaten/material" />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <form action={saveArticle} className="space-y-3">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <label><span className={labelClass}>Artikelnummer</span><input className={fieldClass} name="sku" required defaultValue={editing?.sku ?? ""} /></label>
            <label><span className={labelClass}>Name</span><input className={fieldClass} name="name" required defaultValue={editing?.name ?? ""} /></label>
            <label><span className={labelClass}>Einheit</span><input className={fieldClass} name="unit" defaultValue={editing?.unit ?? "Stk"} /></label>
            <label><span className={labelClass}>EK</span><input className={fieldClass} name="purchasePrice" defaultValue={editing?.purchasePrice ?? ""} /></label>
            <label><span className={labelClass}>VK</span><input className={fieldClass} name="salesPrice" defaultValue={editing?.salesPrice ?? ""} /></label>
            <label><span className={labelClass}>MwSt</span><input className={fieldClass} name="vatRate" defaultValue={editing?.vatRate ?? 19} /></label>
            <label>
              <span className={labelClass}>Lieferant</span>
              <select className={fieldClass} name="supplierId" defaultValue={editing?.supplierId ?? ""}>
                <option value="">—</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label><span className={labelClass}>Suchbegriffe</span><input className={fieldClass} name="matchTerms" defaultValue={editing?.matchTerms ?? ""} /></label>
            <button className={btnPrimary}>Speichern</button>
          </form>
        </Card>
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="px-4 py-3">Nr.</th><th className="px-4 py-3">Artikel</th><th className="px-4 py-3">EK</th><th className="px-4 py-3">VK</th><th /></tr></thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-t border-line">
                  <td className="px-4 py-3">{article.sku}</td>
                  <td className="px-4 py-3"><a className="font-semibold" href={`/stammdaten/material?edit=${article.id}`}>{article.name}</a><p className="text-xs text-muted">{article.unit} · {article.supplier?.name}</p></td>
                  <td className="px-4 py-3 tabular-nums">{formatEuro(article.purchasePrice)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatEuro(article.salesPrice)}</td>
                  <td className="px-4 py-3"><form action={deleteArticle}><input type="hidden" name="id" value={article.id} /><button className={btnDanger}>Löschen</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
