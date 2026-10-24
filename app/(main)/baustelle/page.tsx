import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { berlinToday, formatDate, parseDateInput } from "@/lib/format";
import { labelOf, PROJECT_STATUS } from "@/lib/labels";

export default async function SiteHomePage() {
  const user = await requireUser();
  const today = parseDateInput(berlinToday())!;
  const [assignments, instructions, open] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        startDate: { lte: today },
        endDate: { gte: today },
        OR: [{ userId: user.id }, { resource: { members: { some: { userId: user.id } } } }],
      },
      include: { project: { include: { customer: true } }, resource: true },
    }),
    prisma.workInstruction.findMany({
      where: { assigneeId: user.id, status: { not: "ERLEDIGT" } },
      include: { project: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.timeEntry.findFirst({ where: { userId: user.id, end: null }, include: { project: true } }),
  ]);
  return (
    <div className="space-y-4">
      <p className="font-serif text-3xl">Heute</p>
      <p className="text-sm text-muted">{formatDate(today)} · {user.name}</p>
      {open ? (
        <Card>
          <p className="text-sm">Zeit läuft auf {open.project?.title ?? "ohne Projekt"}.</p>
          <Link href="/baustelle/zeit" className="mt-2 inline-block text-sm font-semibold text-spruce">Zur Zeiterfassung</Link>
        </Card>
      ) : null}
      {assignments.map((assignment) => (
        <Card key={assignment.id}>
          <p className="text-xs uppercase tracking-wide text-muted">{assignment.resource.name}</p>
          <h2 className="font-serif text-2xl">{assignment.project.title}</h2>
          <p className="text-sm text-muted">{assignment.project.street}, {assignment.project.zip} {assignment.project.city}</p>
          <p className="mt-1 text-sm">{assignment.project.customer.name} · {labelOf(PROJECT_STATUS, assignment.project.status)}</p>
          <div className="mt-3 flex gap-3 text-sm font-semibold text-spruce">
            <Link href={`/baustelle/aufmass?projekt=${assignment.projectId}`}>Aufmaß</Link>
            <Link href={`/baustelle/doku?projekt=${assignment.projectId}`}>Doku</Link>
            <Link href={`/projekte/${assignment.projectId}?tab=chat`}>Chat</Link>
          </div>
        </Card>
      ))}
      {assignments.length === 0 ? <Card><p className="text-sm">Für heute ist kein Einsatz hinterlegt.</p></Card> : null}
      <Card>
        <h2 className="font-serif text-xl">Offene Anweisungen</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {instructions.map((instruction) => (
            <li key={instruction.id}>
              <Link href="/baustelle/anweisungen" className="font-semibold">{instruction.title}</Link>
              <p className="text-muted">{instruction.project.title}</p>
            </li>
          ))}
          {instructions.length === 0 ? <li className="text-muted">Nichts Offen.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
