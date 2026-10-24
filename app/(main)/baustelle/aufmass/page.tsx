import { prisma } from "@/lib/db";
import { deleteMeasurement } from "@/actions/site";
import { MeasurementForm } from "@/components/measurement-form";
import { Card } from "@/components/ui";
import { formatNumber, one } from "@/lib/format";

export default async function SiteMeasurePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const projects = await prisma.project.findMany({ where: { status: { not: "ABGESCHLOSSEN" } }, orderBy: { title: "asc" } });
  const projectId = one(params.projekt) || projects[0]?.id || "";
  const measurements = projectId ? await prisma.measurement.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }) : [];
  const back = `/baustelle/aufmass?projekt=${projectId}`;
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Aufmaß</h1>
      <form>
        <select className="w-full rounded-xl border border-line bg-white px-3 py-2" name="projekt" defaultValue={projectId}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.title}</option>
          ))}
        </select>
        <button className="mt-2 text-sm font-semibold text-spruce">Wechseln</button>
      </form>
      {projectId ? <Card><MeasurementForm projectId={projectId} back={back} /></Card> : null}
      <ul className="space-y-2">
        {measurements.map((measurement) => (
          <li key={measurement.id} className="rounded-2xl border border-line bg-white p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span>{measurement.title}</span>
              <strong>{formatNumber(measurement.result, 3)} {measurement.unit}</strong>
            </div>
            <form action={deleteMeasurement}>
              <input type="hidden" name="id" value={measurement.id} />
              <input type="hidden" name="back" value={back} />
              <button className="text-xs text-bad">Löschen</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
