import { prisma } from "@/lib/db";
import { saveEmployee } from "@/actions/master";
import { saveResource, setCrewMembers } from "@/actions/planning";
import { MasterNav } from "@/components/master-nav";
import { Card, Flash, PageHeader, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { formatEuro, one } from "@/lib/format";
import { RESOURCE_TYPES, ROLES, labelOf } from "@/lib/labels";

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [users, resources] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.resource.findMany({ include: { members: true, user: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Stammdaten" title="Team und Ressourcen" text="Stundensätze speisen die Nachkalkulation. Kolonnen erscheinen in der Plantafel." />
      <MasterNav current="/stammdaten/team" />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <form action={saveEmployee} className="grid gap-3 md:grid-cols-5">
              <input type="hidden" name="id" value={user.id} />
              <label><span className={labelClass}>Name</span><input className={fieldClass} name="name" defaultValue={user.name} /></label>
              <label>
                <span className={labelClass}>Rolle</span>
                <select className={fieldClass} name="role" defaultValue={user.role}>{ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label><span className={labelClass}>Telefon</span><input className={fieldClass} name="phone" defaultValue={user.phone ?? ""} /></label>
              <label><span className={labelClass}>Stundensatz</span><input className={fieldClass} name="hourlyRate" defaultValue={user.hourlyRate} /></label>
              <label><span className={labelClass}>Farbe</span><input className={fieldClass} name="color" type="color" defaultValue={user.color} /></label>
              <p className="md:col-span-5 text-xs text-muted">{user.email} · aktuell {formatEuro(user.hourlyRate)} / h</p>
              <button className={btnPrimary}>Speichern</button>
            </form>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-2xl">Neue Ressource</h2>
          <form action={saveResource} className="mt-4 space-y-3">
            <select className={fieldClass} name="type">{RESOURCE_TYPES.filter(([value]) => value !== "MITARBEITER").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input className={fieldClass} name="name" placeholder="Name" required />
            <input className={fieldClass} name="details" placeholder="Details" />
            <button className={btnPrimary}>Anlegen</button>
          </form>
        </Card>
        <div className="space-y-3">
          {resources.map((resource) => (
            <Card key={resource.id}>
              <p className="font-semibold">{resource.name}</p>
              <p className="text-xs text-muted">{labelOf(RESOURCE_TYPES, resource.type)}{resource.details ? ` · ${resource.details}` : ""}</p>
              {resource.type === "KOLONNE" ? (
                <form action={setCrewMembers} className="mt-3 space-y-1">
                  <input type="hidden" name="crewId" value={resource.id} />
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="userId" value={user.id} defaultChecked={resource.members.some((member) => member.userId === user.id)} />
                      {user.name}
                    </label>
                  ))}
                  <button className={`${btnPrimary} mt-2`}>Kolonne speichern</button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
