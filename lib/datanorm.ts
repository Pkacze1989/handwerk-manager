import { parseAmount } from "./money";

export type DatanormArticle = {
  action: "N" | "A" | "L";
  sku: string;
  name: string;
  unit: string;
  purchasePrice: number;
  salesPrice: number;
  vatRate: number;
};

export type DatanormFile = {
  supplierName?: string;
  currency?: string;
  date?: string;
  articles: DatanormArticle[];
};

const UNITS: Record<string, string> = {
  M: "m",
  M2: "m²",
  M3: "m³",
  ST: "Stk",
  STK: "Stk",
  PCE: "Stk",
  PAA: "psch",
  SA: "psch",
  KG: "kg",
  H: "h",
  STD: "h",
};

export function mapDatanormUnit(unit: string) {
  const key = unit.trim().toUpperCase();
  return UNITS[key] ?? (unit.trim() || "Stk");
}

export function parseDatanorm(content: string): DatanormFile {
  const result: DatanormFile = { articles: [] };
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const fields = line.split(";").map((field) => field.trim());
    const kind = fields[0]?.toUpperCase();
    if (kind === "V") {
      result.supplierName = fields[3] || undefined;
      result.currency = fields[4] || "EUR";
      result.date = fields[5] || undefined;
      continue;
    }
    if (kind !== "A") continue;
    const action = (fields[1] || "N").toUpperCase();
    if (action !== "N" && action !== "A" && action !== "L") {
      throw new Error(`Unbekanntes DATANORM-Kennzeichen „${fields[1]}“. Erlaubt sind N, A und L.`);
    }
    const sku = fields[2];
    if (!sku) throw new Error("Artikel ohne Artikelnummer in der DATANORM-Datei.");
    const purchase = parseAmount(fields[5] || "0");
    const sales = parseAmount(fields[6] || fields[5] || "0");
    const vat = parseAmount(fields[7] || "19");
    result.articles.push({
      action,
      sku,
      name: fields[3] || sku,
      unit: mapDatanormUnit(fields[4] || "ST"),
      purchasePrice: Number.isFinite(purchase) ? purchase : 0,
      salesPrice: Number.isFinite(sales) ? sales : 0,
      vatRate: Number.isFinite(vat) ? vat : 19,
    });
  }
  if (result.articles.length === 0) throw new Error("Die Datei enthält keine A-Sätze der unterstützten Teilmenge.");
  return result;
}

export function exportDatanorm(supplierName: string, articles: DatanormArticle[]) {
  const today = new Date();
  const stamp = [today.getDate(), today.getMonth() + 1, today.getFullYear()]
    .map((part, index) => String(part).padStart(index === 2 ? 4 : 2, "0"))
    .join("");
  const lines = [
    "# Werkplan DATANORM-Auszug (Teilmenge V/A)",
    `V;050;A;${supplierName};EUR;${stamp}`,
    ...articles.map((article) => {
      const unit =
        Object.entries(UNITS).find(([, mapped]) => mapped === article.unit)?.[0] ?? article.unit.toUpperCase();
      const money = (value: number) => value.toFixed(2).replace(".", ",");
      return `A;${article.action};${article.sku};${article.name};${unit};${money(article.purchasePrice)};${money(article.salesPrice)};${article.vatRate}`;
    }),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
