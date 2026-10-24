import { prisma } from "@/lib/db";
import { deleteService, saveService } from "@/actions/master";
import { MasterNav } from "@/components/master-nav";
import { Card, Flash, PageHeader, btnDanger, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { formatEuro, one } from "@/lib/format";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const services = await prisma.serviceItem.findMany({ orderBy: { code: "asc" } });
  const editing = services.find((service) => service.id === one(params.edit));
  return (
    <div>
      <PageHeader eyebrow="Stammdaten" title="Leistungskatalog" />
      <MasterNav current="/stammdaten/leistungen" />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <form action={saveService} className="space-y-3">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <label><span className={labelClass}>Kennung</span><input className={fieldClass} name="code" required defaultValue={editing?.code ?? ""} /></label>
            <label><span className={labelClass}>Name</span><input className={fieldClass} name="name" required defaultValue={editing?.name ?? ""} /></label>
            <label><span className={labelClass}>Beschreibung</span><textarea className={fieldClass} name="description" defaultValue={editing?.description ?? ""} rows={3} /></label>
            <label><span className={labelClass}>Einheit</span><input className={fieldClass} name="unit" defaultValue={editing?.unit ?? "Stk"} /></label>
            <label><span className={labelClass}>Minuten</span><input className={fieldClass} name="minutes" defaultValue={editing?.minutes ?? 0} /></label>
            <label><span className={labelClass}>Kosten</span><input className={fieldClass} name="costPrice" defaultValue={editing?.costPrice ?? 0} /></label>
            <label><span className={labelClass}>Verkauf</span><input className={fieldClass} name="salesPrice" defaultValue={editing?.salesPrice ?? 0} /></label>
            <label><span className={labelClass}>Suchbegriffe</span><input className={fieldClass} name="matchTerms" defaultValue={editing?.matchTerms ?? ""} /></label>
            <button className={btnPrimary}>Speichern</button>
          </form>
        </Card>
        <div className="space-y-2">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
              <a href={`/stammdaten/leistungen?edit=${service.id}`}>
                <strong>{service.code} {service.name}</strong>
                <p className="text-xs text-muted">{service.unit} · {formatEuro(service.salesPrice)}</p>
              </a>
              <form action={deleteService}><input type="hidden" name="id" value={service.id} /><button className={btnDanger}>Löschen</button></form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
