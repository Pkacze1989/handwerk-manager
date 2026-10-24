import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createDunning,
  createFollowUp,
  deleteDocument,
  deletePayment,
  markDocumentSent,
  markDunningSent,
  pullMeasurements,
  rebuildCumulative,
  rebuildFinal,
  recordPayment,
  saveSignature,
} from "@/actions/documents";
import { DocumentEditor } from "@/components/document-editor";
import { SignaturePad } from "@/components/signature-pad";
import { Badge, Card, Flash, PageHeader, btnGhost, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { dateInputValue, formatDate, formatEuro, one, berlinToday } from "@/lib/format";
import { DOC_TYPES, INVOICE_TYPES, labelOf, statusTone } from "@/lib/labels";
import { round2 } from "@/lib/money";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { position: "asc" } },
      customer: true,
      project: true,
      payments: { orderBy: { date: "asc" } },
      dunnings: { orderBy: { createdAt: "desc" } },
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });
  if (!document) notFound();
  const [customers, projects, articles, services, quotes] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { title: "asc" } }),
    prisma.article.findMany({ orderBy: { name: "asc" } }),
    prisma.serviceItem.findMany({ orderBy: { name: "asc" } }),
    prisma.document.findMany({
      where: { type: "ANGEBOT", ...(document.projectId ? { projectId: document.projectId } : {}) },
      orderBy: { date: "desc" },
    }),
  ]);
  const paid = round2(document.payments.reduce((sum, payment) => sum + payment.amount, 0));
  const open = round2(document.gross - paid);
  const invoice = (INVOICE_TYPES as readonly string[]).includes(document.type);
  const mailto = document.customer.email
    ? `mailto:${document.customer.email}?subject=${encodeURIComponent(document.number)}&body=${encodeURIComponent(`Guten Tag,\n\nanbei ${document.number} über ${formatEuro(document.gross)}.`)}`
    : "";

  return (
    <div>
      <PageHeader
        eyebrow={labelOf(DOC_TYPES, document.type)}
        title={document.number}
        text={document.project ? `${document.project.number} · ${document.project.title}` : document.customer.name}
        actions={
          <>
            <Badge tone={statusTone(document.status)}>{labelOfStatus(document.status)}</Badge>
            <a className={btnGhost} href={`/api/dokumente/${document.id}/pdf`}>
              PDF
            </a>
            <a className={btnGhost} href={`/api/dokumente/${document.id}/gaeb`}>
              GAEB
            </a>
            {invoice ? (
              <>
                <a className={btnGhost} href={`/api/dokumente/${document.id}/xrechnung`}>
                  XRechnung
                </a>
                <a className={btnGhost} href={`/api/dokumente/${document.id}/zugferd`}>
                  ZUGFeRD
                </a>
              </>
            ) : null}
          </>
        }
      />
      <Flash hinweis={one(query.hinweis)} fehler={one(query.fehler)} />
      <div className="mb-6 flex flex-wrap gap-2">
        <form action={markDocumentSent}>
          <input type="hidden" name="id" value={document.id} />
          <button className={btnGhost}>Als versendet markieren</button>
        </form>
        {mailto ? (
          <a className={btnGhost} href={mailto}>
            E-Mail vorbereiten
          </a>
        ) : null}
        <form action={createFollowUp} className="flex gap-2">
          <input type="hidden" name="id" value={document.id} />
          <select className={fieldClass} name="type" defaultValue="AUFTRAGSBESTAETIGUNG">
            {DOC_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className={btnGhost}>Folgebeleg</button>
        </form>
        <form action={pullMeasurements}>
          <input type="hidden" name="id" value={document.id} />
          <button className={btnGhost}>Mengen aus Aufmaß</button>
        </form>
        <form action={deleteDocument}>
          <input type="hidden" name="id" value={document.id} />
          <button className="text-sm font-semibold text-bad">Löschen</button>
        </form>
      </div>

      {(document.type === "ABSCHLAG_KUMULATIV" || document.type === "SCHLUSSRECHNUNG") && (
        <Card className="mb-6">
          <h2 className="font-serif text-2xl">Aus Angebot rechnen</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <form action={rebuildCumulative} className="space-y-3">
              <input type="hidden" name="id" value={document.id} />
              <p className="text-sm text-muted">Kumulativer Abschlag: Prozentsatz der Angebotssumme abzüglich bisheriger Abschläge.</p>
              <select className={fieldClass} name="sourceDocumentId" defaultValue={document.sourceDocumentId ?? ""}>
                {quotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.number} · {formatEuro(quote.net)} netto
                  </option>
                ))}
              </select>
              <input className={fieldClass} name="progressPercent" type="number" step="0.1" defaultValue={document.progressPercent ?? 30} />
              <button className={btnPrimary}>Kumulativ neu setzen</button>
            </form>
            <form action={rebuildFinal} className="space-y-3">
              <input type="hidden" name="id" value={document.id} />
              <p className="text-sm text-muted">Schlussrechnung: Angebotssumme abzüglich aller Abschläge des Projekts.</p>
              <select className={fieldClass} name="sourceDocumentId" defaultValue={document.sourceDocumentId ?? ""}>
                {quotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.number}
                  </option>
                ))}
              </select>
              <button className={btnGhost}>Schlussrechnung setzen</button>
            </form>
          </div>
        </Card>
      )}

      <Card>
        <DocumentEditor
          document={{
            id: document.id,
            type: document.type,
            number: document.number,
            status: document.status,
            customerId: document.customerId,
            projectId: document.projectId ?? "",
            date: dateInputValue(document.date),
            validUntil: dateInputValue(document.validUntil),
            dueDate: dateInputValue(document.dueDate),
            serviceDate: dateInputValue(document.serviceDate),
            intro: document.intro ?? "",
            outro: document.outro ?? "",
            internalNote: document.internalNote ?? "",
            taxRate: document.taxRate,
            showPrices: document.showPrices,
            progressPercent: document.progressPercent?.toString() ?? "",
            sourceDocumentId: document.sourceDocumentId ?? "",
            lines: document.lines.map((line) => ({
              key: line.id,
              kind: line.kind,
              source: line.source,
              sourceId: line.sourceId,
              sku: line.sku,
              title: line.title,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
            })),
          }}
          customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
          projects={projects.map((project) => ({ id: project.id, title: `${project.number} ${project.title}`, customerId: project.customerId }))}
          articles={articles.map((article) => ({ id: article.id, sku: article.sku, name: article.name, unit: article.unit, salesPrice: article.salesPrice }))}
          services={services.map((service) => ({ id: service.id, code: service.code, name: service.name, unit: service.unit, salesPrice: service.salesPrice }))}
        />
      </Card>

      {invoice ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-serif text-2xl">Zahlungen</h2>
            <p className="mt-1 text-sm text-muted">
              Gezahlt {formatEuro(paid)} · offen {formatEuro(open)}
            </p>
            <ul className="mt-3 space-y-2">
              {document.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between text-sm">
                  <span>
                    {formatDate(payment.date)} · {payment.method} · {formatEuro(payment.amount)}
                  </span>
                  <form action={deletePayment}>
                    <input type="hidden" name="id" value={payment.id} />
                    <input type="hidden" name="back" value={`/buero/${document.id}`} />
                    <button className="text-xs text-bad">Löschen</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={recordPayment} className="mt-4 grid gap-2">
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="back" value={`/buero/${document.id}`} />
              <input className={fieldClass} type="date" name="date" defaultValue={berlinToday()} />
              <input className={fieldClass} name="amount" placeholder="Betrag" required />
              <select className={fieldClass} name="method" defaultValue="UEBERWEISUNG">
                <option value="UEBERWEISUNG">Überweisung</option>
                <option value="BAR">Bar</option>
                <option value="KARTE">Karte</option>
              </select>
              <input className={fieldClass} name="note" placeholder="Notiz" />
              <button className={btnPrimary}>Zahlung buchen</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-serif text-2xl">Mahnwesen</h2>
            <form action={createDunning} className="mt-4 grid gap-2">
              <input type="hidden" name="documentId" value={document.id} />
              <select className={fieldClass} name="level" defaultValue="ERINNERUNG">
                <option value="ERINNERUNG">Zahlungserinnerung</option>
                <option value="MAHNUNG">Mahnung</option>
              </select>
              <input className={fieldClass} name="fee" placeholder="Mahngebühr, optional" />
              <button className={btnGhost}>Schreiben erzeugen</button>
            </form>
            <ul className="mt-4 space-y-3">
              {document.dunnings.map((dunning) => (
                <li key={dunning.id} className="rounded-2xl bg-sand p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <strong>{dunning.level === "MAHNUNG" ? "Mahnung" : "Zahlungserinnerung"}</strong>
                    <Badge tone={dunning.status === "VERSENDET" ? "good" : "neutral"}>{dunning.status === "VERSENDET" ? "Versendet" : "Entwurf"}</Badge>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted">{dunning.text}</pre>
                  {dunning.status !== "VERSENDET" ? (
                    <form action={markDunningSent} className="mt-2">
                      <input type="hidden" name="id" value={dunning.id} />
                      <button className={btnGhost}>Als versendet markieren</button>
                    </form>
                  ) : null}
                  {mailto ? (
                    <a className="mt-2 inline-block text-xs font-semibold text-spruce" href={`mailto:${document.customer.email}?subject=${encodeURIComponent(dunning.level)}&body=${encodeURIComponent(dunning.text)}`}>
                      Im Mailprogramm öffnen
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <Card className="mt-6">
        <h2 className="font-serif text-2xl">Digitale Unterschrift</h2>
        <p className="mt-1 text-sm text-muted">Für Abnahme, Regiebericht und Stundennachweis, auch auf anderen Belegen sichtbar.</p>
        <ul className="mt-3 space-y-2">
          {document.signatures.map((signature) => (
            <li key={signature.id} className="text-sm">
              {signature.signerName}
              {signature.role ? `, ${signature.role}` : ""} · {formatDate(signature.signedAt)}
              <img src={signature.dataUrl} alt="" className="mt-1 h-16" />
            </li>
          ))}
        </ul>
        <form action={saveSignature} className="mt-4 grid gap-3">
          <input type="hidden" name="documentId" value={document.id} />
          <input type="hidden" name="back" value={`/buero/${document.id}`} />
          <label>
            <span className={labelClass}>Name</span>
            <input className={fieldClass} name="signerName" required />
          </label>
          <label>
            <span className={labelClass}>Rolle</span>
            <input className={fieldClass} name="role" />
          </label>
          <SignaturePad />
          <button className={btnPrimary}>Unterschrift speichern</button>
        </form>
      </Card>
      {document.project ? (
        <p className="mt-6 text-sm">
          <Link href={`/projekte/${document.projectId}`} className="font-semibold text-spruce">
            Zur Bauakte
          </Link>
        </p>
      ) : null}
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
