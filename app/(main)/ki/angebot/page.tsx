import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { draftQuote } from "@/actions/ai";
import { Card, Flash, PageHeader, btnGhost, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { one } from "@/lib/format";

export default async function QuoteAiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [customers, projects] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { title: "asc" } }),
  ]);
  const sample = one(params.beispiel) === "1" ? await readFile(path.join(process.cwd(), "samples/ki/anfrage-richter.txt"), "utf8") : "";
  return (
    <div>
      <PageHeader eyebrow="KI" title="Angebot aus Freitext" text="Sprachnotiz, Mail oder Datei werden gegen den Material- und Leistungskatalog gelegt. Ohne API-Schlüssel arbeitet die lokale Engine." actions={<Link className="text-sm font-semibold text-spruce" href="/ki/empfang">Empfang</Link>} />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <Card>
        <form action={draftQuote} className="space-y-3">
          <label>
            <span className={labelClass}>Freitext oder Transkript</span>
            <textarea className={fieldClass} name="text" rows={10} defaultValue={sample} placeholder="12 Steckdosen, 25 Meter NYM-J 3x1,5, Unterverteilung …" />
          </label>
          <label>
            <span className={labelClass}>Foto, PDF oder Text zur Bauakte</span>
            <input className={fieldClass} type="file" name="file" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={labelClass}>Kunde</span>
              <select className={fieldClass} name="customerId">
                <option value="">Automatisch erkennen oder neu anlegen</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Projekt</span>
              <select className={fieldClass} name="projectId">
                <option value="">Neues Projekt</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary}>Entwurf erzeugen</button>
            <button className={btnGhost} name="sample" value="1" formNoValidate>Beispieltext verwenden</button>
          </div>
        </form>
        <p className="mt-4 text-sm"><Link className="font-semibold text-spruce" href="/ki/angebot?beispiel=1">Beispiel in das Feld laden</Link></p>
      </Card>
    </div>
  );
}
