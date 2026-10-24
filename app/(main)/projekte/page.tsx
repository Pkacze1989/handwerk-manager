import Link from "next/link";
import { prisma } from "@/lib/db";
import { saveProject } from "@/actions/projects";
import { Badge, Card, Flash, PageHeader, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { formatDate, one } from "@/lib/format";
import { PROJECT_STATUS, labelOf, statusTone } from "@/lib/labels";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [projects, customers] = await Promise.all([
    prisma.project.findMany({ include: { customer: true }, orderBy: { number: "desc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Projekte" title="Bauakten" text="Jedes Projekt bündelt Belege, Pläne, Zeiten, Chat und Kalkulation." />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card>
          <h2 className="font-serif text-2xl">Neues Projekt</h2>
          <form action={saveProject} className="mt-4 space-y-3">
            <label>
              <span className={labelClass}>Titel</span>
              <input className={fieldClass} name="title" required />
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
              <span className={labelClass}>Status</span>
              <select className={fieldClass} name="status" defaultValue="ANFRAGE">
                {PROJECT_STATUS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Straße</span>
              <input className={fieldClass} name="street" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input className={fieldClass} name="zip" placeholder="PLZ" />
              <input className={`${fieldClass} col-span-2`} name="city" placeholder="Ort" />
            </div>
            <button className={btnPrimary}>Anlegen</button>
          </form>
        </Card>
        <div className="space-y-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projekte/${project.id}`} className="block rounded-3xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">{project.number}</p>
                  <h2 className="font-serif text-2xl">{project.title}</h2>
                  <p className="text-sm text-muted">
                    {project.customer.name}
                    {project.city ? ` · ${project.zip} ${project.city}` : ""}
                  </p>
                </div>
                <Badge tone={statusTone(project.status)}>{labelOf(PROJECT_STATUS, project.status)}</Badge>
              </div>
              {project.startDate ? <p className="mt-2 text-xs text-muted">Start {formatDate(project.startDate)}</p> : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
