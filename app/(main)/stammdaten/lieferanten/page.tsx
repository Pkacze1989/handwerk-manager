import { prisma } from "@/lib/db";
import { deleteSupplier, saveSupplier } from "@/actions/master";
import { MasterNav } from "@/components/master-nav";
import { Card, Flash, PageHeader, btnDanger, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { one } from "@/lib/format";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const suppliers = await prisma.supplier.findMany({ orderBy: { number: "asc" } });
  const editing = suppliers.find((supplier) => supplier.id === one(params.edit));
  return (
    <div>
      <PageHeader eyebrow="Stammdaten" title="Lieferanten" />
      <MasterNav current="/stammdaten/lieferanten" />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <form action={saveSupplier} className="space-y-3">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <label><span className={labelClass}>Name</span><input className={fieldClass} name="name" required defaultValue={editing?.name ?? ""} /></label>
            <label><span className={labelClass}>Kontakt</span><input className={fieldClass} name="contact" defaultValue={editing?.contact ?? ""} /></label>
            <label><span className={labelClass}>Straße</span><input className={fieldClass} name="street" defaultValue={editing?.street ?? ""} /></label>
            <label><span className={labelClass}>PLZ</span><input className={fieldClass} name="zip" defaultValue={editing?.zip ?? ""} /></label>
            <label><span className={labelClass}>Ort</span><input className={fieldClass} name="city" defaultValue={editing?.city ?? ""} /></label>
            <label><span className={labelClass}>E-Mail</span><input className={fieldClass} name="email" defaultValue={editing?.email ?? ""} /></label>
            <label><span className={labelClass}>Telefon</span><input className={fieldClass} name="phone" defaultValue={editing?.phone ?? ""} /></label>
            <label><span className={labelClass}>Kreditor</span><input className={fieldClass} name="creditorNo" defaultValue={editing?.creditorNo ?? ""} /></label>
            <button className={btnPrimary}>Speichern</button>
          </form>
        </Card>
        <div className="space-y-2">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
              <a href={`/stammdaten/lieferanten?edit=${supplier.id}`}><strong>{supplier.name}</strong><p className="text-xs text-muted">{supplier.number} · Kreditor {supplier.creditorNo}</p></a>
              <form action={deleteSupplier}><input type="hidden" name="id" value={supplier.id} /><button className={btnDanger}>Löschen</button></form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
