import Link from "next/link";
import { prisma } from "@/lib/db";
import { PlantafelBoard } from "@/components/plantafel-board";
import { PageHeader } from "@/components/ui";
import { addDaysISO, berlinToday, dateInputValue, mondayOf, one, weekdayLabel } from "@/lib/format";

export default async function PlantafelPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const week = mondayOf(one(params.w) || berlinToday());
  const days = Array.from({ length: 7 }, (_, index) => {
    const iso = addDaysISO(week, index);
    return { iso, label: weekdayLabel(iso) };
  });
  const [resources, projects, assignments] = await Promise.all([
    prisma.resource.findMany({ include: { user: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { status: { not: "ABGESCHLOSSEN" } }, orderBy: { title: "asc" } }),
    prisma.assignment.findMany({ include: { resource: { include: { user: true } } } }),
  ]);
  const back = `/plantafel?w=${week}`;
  return (
    <div>
      <PageHeader
        eyebrow="Disposition"
        title="Plantafel"
        text="Kolonnen, Menschen, Maschinen und Fahrzeuge auf Baustellen und Zeiträume legen."
        actions={
          <>
            <Link className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold" href={`/plantafel?w=${addDaysISO(week, -7)}`}>
              Vorherige Woche
            </Link>
            <Link className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold" href={`/plantafel?w=${addDaysISO(week, 7)}`}>
              Nächste Woche
            </Link>
          </>
        }
      />
      <PlantafelBoard
        weekStart={week}
        days={days}
        back={back}
        resources={resources.map((resource) => ({
          id: resource.id,
          name: resource.name,
          type: resource.type,
          color: resource.user?.color || (resource.type === "FAHRZEUG" ? "#a45b38" : resource.type === "KOLONNE" ? "#3e6b58" : "#5c675f"),
        }))}
        projects={projects.map((project) => ({ id: project.id, number: project.number, title: project.title }))}
        assignments={assignments.map((assignment) => ({
          id: assignment.id,
          resourceId: assignment.resourceId,
          projectId: assignment.projectId,
          start: dateInputValue(assignment.startDate),
          end: dateInputValue(assignment.endDate),
          name: assignment.resource.name,
          color: assignment.resource.user?.color || "#1e4638",
          note: assignment.note ?? "",
        }))}
      />
    </div>
  );
}
