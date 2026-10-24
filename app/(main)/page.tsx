import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { berlinToday, formatBerlinTime, formatDate, formatEuro, greeting, parseDateInput } from "@/lib/format";
import { DOC_TYPES, labelOf, PROJECT_STATUS, statusTone } from "@/lib/labels";
import { round2 } from "@/lib/money";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = parseDateInput(berlinToday())!;
  const [documents, projects, assignments, receptions, openTimes, payments] = await Promise.all([
    prisma.document.findMany({ include: { customer: true, payments: true }, orderBy: { date: "desc" }, take: 6 }),
    prisma.project.findMany({ where: { status: { in: ["BAUSTELLE", "AUFTRAG", "ABRECHNUNG"] } }, include: { customer: true } }),
    prisma.assignment.findMany({
      where: { startDate: { lte: today }, endDate: { gte: today } },
      include: { project: true, resource: true },
    }),
    prisma.receptionNote.findMany({ orderBy: { createdAt: "desc" }, take: 4, include: { project: true } }),
    prisma.timeEntry.findMany({ where: { end: null }, include: { user: true, project: true } }),
    prisma.payment.findMany({ where: { date: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) } } }),
  ]);
  const openInvoices = documents.filter((document) => ["OFFEN", "TEILBEZAHLT"].includes(document.status));
  const openSum = round2(
    openInvoices.reduce((sum, document) => sum + document.gross - document.payments.reduce((paid, payment) => paid + payment.amount, 0), 0),
  );

  return (
    <div>
      <PageHeader eyebrow="Werkplan" title={greeting(user.name)} text="Was heute im Betrieb und auf der Baustelle anliegt." />
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Offene Posten</p>
          <p className="mt-2 font-serif text-3xl">{formatEuro(openSum)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Aktive Projekte</p>
          <p className="mt-2 font-serif text-3xl">{projects.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Heute eingeplant</p>
          <p className="mt-2 font-serif text-3xl">{assignments.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Zahlungen im Monat</p>
          <p className="mt-2 font-serif text-3xl">{formatEuro(payments.reduce((sum, payment) => sum + payment.amount, 0))}</p>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-2xl">Heute auf der Baustelle</h2>
          <ul className="mt-4 space-y-3">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{assignment.resource.name}</p>
                  <p className="text-sm text-muted">{assignment.project.title}</p>
                </div>
                <Link href={`/projekte/${assignment.projectId}`} className="text-sm font-semibold text-spruce">
                  Öffnen
                </Link>
              </li>
            ))}
            {assignments.length === 0 ? <li className="text-sm text-muted">Heute ist niemand eingeplant.</li> : null}
          </ul>
          {openTimes.length ? (
            <div className="mt-4 border-t border-line pt-4">
              {openTimes.map((entry) => (
                <p key={entry.id} className="text-sm">
                  {entry.user.name} seit {formatBerlinTime(entry.start)} auf {entry.project?.title ?? "ohne Projekt"}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
        <Card>
          <h2 className="font-serif text-2xl">Letzte Belege</h2>
          <ul className="mt-4 space-y-3">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3">
                <div>
                  <Link href={`/buero/${document.id}`} className="font-semibold">
                    {document.number}
                  </Link>
                  <p className="text-sm text-muted">
                    {labelOf(DOC_TYPES, document.type)} · {document.customer.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{formatEuro(document.gross)}</p>
                  <Badge tone={statusTone(document.status)}>{labelOfStatus(document.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-serif text-2xl">Projekte</h2>
          <ul className="mt-4 space-y-3">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3">
                <div>
                  <Link href={`/projekte/${project.id}`} className="font-semibold">
                    {project.title}
                  </Link>
                  <p className="text-sm text-muted">{project.customer.name}</p>
                </div>
                <Badge tone={statusTone(project.status)}>{labelOf(PROJECT_STATUS, project.status)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Empfang</h2>
            <Link href="/ki/empfang" className="text-sm font-semibold text-spruce">
              Anruf annehmen
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {receptions.map((note) => (
              <li key={note.id}>
                <p className="font-semibold">{note.callerName}</p>
                <p className="text-sm text-muted">
                  {formatDate(note.createdAt)} · {note.concern}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function labelOfStatus(status: string) {
  const map: Record<string, string> = {
    ENTWURF: "Entwurf",
    VERSENDET: "Versendet",
    ANGENOMMEN: "Angenommen",
    ABGELEHNT: "Abgelehnt",
    OFFEN: "Offen",
    TEILBEZAHLT: "Teilbezahlt",
    BEZAHLT: "Bezahlt",
    STORNIERT: "Storniert",
  };
  return map[status] ?? status;
}
