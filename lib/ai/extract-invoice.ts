import { XMLParser } from "fast-xml-parser";
import { parseAmount, round2 } from "../money";
import type { InvoiceExtract } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

function toIso(value: string) {
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return undefined;
}

function grab(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function collect(node: unknown, bag: Record<string, string>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((entry) => collect(entry, bag));
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number") bag[key.toLowerCase()] = String(value);
    else collect(value, bag);
  }
}

export function extractInvoice(content: string, fileName = ""): InvoiceExtract {
  const notes: string[] = [];
  const trimmed = content.trim();
  if (!trimmed) return { notes: ["Datei ohne lesbaren Text. Bitte die Felder von Hand füllen."] };

  if (trimmed.startsWith("<")) {
    try {
      const bag: Record<string, string> = {};
      collect(xmlParser.parse(trimmed), bag);
      const supplierName = bag.lieferant || bag.supplier || bag.seller || bag.name;
      const number = bag.rechnungsnummer || bag.rechnungnr || bag.invoicenumber || bag.id;
      const date = toIso(bag.datum || bag.date || bag.issuedate || "");
      const net = parseAmount(bag.netto || bag.net || bag.taxexclusiveamount || "");
      const tax = parseAmount(bag.mwst || bag.steuer || bag.taxamount || bag.tax || "");
      const gross = parseAmount(bag.brutto || bag.gross || bag.payableamount || "");
      notes.push("XML-Struktur gelesen.");
      return finish({ supplierName, number, date, net, tax, gross, notes });
    } catch {
      notes.push("XML konnte nicht gelesen werden, Textmuster werden versucht.");
    }
  }

  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  if (firstLine.includes(";") && /lieferant|rechnung|netto/i.test(firstLine)) {
    const rows = trimmed.split(/\r?\n/).filter(Boolean);
    const headers = rows[0].split(";").map((cell) => cell.trim().toLowerCase());
    const values = (rows[1] ?? "").split(";").map((cell) => cell.trim());
    const cell = (names: string[]) => {
      const index = headers.findIndex((header) => names.some((name) => header.includes(name)));
      return index >= 0 ? values[index] : undefined;
    };
    notes.push("CSV-Kopfzeile gelesen.");
    return finish({
      supplierName: cell(["lieferant", "supplier"]),
      number: cell(["rechnungsnummer", "rechnung", "nummer"]),
      date: cell(["datum", "date"]) ? toIso(cell(["datum", "date"]) as string) : undefined,
      net: parseAmount(cell(["netto", "net"]) ?? ""),
      tax: parseAmount(cell(["mwst", "steuer", "tax"]) ?? ""),
      gross: parseAmount(cell(["brutto", "gross"]) ?? ""),
      notes,
    });
  }

  const supplierName = grab(trimmed, [/Lieferant\s*:\s*(.+)/i, /Supplier\s*:\s*(.+)/i]);
  const number = grab(trimmed, [
    /Rechnungsnummer\s*:\s*([A-Za-z0-9][A-Za-z0-9\-\/]+)/i,
    /Rechnungs?-?Nr\.?\s*:\s*([A-Za-z0-9][A-Za-z0-9\-\/]+)/i,
    /Belegnummer\s*:\s*([A-Za-z0-9][A-Za-z0-9\-\/]+)/i,
  ]);
  const dateRaw = grab(trimmed, [/Datum\s*:\s*(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/i]);
  const net = parseAmount(grab(trimmed, [/Netto\s*:\s*([0-9.,]+)/i]) ?? "");
  const tax = parseAmount(grab(trimmed, [/(?:MwSt|USt|Steuer)\s*:\s*([0-9.,]+)/i]) ?? "");
  const gross = parseAmount(grab(trimmed, [/Brutto\s*:\s*([0-9.,]+)/i]) ?? "");
  if (fileName) notes.push(`Datei „${fileName}“ als Text ausgewertet.`);
  else notes.push("Freitext mit festen Mustern ausgewertet.");
  return finish({ supplierName, number, date: dateRaw ? toIso(dateRaw) : undefined, net, tax, gross, notes });
}

function finish(input: InvoiceExtract): InvoiceExtract {
  const notes = [...input.notes];
  let { net, tax, gross } = input;
  if ((net === undefined || Number.isNaN(net)) && gross !== undefined && !Number.isNaN(gross)) {
    net = round2(gross / 1.19);
    tax = round2(gross - net);
    notes.push("Netto und Steuer aus dem Brutto mit 19 % angenommen.");
  } else if (net !== undefined && !Number.isNaN(net) && (tax === undefined || Number.isNaN(tax)) && gross !== undefined && !Number.isNaN(gross)) {
    tax = round2(gross - net);
  } else if (net !== undefined && tax !== undefined && (gross === undefined || Number.isNaN(gross)) && !Number.isNaN(net) && !Number.isNaN(tax)) {
    gross = round2(net + tax);
  }
  if (!input.supplierName) notes.push("Lieferant nicht erkannt.");
  if (!input.number) notes.push("Rechnungsnummer nicht erkannt.");
  if (!input.date) notes.push("Datum nicht erkannt.");
  return {
    supplierName: input.supplierName,
    number: input.number,
    date: input.date,
    net: net !== undefined && !Number.isNaN(net) ? net : undefined,
    tax: tax !== undefined && !Number.isNaN(tax) ? tax : undefined,
    gross: gross !== undefined && !Number.isNaN(gross) ? gross : undefined,
    notes,
  };
}
