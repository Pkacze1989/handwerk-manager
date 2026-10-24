"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveDocument, type SaveLine } from "@/actions/documents";
import { DOC_STATUS, DOC_TYPES } from "@/lib/labels";
import { formatEuro } from "@/lib/format";
import { totalsOf } from "@/lib/money";
import { btnGhost, btnPrimary, fieldClass, labelClass } from "./ui";

type Line = SaveLine & { key: string };

type CatalogArticle = { id: string; sku: string; name: string; unit: string; salesPrice: number };
type CatalogService = { id: string; code: string; name: string; unit: string; salesPrice: number };

export function DocumentEditor({
  document,
  customers,
  projects,
  articles,
  services,
}: {
  document: {
    id: string;
    type: string;
    number: string;
    status: string;
    customerId: string;
    projectId: string;
    date: string;
    validUntil: string;
    dueDate: string;
    serviceDate: string;
    intro: string;
    outro: string;
    internalNote: string;
    taxRate: number;
    showPrices: boolean;
    progressPercent: string;
    sourceDocumentId: string;
    lines: Line[];
  };
  customers: { id: string; name: string }[];
  projects: { id: string; title: string; customerId: string }[];
  articles: CatalogArticle[];
  services: CatalogService[];
}) {
  const [lines, setLines] = useState<Line[]>(document.lines);
  const [taxRate, setTaxRate] = useState(document.taxRate);
  const [showPrices, setShowPrices] = useState(document.showPrices);
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState<"artikel" | "leistung" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totals = useMemo(() => totalsOf(lines, taxRate), [lines, taxRate]);
  const filteredArticles = articles.filter((article) => `${article.sku} ${article.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  const filteredServices = services.filter((service) => `${service.code} ${service.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLines((current) => {
      const from = current.findIndex((line) => line.key === active.id);
      const to = current.findIndex((line) => line.key === over.id);
      return arrayMove(current, from, to);
    });
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine(partial: Partial<Line>) {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        kind: "POSITION",
        title: "Neue Position",
        quantity: 1,
        unit: "Stk",
        unitPrice: 0,
        source: "FREE",
        ...partial,
      },
    ]);
    setPicker(null);
    setQuery("");
  }

  async function onSave(form: FormData) {
    setPending(true);
    setError("");
    setNotice("");
    const result = await saveDocument({
      id: document.id,
      customerId: String(form.get("customerId") || ""),
      projectId: String(form.get("projectId") || ""),
      status: String(form.get("status") || document.status),
      date: String(form.get("date") || ""),
      validUntil: String(form.get("validUntil") || ""),
      dueDate: String(form.get("dueDate") || ""),
      serviceDate: String(form.get("serviceDate") || ""),
      intro: String(form.get("intro") || ""),
      outro: String(form.get("outro") || ""),
      internalNote: String(form.get("internalNote") || ""),
      taxRate: Number(form.get("taxRate") || taxRate),
      showPrices: form.get("showPrices") === "1",
      progressPercent: String(form.get("progressPercent") || ""),
      sourceDocumentId: String(form.get("sourceDocumentId") || ""),
      lines,
    });
    setPending(false);
    if (result.error) setError(result.error);
    else setNotice("Gespeichert.");
  }

  return (
    <form action={onSave} className="space-y-6">
      <input type="hidden" name="sourceDocumentId" value={document.sourceDocumentId} />
      <div className="grid gap-4 md:grid-cols-4">
        <label>
          <span className={labelClass}>Art</span>
          <input className={fieldClass} value={DOC_TYPES.find((entry) => entry[0] === document.type)?.[1] ?? document.type} readOnly />
        </label>
        <label>
          <span className={labelClass}>Status</span>
          <select className={fieldClass} name="status" defaultValue={document.status}>
            {DOC_STATUS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Kunde</span>
          <select className={fieldClass} name="customerId" defaultValue={document.customerId}>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Projekt</span>
          <select className={fieldClass} name="projectId" defaultValue={document.projectId}>
            <option value="">Ohne Projekt</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Datum</span>
          <input className={fieldClass} type="date" name="date" defaultValue={document.date} />
        </label>
        <label>
          <span className={labelClass}>Leistung</span>
          <input className={fieldClass} type="date" name="serviceDate" defaultValue={document.serviceDate} />
        </label>
        <label>
          <span className={labelClass}>Gültig bis</span>
          <input className={fieldClass} type="date" name="validUntil" defaultValue={document.validUntil} />
        </label>
        <label>
          <span className={labelClass}>Fällig</span>
          <input className={fieldClass} type="date" name="dueDate" defaultValue={document.dueDate} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className={labelClass}>Einleitung</span>
          <textarea className={fieldClass} name="intro" rows={3} defaultValue={document.intro} />
        </label>
        <label>
          <span className={labelClass}>Schluss</span>
          <textarea className={fieldClass} name="outro" rows={3} defaultValue={document.outro} />
        </label>
      </div>
      <label>
        <span className={labelClass}>Interner Vermerk</span>
        <textarea className={fieldClass} name="internalNote" rows={3} defaultValue={document.internalNote} />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className={labelClass}>USt %</span>
          <input className={fieldClass} name="taxRate" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="showPrices" value="1" checked={showPrices} onChange={(event) => setShowPrices(event.target.checked)} />
          Preise ausweisen
        </label>
        <button type="button" className={btnGhost} onClick={() => setPicker("leistung")}>
          Leistung
        </button>
        <button type="button" className={btnGhost} onClick={() => setPicker("artikel")}>
          Material
        </button>
        <button type="button" className={btnGhost} onClick={() => addLine({ title: "Freie Position" })}>
          Freie Position
        </button>
        <button type="button" className={btnGhost} onClick={() => addLine({ kind: "TEXT", title: "Hinweistext", quantity: 0, unitPrice: 0, unit: "" })}>
          Textposition
        </button>
      </div>

      {picker ? (
        <div className="rounded-3xl border border-line bg-sand p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <input className={fieldClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Katalog durchsuchen" />
            <button type="button" className={btnGhost} onClick={() => setPicker(null)}>
              Schließen
            </button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-auto">
            {(picker === "artikel" ? filteredArticles : filteredServices).map((item) => {
              const article = "sku" in item ? item : null;
              const service = "code" in item ? item : null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm hover:bg-white"
                    onClick={() =>
                      addLine(
                        article
                          ? { title: article.name, unit: article.unit, unitPrice: article.salesPrice, source: "ARTICLE", sourceId: article.id, sku: article.sku }
                          : { title: service!.name, unit: service!.unit, unitPrice: service!.salesPrice, source: "SERVICE", sourceId: service!.id, sku: service!.code },
                      )
                    }
                  >
                    <span>
                      <span className="font-semibold">{article ? article.sku : service?.code}</span> {item.name}
                    </span>
                    <span>{formatEuro(item.salesPrice)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={lines.map((line) => line.key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <SortableLine key={line.key} line={line} index={index} showPrices={showPrices} onChange={update} onRemove={(key) => setLines((current) => current.filter((entry) => entry.key !== key))} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="text-xs text-muted">Positionen per Griff ziehen. Die Reihenfolge wird mit Speichern übernommen.</p>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-spruce-deep px-5 py-4 text-sand">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-sand/60">Summe</p>
          <p className="font-serif text-2xl">{formatEuro(totals.gross)}</p>
          <p className="text-xs text-sand/70">
            Netto {formatEuro(totals.net)} · USt {formatEuro(totals.tax)}
          </p>
        </div>
        <button className={`${btnPrimary} bg-white text-spruce hover:bg-sand`} disabled={pending}>
          {pending ? "Speichert…" : "Speichern"}
        </button>
      </div>
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      {notice ? <p className="text-sm text-spruce">{notice}</p> : null}
    </form>
  );
}

function SortableLine({
  line,
  index,
  showPrices,
  onChange,
  onRemove,
}: {
  line: Line;
  index: number;
  showPrices: boolean;
  onChange: (key: string, patch: Partial<Line>) => void;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.key });
  const total = line.kind === "TEXT" ? 0 : line.quantity * line.unitPrice;
  const cell = "w-full rounded-xl border border-line bg-sand px-3 py-2 text-sm text-ink outline-none focus:border-spruce";
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="rounded-3xl border border-line bg-white p-3">
      <div className="grid grid-cols-2 items-center gap-2 md:grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_4.5rem_6.5rem_7.5rem_auto]">
        <button type="button" className="cursor-grab rounded-xl px-2 py-2 text-left text-muted" aria-label="Position verschieben" {...attributes} {...listeners}>
          {index + 1}
        </button>
        <input className={`${cell} col-span-1 md:col-span-1`} value={line.title} onChange={(event) => onChange(line.key, { title: event.target.value })} />
        {line.kind !== "TEXT" ? (
          <>
            <input className={cell} type="number" step="0.01" aria-label="Menge" value={line.quantity} onChange={(event) => onChange(line.key, { quantity: Number(event.target.value) })} />
            <input className={cell} aria-label="Einheit" value={line.unit} onChange={(event) => onChange(line.key, { unit: event.target.value })} />
            {showPrices ? (
              <input className={cell} type="number" step="0.01" aria-label="Einzelpreis" value={line.unitPrice} onChange={(event) => onChange(line.key, { unitPrice: Number(event.target.value) })} />
            ) : null}
            {showPrices ? <span className="py-2 text-right text-sm font-semibold tabular-nums">{formatEuro(total)}</span> : null}
          </>
        ) : (
          <span className="hidden md:col-span-4 md:block" />
        )}
        <button type="button" className="px-2 py-2 text-right text-xs text-bad" onClick={() => onRemove(line.key)}>
          Entfernen
        </button>
      </div>
      <input
        className={`${cell} mt-2`}
        placeholder="Beschreibung"
        value={line.description ?? ""}
        onChange={(event) => onChange(line.key, { description: event.target.value })}
      />
    </div>
  );
}
