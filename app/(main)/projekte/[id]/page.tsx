import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addEmail, addProjectFile, deleteProjectFile, postChat, saveInstruction, saveProject } from "@/actions/projects";
import { addCalcLine, deleteCalcLine, quoteFromCalc, takeSnapshot, updateCalcSettings } from "@/actions/calc";
import { createHoursDocument, createFromSiteLog } from "@/actions/documents";
import { deleteMeasurement } from "@/actions/site";
import { DokuForm } from "@/components/doku-form";
import { MeasurementForm } from "@/components/measurement-form";
import { TimePanel } from "@/components/time-panel";
import { Badge, Card, Empty, Flash, PageHeader, btnGhost, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { projectControlling } from "@/lib/controlling";
import { summarizeCalculation } from "@/lib/calc";
import { dateInputValue, formatBerlinDateTime, formatDate, formatEuro, formatNumber, one } from "@/lib/format";
import { CALC_CATEGORIES, DOC_TYPES, FILE_KINDS, LOG_KINDS, PROJECT_STATUS, labelOf, statusTone } from "@/lib/labels";

const tabs = [
  ["uebersicht", "Übersicht"],
  ["dokumente", "Dokumente"],
  ["dateien", "Dateien"],
  ["emails", "E-Mails"],
  ["chat", "Chat"],
  ["kalkulation", "Kalkulation"],
  ["zeiten", "Zeiten"],
  ["aufmass", "Aufmaß"],
  ["doku", "Doku"],
  ["anweisungen", "Anweisungen"],
] as const;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = one(query.tab) || "uebersicht";
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: true,
      documents: { orderBy: { date: "desc" } },
      files: { orderBy: { createdAt: "desc" } },
      emails: { orderBy: { sentAt: "desc" } },
      messages: { include: { user: true }, orderBy: { createdAt: "asc" } },
      instructions: { include: { assignee: true, author: true }, orderBy: { createdAt: "desc" } },
      measurements: { orderBy: { createdAt: "desc" } },
      logs: { include: { user: true, photos: true, signatures: true }, orderBy: { date: "desc" } },
      times: { include: { user: true }, orderBy: { start: "desc" } },
      calcs: { include: { lines: true }, orderBy: { createdAt: "desc" } },
      snapshots: { orderBy: { takenAt: "desc" } },
      receptions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) notFound();
  const [customers, users, controlling] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    projectControlling(id),
  ]);
  const back = `/projekte/${id}?tab=${tab}`;

  return (
    <div>
      <PageHeader
        eyebrow={`${project.number} · Digitale Bauakte`}
        title={project.title}
        text={`${project.customer.name}${project.street ? ` · ${project.street}, ${project.zip ?? ""} ${project.city ?? ""}` : ""}`}
        actions={<Badge tone={statusTone(project.status)}>{labelOf(PROJECT_STATUS, project.status)}</Badge>}
      />
      <Flash hinweis={one(query.hinweis)} fehler={one(query.fehler)} />
      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/projekte/${id}?tab=${key}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${tab === key ? "bg-spruce text-white" : "bg-white text-ink"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "uebersicht" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-serif text-2xl">Stammdaten</h2>
            <form action={saveProject} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={project.id} />
              <input className={fieldClass} name="title" defaultValue={project.title} />
              <select className={fieldClass} name="customerId" defaultValue={project.customerId}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <select className={fieldClass} name="status" defaultValue={project.status}>
                {PROJECT_STATUS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input className={fieldClass} name="street" defaultValue={project.street ?? ""} />
              <div className="grid grid-cols-3 gap-2">
                <input className={fieldClass} name="zip" defaultValue={project.zip ?? ""} />
                <input className={`${fieldClass} col-span-2`} name="city" defaultValue={project.city ?? ""} />
              </div>
              <textarea className={fieldClass} name="description" rows={4} defaultValue={project.description ?? ""} />
              <div className="grid grid-cols-2 gap-2">
                <input className={fieldClass} type="date" name="startDate" defaultValue={dateInputValue(project.startDate)} />
                <input className={fieldClass} type="date" name="endDate" defaultValue={dateInputValue(project.endDate)} />
              </div>
              <button className={btnPrimary}>Speichern</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-serif text-2xl">Lage</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt>Angebot</dt><dd>{controlling.quoteNumber ?? "—"} {controlling.quoteNet !== null ? formatEuro(controlling.quoteNet) : ""}</dd></div>
              <div className="flex justify-between"><dt>Fakturiert</dt><dd>{formatEuro(controlling.invoicedNet)}</dd></div>
              <div className="flex justify-between"><dt>Ist-Kosten</dt><dd>{formatEuro(controlling.actualCost)}</dd></div>
              <div className="flex justify-between"><dt>Ergebnis live</dt><dd>{formatEuro(controlling.profitOnInvoiced)}</dd></div>
            </dl>
            {project.receptions.length ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs uppercase tracking-wide text-muted">Empfang</p>
                {project.receptions.map((note) => (
                  <p key={note.id} className="mt-2 text-sm">{note.callerName}: {note.concern}</p>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "dokumente" ? (
        <Card>
          <ul className="space-y-3">
            {project.documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between">
                <Link href={`/buero/${document.id}`} className="font-semibold text-spruce">{document.number}</Link>
                <span className="text-sm text-muted">{labelOf(DOC_TYPES, document.type)} · {formatEuro(document.gross)}</span>
              </li>
            ))}
            {project.documents.length === 0 ? <Empty>Noch keine Belege.</Empty> : null}
          </ul>
        </Card>
      ) : null}

      {tab === "dateien" ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <form action={addProjectFile} className="space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <label><span className={labelClass}>Name</span><input className={fieldClass} name="name" /></label>
              <label>
                <span className={labelClass}>Art</span>
                <select className={fieldClass} name="kind">{FILE_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <input className={fieldClass} type="file" name="file" required />
              <button className={btnPrimary}>In die Akte</button>
            </form>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {project.files.map((file) => (
              <Card key={file.id}>
                {file.mime?.startsWith("image/") ? <img src={`/api/dateien/projekt/${file.id}`} alt="" className="mb-3 h-40 w-full rounded-2xl object-cover" /> : null}
                <p className="font-semibold">{file.name}</p>
                <p className="text-xs text-muted">{labelOf(FILE_KINDS, file.kind)}</p>
                <div className="mt-2 flex gap-3 text-sm">
                  <a className="font-semibold text-spruce" href={`/api/dateien/projekt/${file.id}`}>Öffnen</a>
                  <form action={deleteProjectFile}><input type="hidden" name="id" value={file.id} /><button className="text-bad">Entfernen</button></form>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "emails" ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <form action={addEmail} className="space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <select className={fieldClass} name="direction" defaultValue="EINGANG"><option value="EINGANG">Eingang</option><option value="AUSGANG">Ausgang</option></select>
              <input className={fieldClass} name="fromAddr" placeholder="Von" required />
              <input className={fieldClass} name="toAddr" placeholder="An" required />
              <input className={fieldClass} name="subject" placeholder="Betreff" required />
              <textarea className={fieldClass} name="body" rows={5} required />
              <input className={fieldClass} type="date" name="sentAt" />
              <button className={btnPrimary}>Ablegen</button>
            </form>
          </Card>
          <div className="space-y-3">
            {project.emails.map((email) => (
              <Card key={email.id}>
                <p className="text-xs text-muted">{email.direction === "EINGANG" ? "Eingang" : "Ausgang"} · {formatDate(email.sentAt)}</p>
                <h3 className="font-semibold">{email.subject}</h3>
                <p className="text-xs text-muted">{email.fromAddr} → {email.toAddr}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{email.body}</p>
              </Card>
            ))}
            {project.emails.length === 0 ? <Empty>Keine abgelegten E-Mails.</Empty> : null}
          </div>
        </div>
      ) : null}

      {tab === "chat" ? (
        <Card>
          <p className="mb-4 text-sm text-muted">Interner Projektchat, nur für den eigenen Betrieb. Nachrichten bleiben in dieser Installation und gehen nicht an Dritte. Das ist keine DSGVO-Zertifizierung.</p>
          <div className="space-y-4">
            {project.messages.map((message) => (
              <article key={message.id}>
                <p className="text-xs text-muted">{message.user.name} · {formatBerlinDateTime(message.createdAt)}</p>
                <p className="whitespace-pre-wrap text-sm">{highlight(message.body)}</p>
                {message.imagePath ? <img src={`/api/dateien/chat/${message.id}`} alt={message.imageName ?? ""} className="mt-2 max-h-56 rounded-2xl" /> : null}
              </article>
            ))}
          </div>
          <form action={postChat} className="mt-6 space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <textarea className={fieldClass} name="body" rows={3} placeholder={`Nachricht, Kollegen mit @${users[0]?.name ?? "Name"} erwähnen`} />
            <input className={fieldClass} type="file" name="image" accept="image/*" />
            <button className={btnPrimary}>Senden</button>
          </form>
        </Card>
      ) : null}

      {tab === "kalkulation" ? <CalcTab projectId={project.id} calcs={project.calcs} controlling={controlling} snapshots={project.snapshots} /> : null}

      {tab === "zeiten" ? (
        <div className="space-y-4">
          <form action={createHoursDocument}><input type="hidden" name="projectId" value={project.id} /><button className={btnGhost}>Stundennachweis erzeugen</button></form>
          <TimePanel
            back={back}
            projects={[{ id: project.id, title: project.title }]}
            open={null}
            entries={project.times.map((entry) => ({ id: entry.id, type: entry.type, start: entry.start, end: entry.end, note: entry.note, user: entry.user.name, project: project.title }))}
          />
        </div>
      ) : null}

      {tab === "aufmass" ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card><MeasurementForm projectId={project.id} back={back} /></Card>
          <div className="space-y-3">
            {project.measurements.map((measurement) => (
              <Card key={measurement.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{measurement.title}</p>
                    <p className="text-sm text-muted">{measurement.formula} → {formatNumber(measurement.result, 3)} {measurement.unit}</p>
                  </div>
                  <form action={deleteMeasurement}>
                    <input type="hidden" name="id" value={measurement.id} />
                    <input type="hidden" name="back" value={back} />
                    <button className="text-xs text-bad">Löschen</button>
                  </form>
                </div>
              </Card>
            ))}
            <p className="text-sm text-muted">Im Beleg des Projekts übernimmt „Mengen aus Aufmaß“ die Ergebnisse als Positionen.</p>
          </div>
        </div>
      ) : null}

      {tab === "doku" ? (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card><DokuForm projectId={project.id} back={back} /></Card>
          <div className="space-y-3">
            {project.logs.map((log) => (
              <Card key={log.id}>
                <p className="text-xs text-muted">{formatDate(log.date)} · {labelOf(LOG_KINDS, log.kind)} · {log.user.name}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{log.text}</p>
                {log.materials ? <p className="mt-2 text-sm text-muted">Material: {log.materials}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {log.photos.map((photo) => (
                    <img key={photo.id} src={`/api/dateien/foto/${photo.id}`} alt={photo.caption ?? ""} className="h-28 rounded-2xl object-cover" />
                  ))}
                </div>
                {log.signatures.map((signature) => (
                  <div key={signature.id} className="mt-2 text-xs">
                    {signature.signerName}
                    <img src={signature.dataUrl} alt="" className="h-14" />
                  </div>
                ))}
                <form action={createFromSiteLog} className="mt-3">
                  <input type="hidden" name="logId" value={log.id} />
                  <button className={btnGhost}>Als {log.kind === "ABNAHME" ? "Abnahme" : "Regiebericht"}</button>
                </form>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "anweisungen" ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <form action={saveInstruction} className="space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="back" value={back} />
              <input className={fieldClass} name="title" placeholder="Titel" required />
              <select className={fieldClass} name="assigneeId">{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
              <textarea className={fieldClass} name="body" rows={4} placeholder="Was ist zu tun?" required />
              <textarea className={fieldClass} name="materials" rows={4} placeholder="Material, eine Zeile je Position" />
              <input className={fieldClass} type="date" name="dueDate" />
              <button className={btnPrimary}>Anweisung geben</button>
            </form>
          </Card>
          <div className="space-y-3">
            {project.instructions.map((instruction) => {
              const materials = JSON.parse(instruction.materials || "[]") as { text: string; done: boolean }[];
              return (
                <Card key={instruction.id}>
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold">{instruction.title}</h3>
                    <Badge tone={statusTone(instruction.status)}>{instruction.status === "ERLEDIGT" ? "Erledigt" : instruction.status === "IN_ARBEIT" ? "In Arbeit" : "Offen"}</Badge>
                  </div>
                  <p className="text-sm text-muted">Für {instruction.assignee.name} · von {instruction.author.name}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{instruction.body}</p>
                  <ul className="mt-2 text-sm">{materials.map((item) => <li key={item.text}>{item.done ? "☑" : "☐"} {item.text}</li>)}</ul>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function highlight(body: string) {
  return body;
}

function CalcTab({
  projectId,
  calcs,
  controlling,
  snapshots,
}: {
  projectId: string;
  calcs: { id: string; title: string; marginPercent: number; surchargePercent: number; lines: { id: string; category: string; title: string; quantity: number; unit: string; unitCost: number; surchargePercent: number }[] }[];
  controlling: Awaited<ReturnType<typeof projectControlling>>;
  snapshots: { id: string; label: string; takenAt: Date; sollNet: number; istCost: number; invoiced: number; profit: number }[];
}) {
  const calc = calcs[0];
  const summary = calc
    ? summarizeCalculation(
        calc.lines.map((line) => ({ category: line.category, title: line.title, quantity: line.quantity, unit: line.unit, unitCost: line.unitCost, surchargePercent: line.surchargePercent })),
        calc.marginPercent,
      )
    : null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="font-serif text-2xl">Vorkalkulation</h2>
        {calc ? (
          <form action={updateCalcSettings} className="mt-3 grid grid-cols-2 gap-2">
            <input type="hidden" name="id" value={calc.id} />
            <input className={fieldClass} name="title" defaultValue={calc.title} />
            <input className={fieldClass} name="marginPercent" type="number" step="0.1" defaultValue={calc.marginPercent} />
            <p className="col-span-2 text-xs text-muted">Gewinn in Prozent auf die Summe nach Positionszuschlag. Der Betriebszuschlag steht je Position.</p>
            <button className={btnGhost}>Zuschläge speichern</button>
          </form>
        ) : <p className="mt-2 text-sm text-muted">Die erste Kostenposition legt die Kalkulation an.</p>}
        <ul className="mt-4 space-y-2 text-sm">
          {summary?.lines.map((line) => (
            <li key={line.title + line.category} className="flex items-center justify-between gap-2">
              <span>{labelOf(CALC_CATEGORIES, line.category)} · {line.title}</span>
              <span className="tabular-nums">{formatEuro(line.sales)}</span>
            </li>
          ))}
        </ul>
        {calc ? (
          <ul className="mt-2">
            {calc.lines.map((line) => (
              <li key={line.id}>
                <form action={deleteCalcLine}>
                  <input type="hidden" name="id" value={line.id} />
                  <button className="text-xs text-bad">{line.title} entfernen</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        {summary ? (
          <div className="mt-4 rounded-2xl bg-spruce-soft p-4">
            <p>Selbstkosten {formatEuro(summary.cost)}</p>
            <p>Nach Zuschlag {formatEuro(summary.overhead)}</p>
            <p className="font-serif text-2xl">Verkauf {formatEuro(summary.sales)}</p>
          </div>
        ) : null}
        <form action={addCalcLine} className="mt-4 grid gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          {calc ? <input type="hidden" name="calculationId" value={calc.id} /> : null}
          <select className={fieldClass} name="category">{CALC_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input className={fieldClass} name="title" placeholder="Bezeichnung" required />
          <div className="grid grid-cols-4 gap-2">
            <input className={fieldClass} name="quantity" placeholder="Menge" defaultValue="1" />
            <input className={fieldClass} name="unit" placeholder="ME" defaultValue="Stk" />
            <input className={fieldClass} name="unitCost" placeholder="EK" />
            <input className={fieldClass} name="surchargePercent" placeholder="Zuschlag %" defaultValue={calc?.surchargePercent ?? 15} />
          </div>
          <button className={btnPrimary}>Position</button>
        </form>
        {calc ? (
          <form action={quoteFromCalc} className="mt-3">
            <input type="hidden" name="id" value={calc.id} />
            <button className={btnGhost}>Als Angebot übernehmen</button>
          </form>
        ) : null}
      </Card>
      <Card>
        <h2 className="font-serif text-2xl">Nachkalkulation</h2>
        <p className="mt-1 text-sm text-muted">Soll aus Angebot und Vorkalkulation, Ist aus gebuchten Stunden und Eingangsrechnungen.</p>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-muted"><th>Kostenart</th><th>Soll</th><th>Ist</th></tr></thead>
          <tbody>
            {controlling.categories.map((row) => (
              <tr key={row.key} className="border-t border-line">
                <td className="py-2">{row.label}</td>
                <td>{row.soll === null ? "—" : formatEuro(row.soll)}</td>
                <td>{formatEuro(row.ist)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Soll-Erlös</dt><dd>{controlling.quoteNet === null ? "—" : formatEuro(controlling.quoteNet)}</dd></div>
          <div className="flex justify-between"><dt>Fakturiert</dt><dd>{formatEuro(controlling.invoicedNet)}</dd></div>
          <div className="flex justify-between"><dt>Ist-Kosten</dt><dd>{formatEuro(controlling.actualCost)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Ergebnis auf Faktura</dt><dd>{formatEuro(controlling.profitOnInvoiced)}</dd></div>
          <div className="flex justify-between"><dt>Prognose auf Angebot</dt><dd>{controlling.profitOnQuote === null ? "—" : formatEuro(controlling.profitOnQuote)}</dd></div>
        </dl>
        <ul className="mt-3 text-sm">
          {controlling.wages.map((wage) => (
            <li key={wage.name}>{wage.name}: {formatNumber(wage.hours, 2)} h × {formatEuro(wage.rate)} = {formatEuro(wage.cost)}</li>
          ))}
        </ul>
        <form action={takeSnapshot} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input className={fieldClass} name="label" placeholder="Bezeichnung des Stands" defaultValue="Zwischenstand" />
          <button className={btnGhost}>Stand sichern</button>
          <button className={btnPrimary} name="close" value="1">Projekt abschließen</button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id}>{formatDate(snapshot.takenAt)} · {snapshot.label}: Ergebnis {formatEuro(snapshot.profit)}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
