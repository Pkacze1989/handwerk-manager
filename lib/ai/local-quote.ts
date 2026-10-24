import type { QuoteDraft, QuoteDraftLine } from "./types";

type CatalogItem = {
  id: string;
  kind: "ARTICLE" | "SERVICE";
  code: string;
  name: string;
  unit: string;
  salesPrice: number;
  terms: string[];
};

export function fold(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll("²", "2")
    .replaceAll("³", "3");
}

const UNIT_WORDS: Record<string, string> = {
  meter: "m",
  m: "m",
  m2: "m²",
  qm: "m²",
  m3: "m³",
  stk: "Stk",
  st: "Stk",
  stueck: "Stk",
  psch: "psch",
  pauschal: "psch",
  std: "h",
  h: "h",
  kg: "kg",
};

function extractQty(window: string) {
  const matches = [...window.matchAll(/(\d+(?:[.,]\d+)?)(?!\s*x\d)(?:\s+(m2|qm|m3|meter|m|stk|stueck|st|psch|pauschal|std|h|kg)\b)?/gi)];
  if (matches.length === 0) return { quantity: 1, unit: undefined as string | undefined };
  const last = matches[matches.length - 1];
  const quantity = Number(last[1].replace(",", "."));
  const unit = last[2] ? UNIT_WORDS[fold(last[2])] : undefined;
  return { quantity: Number.isFinite(quantity) ? quantity : 1, unit };
}

export function draftQuoteLocal(input: {
  text: string;
  fileName?: string;
  articles: { id: string; sku: string; name: string; unit: string; salesPrice: number; matchTerms?: string | null }[];
  services: { id: string; code: string; name: string; unit: string; salesPrice: number; matchTerms?: string | null }[];
  customers: { id: string; name: string }[];
}): QuoteDraft {
  const notes: string[] = [];
  const source = [input.text?.trim(), input.fileName ? `Datei: ${input.fileName}` : ""].filter(Boolean).join("\n");
  const folded = fold(source);
  if (!folded) {
    return {
      title: "Angebot aus Anfrage",
      lines: [],
      notes: ["Kein Text erkannt. Bitte die Anfrage ergänzen oder die Positionen von Hand setzen."],
      engine: "local",
    };
  }

  const catalog: CatalogItem[] = [
    ...input.services.map((service) => ({
      id: service.id,
      kind: "SERVICE" as const,
      code: service.code,
      name: service.name,
      unit: service.unit,
      salesPrice: service.salesPrice,
      terms: [service.name, ...(service.matchTerms ?? "").split(",")].map((term) => fold(term.trim())).filter((term) => term.length >= 3),
    })),
    ...input.articles.map((article) => ({
      id: article.id,
      kind: "ARTICLE" as const,
      code: article.sku,
      name: article.name,
      unit: article.unit,
      salesPrice: article.salesPrice,
      terms: [article.name, ...(article.matchTerms ?? "").split(",")].map((term) => fold(term.trim())).filter((term) => term.length >= 3),
    })),
  ];

  type Hit = { item: CatalogItem; term: string; index: number };
  const hits: Hit[] = [];
  for (const item of catalog) {
    for (const term of item.terms) {
      let from = 0;
      while (from < folded.length) {
        const index = folded.indexOf(term, from);
        if (index < 0) break;
        hits.push({ item, term, index });
        from = index + term.length;
      }
    }
  }
  hits.sort((a, b) => b.term.length - a.term.length || a.index - b.index);

  const occupied: [number, number][] = [];
  const chosen: Hit[] = [];
  for (const hit of hits) {
    const start = hit.index;
    const end = hit.index + hit.term.length;
    if (occupied.some(([from, to]) => start < to && end > from)) continue;
    if (chosen.some((existing) => existing.item.id === hit.item.id)) continue;
    const window = folded.slice(Math.max(0, start - 60), start);
    const materialish = /nym|kabel|led|panel|kanal|schuko/.test(window + hit.term);
    if (!materialish && hit.item.kind === "ARTICLE") {
      const service = chosen.find((existing) => existing.item.kind === "SERVICE" && existing.term === hit.term);
      if (service) continue;
    }
    occupied.push([start, end]);
    chosen.push(hit);
  }
  chosen.sort((a, b) => a.index - b.index);

  const lines: QuoteDraftLine[] = chosen.map((hit) => {
    const window = folded.slice(Math.max(0, hit.index - 60), hit.index);
    const qty = extractQty(window);
    const sentence = source.split(/\n/).find((row) => fold(row).includes(hit.term)) ?? "";
    notes.push(`${hit.item.name}: ${hit.item.kind === "SERVICE" ? "Leistung" : "Material"} ${hit.item.code}, Menge ${qty.quantity}.`);
    return {
      title: hit.item.name,
      description: sentence.replace(/^\s*-\s*/, "").trim() || undefined,
      quantity: qty.quantity,
      unit: hit.item.unit || qty.unit || "Stk",
      unitPrice: hit.item.salesPrice,
      source: hit.item.kind,
      sourceId: hit.item.id,
      sku: hit.item.code,
    };
  });

  if (lines.length === 0) {
    notes.push("Kein Stammdatentreffer. Es wurde eine freie Pauschalposition angelegt.");
    lines.push({
      title: "Pauschale laut Anfrage",
      description: source.slice(0, 240),
      quantity: 1,
      unit: "psch",
      unitPrice: 0,
      source: "FREE",
    });
  }

  const customer = input.customers.find((entry) => {
    const name = fold(entry.name);
    if (name.length >= 4 && folded.includes(name)) return true;
    const token = name.split(" ").filter((part) => part.length >= 5).pop();
    return Boolean(token && folded.includes(token));
  });

  let urgency: QuoteDraft["urgency"];
  if (/notdienst|brandgeruch|schmort|sofort/.test(folded)) urgency = "NOTDIENST";
  else if (/dringend|eilig|heute/.test(folded)) urgency = "HOCH";

  if (input.fileName && !input.text?.trim()) {
    notes.unshift("Es lag nur eine Datei vor. Ausgewertet wurde der Dateiname, nicht der Bildinhalt.");
  }
  notes.unshift("Lokale Vorlagen-Engine, ohne externes Sprachmodell.");

  return {
    title: customer ? `Angebot ${customer.name}` : "Angebot aus Anfrage",
    customerId: customer?.id,
    customerName: customer?.name,
    urgency,
    lines,
    notes,
    engine: "local",
  };
}
