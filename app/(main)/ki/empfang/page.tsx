import Link from "next/link";
import { prisma } from "@/lib/db";
import { ReceptionDesk } from "@/components/reception-desk";
import { Card, PageHeader } from "@/components/ui";
import { formatBerlinDateTime } from "@/lib/format";
import { URGENCY, labelOf } from "@/lib/labels";

export default async function ReceptionPage() {
  const [customers, projects, notes] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.receptionNote.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { project: true } }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader eyebrow="KI" title="Virtueller Empfang" text="Simulierter Anruf. Es wird keine Telefonanlage verbunden. Das Anliegen landet beim Kunden und im Projekt." actions={<Link className="text-sm font-semibold text-spruce" href="/ki/angebot">Angebotsentwurf</Link>} />
        <Card>
          <ReceptionDesk
            customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
            projects={projects.map((project) => ({ id: project.id, title: project.title, customerId: project.customerId }))}
          />
        </Card>
      </div>
      <Card>
        <h2 className="font-serif text-2xl">Zuletzt</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {notes.map((note) => (
            <li key={note.id}>
              <p className="font-semibold">{note.callerName}</p>
              <p className="text-muted">{formatBerlinDateTime(note.createdAt)} · {labelOf(URGENCY, note.urgency)}</p>
              <p>{note.concern}</p>
              {note.project ? <Link className="text-spruce" href={`/projekte/${note.projectId}`}>{note.project.title}</Link> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
