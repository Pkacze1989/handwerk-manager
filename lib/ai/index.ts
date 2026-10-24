import { draftQuoteLocal } from "./local-quote";
import type { QuoteDraft } from "./types";

type Catalog = Parameters<typeof draftQuoteLocal>[0];

export async function createQuoteDraft(input: Catalog): Promise<QuoteDraft> {
  const base = process.env.WERKPLAN_LLM_BASE_URL;
  const key = process.env.WERKPLAN_LLM_API_KEY;
  if (base && key) {
    try {
      return await remoteDraft(input, base, key);
    } catch (error) {
      const local = draftQuoteLocal(input);
      local.notes.unshift(
        `Externes Modell nicht verwendet (${error instanceof Error ? error.message : "Fehler"}). Lokaler Entwurf.`,
      );
      return local;
    }
  }
  return draftQuoteLocal(input);
}

async function remoteDraft(input: Catalog, base: string, key: string): Promise<QuoteDraft> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const catalog = [
      ...input.services.map((service) => ({ id: service.id, kind: "SERVICE", name: service.name, unit: service.unit, price: service.salesPrice })),
      ...input.articles.map((article) => ({ id: article.id, kind: "ARTICLE", name: article.name, unit: article.unit, price: article.salesPrice })),
    ];
    const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.WERKPLAN_LLM_MODEL || "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Du erzeugst Angebotsentwürfe für einen Elektrobetrieb. Antworte nur mit JSON: {title, customerName, lines:[{title,quantity,unit,sourceId,source}]}. Nutze sourceId aus dem Katalog, wenn eine Position passt.",
          },
          { role: "user", content: `Katalog:\n${JSON.stringify(catalog)}\n\nAnfrage:\n${input.text}` },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Modell antwortet mit Status ${response.status}`);
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error("Modell lieferte kein JSON");
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
      title?: string;
      customerName?: string;
      lines?: { title?: string; quantity?: number; unit?: string; sourceId?: string; source?: string }[];
    };
    const local = draftQuoteLocal(input);
    const lines = (parsed.lines ?? []).map((line) => {
      const known =
        input.services.find((service) => service.id === line.sourceId) ||
        input.articles.find((article) => article.id === line.sourceId);
      const kind = known && "sku" in known ? "ARTICLE" : known ? "SERVICE" : line.source === "ARTICLE" ? "ARTICLE" : line.source === "SERVICE" ? "SERVICE" : "FREE";
      return {
        title: known?.name || line.title || "Position",
        quantity: Number(line.quantity) || 1,
        unit: known?.unit || line.unit || "Stk",
        unitPrice: known?.salesPrice ?? 0,
        source: kind as "ARTICLE" | "SERVICE" | "FREE",
        sourceId: known?.id,
        sku: known && "sku" in known ? known.sku : known && "code" in known ? known.code : undefined,
      };
    });
    return {
      title: parsed.title || local.title,
      customerName: parsed.customerName || local.customerName,
      customerId: local.customerId,
      lines: lines.length ? lines : local.lines,
      notes: ["Entwurf über den konfigurierten Modell-Endpunkt, Preise aus den Stammdaten."],
      engine: "llm",
      urgency: local.urgency,
    };
  } finally {
    clearTimeout(timer);
  }
}

export { extractInvoice } from "./extract-invoice";
export type { QuoteDraft, InvoiceExtract } from "./types";
