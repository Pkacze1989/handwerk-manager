import { prisma } from "@/lib/db";
import { DokuForm } from "@/components/doku-form";
import { Card } from "@/components/ui";
import { formatDate, one } from "@/lib/format";
import { LOG_KINDS, labelOf } from "@/lib/labels";

export default async function SiteDokuPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const projects = await prisma.project.findMany({ where: { status: { not: "ABGESCHLOSSEN" } }, orderBy: { title: "asc" } });
  const projectId = one(params.projekt) || projects[0]?.id || "";
  const logs = projectId
    ? await prisma.siteLog.findMany({ where: { projectId }, include: { photos: true, signatures: true, user: true }, orderBy: { date: "desc" } })
    : [];
  const back = `/baustelle/doku?projekt=${projectId}`;
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Baudoku</h1>
      <form>
        <select className="w-full rounded-xl border border-line bg-white px-3 py-2" name="projekt" defaultValue={projectId}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.title}</option>
          ))}
        </select>
        <button className="mt-2 text-sm font-semibold text-spruce">Wechseln</button>
      </form>
      {projectId ? <Card><DokuForm projectId={projectId} back={back} /></Card> : null}
      {logs.map((log) => (
        <Card key={log.id}>
          <p className="text-xs text-muted">{formatDate(log.date)} · {labelOf(LOG_KINDS, log.kind)} · {log.user.name}</p>
          <p className="mt-1 text-sm">{log.text}</p>
          <div className="mt-2 flex gap-2">
            {log.photos.map((photo) => (
              <img key={photo.id} src={`/api/dateien/foto/${photo.id}`} alt="" className="h-20 rounded-xl object-cover" />
            ))}
          </div>
          {log.signatures.map((signature) => (
            <img key={signature.id} src={signature.dataUrl} alt={signature.signerName} className="mt-2 h-12" />
          ))}
        </Card>
      ))}
    </div>
  );
}
