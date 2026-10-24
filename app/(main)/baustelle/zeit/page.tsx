import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TimePanel } from "@/components/time-panel";

export default async function SiteTimePage() {
  const user = await requireUser();
  const [entries, projects, open] = await Promise.all([
    prisma.timeEntry.findMany({ where: { userId: user.id }, include: { project: true }, orderBy: { start: "desc" }, take: 30 }),
    prisma.project.findMany({ where: { status: { not: "ABGESCHLOSSEN" } }, orderBy: { title: "asc" } }),
    prisma.timeEntry.findFirst({ where: { userId: user.id, end: null }, include: { project: true } }),
  ]);
  return (
    <div>
      <h1 className="mb-4 font-serif text-3xl">Zeit</h1>
      <TimePanel
        back="/baustelle/zeit"
        projects={projects.map((project) => ({ id: project.id, title: project.title }))}
        open={open ? { start: open.start, type: open.type, project: open.project?.title ?? null } : null}
        entries={entries.map((entry) => ({
          id: entry.id,
          type: entry.type,
          start: entry.start,
          end: entry.end,
          note: entry.note,
          user: user.name,
          project: entry.project?.title ?? null,
        }))}
      />
    </div>
  );
}
