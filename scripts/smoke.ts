import { readFile } from "fs/promises";
import path from "path";
import zlib from "zlib";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/db";
import { evaluateExpression } from "../lib/expr";
import { exportGaeb, parseGaeb } from "../lib/gaeb";
import { parseDatanorm } from "../lib/datanorm";
import { extractInvoice } from "../lib/ai/extract-invoice";
import { draftQuoteLocal } from "../lib/ai/local-quote";
import { buildXRechnungUbl } from "../lib/einvoice";
import { invoiceXmlFromBundle, loadDocument } from "../lib/document-model";
import { renderDocumentPdf } from "../lib/pdf";
import { buildExtfBookings } from "../lib/datev";
import { lineNet, totalsOf } from "../lib/money";
import { nextDocumentNumber } from "../lib/numbers";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const area = evaluateExpression("(l + 0.2) * b * 2", { l: 5, b: 3 });
  assert(Math.abs(area - 31.2) < 1e-9, `Formel Fläche ergab ${area}`);
  let rejected = false;
  try {
    evaluateExpression("alert(1)", {});
  } catch {
    rejected = true;
  }
  assert(rejected, "Formel darf kein JavaScript ausführen");

  const gaebXml = await readFile(path.join(process.cwd(), "samples/gaeb/lv-tiefgarage.x83"), "utf8");
  const gaeb = parseGaeb(gaebXml);
  assert(gaeb.items.length === 4, `GAEB erwartet 4 Positionen, hat ${gaeb.items.length}`);
  assert(gaeb.items[0].rno === "01.0010", `OZ ${gaeb.items[0].rno}`);
  assert(gaeb.items[0].quantity === 24, "Menge");
  assert(gaeb.items[0].unitPrice === 86, "Preis");
  const roundTrip = parseGaeb(exportGaeb(gaeb));
  assert(roundTrip.items.length === gaeb.items.length, "GAEB-Rundlauf Anzahl");
  roundTrip.items.forEach((item, index) => {
    assert(item.rno === gaeb.items[index].rno, `Rundlauf OZ ${item.rno}`);
    assert(item.quantity === gaeb.items[index].quantity, "Rundlauf Menge");
    assert(item.unit === gaeb.items[index].unit, "Rundlauf Einheit");
    assert(item.unitPrice === gaeb.items[index].unitPrice, "Rundlauf Preis");
    assert(item.title === gaeb.items[index].title, "Rundlauf Titel");
  });

  const datanorm = parseDatanorm(await readFile(path.join(process.cwd(), "samples/datanorm/elektro-nord.datanorm"), "utf8"));
  assert(datanorm.articles.length === 4, "DATANORM Sätze");
  assert(datanorm.articles.find((article) => article.sku === "100234")?.salesPrice === 1.49, "DATANORM Preis");
  assert(datanorm.supplierName?.includes("Nord"), "DATANORM Lieferant");

  const invoice = extractInvoice(await readFile(path.join(process.cwd(), "samples/eingang/rechnung-nord.txt"), "utf8"));
  assert(invoice.gross === 1761.8 && invoice.number === "ER-2026-1182", "Textrechnung");
  const csv = extractInvoice(await readFile(path.join(process.cwd(), "samples/eingang/rechnung-nord.csv"), "utf8"));
  assert(csv.gross === 761.6 && csv.supplierName?.includes("Elbsand"), "CSV-Rechnung");
  const xmlInvoice = extractInvoice(await readFile(path.join(process.cwd(), "samples/eingang/rechnung-nord.xml"), "utf8"));
  assert(xmlInvoice.number === "LP-2026-077" && xmlInvoice.net === 860, "XML-Rechnung");

  const [articles, services, customers] = await Promise.all([
    prisma.article.findMany(),
    prisma.serviceItem.findMany(),
    prisma.customer.findMany(),
  ]);
  assert(articles.length > 0, "Seed-Artikel fehlen");
  const draft = draftQuoteLocal({
    text: await readFile(path.join(process.cwd(), "samples/ki/anfrage-richter.txt"), "utf8"),
    articles,
    services,
    customers,
  });
  const titles = draft.lines.map((line) => line.title).join(" | ");
  assert(draft.lines.some((line) => line.sku === "L-100" && line.quantity === 12), `Steckdosen fehlen in: ${titles}`);
  assert(draft.lines.some((line) => line.sku === "100234" && line.quantity === 25), `NYM fehlt in: ${titles}`);
  assert(draft.lines.some((line) => line.sku === "L-400"), "Herdanschluss fehlt");
  assert(draft.customerName?.includes("Richter"), "Kunde nicht erkannt");

  const quote = await prisma.document.findFirst({ where: { type: "ANGEBOT", status: "ANGENOMMEN" }, include: { lines: true } });
  assert(quote, "Angenommenes Angebot fehlt");
  const bundle = await loadDocument(quote.id);
  const pdf = await renderDocumentPdf(bundle);
  assert(Buffer.from(pdf).subarray(0, 4).toString() === "%PDF", "PDF-Kopf");
  const xrechnung = buildXRechnungUbl(invoiceXmlFromBundle(bundle));
  assert(xrechnung.includes("urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"), "XRechnung-Customization");
  assert(xrechnung.includes(quote.number), "XRechnung-Nummer");
  const zugferd = await renderDocumentPdf(bundle, { zugferd: true });
  const attached = await PDFDocument.load(zugferd);
  const attachmentText = attached.context
    .enumerateIndirectObjects()
    .map(([, object]) => {
      const printed = object.toString();
      const stream = object as { getContents?: () => Uint8Array };
      if (typeof stream.getContents !== "function") return printed;
      const bytes = Buffer.from(stream.getContents());
      try {
        return `${printed}\n${zlib.inflateSync(bytes).toString("utf8")}`;
      } catch {
        return `${printed}\n${bytes.toString("utf8")}`;
      }
    })
    .join("\n");
  assert(attachmentText.includes("factur-x.xml"), "ZUGFeRD-Dateiname");
  assert(attachmentText.includes("Alternative"), "ZUGFeRD-Beziehung");
  assert(attachmentText.includes("CrossIndustryInvoice"), "ZUGFeRD-XML");

  const extf = buildExtfBookings({
    bookings: [{ amount: 119, debitCredit: "S", account: "10001", contraAccount: "8400", date: new Date("2026-10-01T00:00:00Z"), documentNumber: "RE-1", text: "Test" }],
    from: new Date("2026-01-01T00:00:00Z"),
    to: new Date("2026-12-31T00:00:00Z"),
    consultant: "29045",
    client: "10001",
    accountLength: 4,
    exportedBy: "Lena Hoffmann",
    label: "Test",
  });
  assert(extf.startsWith('"EXTF";700;21;"Buchungsstapel";9;'), "EXTF-Kopf");
  assert(extf.includes("119,00"), "EXTF-Betrag");

  const customer = customers[0];
  const created = await prisma.document.create({
    data: {
      type: "ANGEBOT",
      number: await nextDocumentNumber("ANGEBOT"),
      status: "ENTWURF",
      customerId: customer.id,
      date: new Date(),
      taxRate: 19,
      ...totalsOf([{ kind: "POSITION", quantity: 2, unitPrice: 10 }], 19),
      lines: { create: [{ position: 0, kind: "POSITION", title: "Smoke", quantity: 2, unit: "Stk", unitPrice: 10, lineTotal: lineNet(2, 10), source: "FREE" }] },
    },
  });
  const user = await prisma.user.findFirst({ where: { role: "MONTEUR" } });
  const project = await prisma.project.findFirst();
  assert(user && project, "Seed unvollständig");
  const time = await prisma.timeEntry.create({ data: { userId: user.id, projectId: project.id, type: "ARBEIT", start: new Date(), end: new Date() } });
  const resource = await prisma.resource.findFirst({ where: { type: "KOLONNE" } });
  assert(resource, "Kolonne fehlt");
  const assignment = await prisma.assignment.create({
    data: { resourceId: resource.id, projectId: project.id, startDate: new Date(), endDate: new Date(), note: "Smoke" },
  });
  await prisma.assignment.delete({ where: { id: assignment.id } });
  await prisma.timeEntry.delete({ where: { id: time.id } });
  await prisma.document.delete({ where: { id: created.id } });

  const article = await prisma.article.findUnique({ where: { sku: "100234" } });
  assert(article, "Artikel 100234 fehlt");
  const previous = article.salesPrice;
  await prisma.article.update({ where: { id: article.id }, data: { salesPrice: 1.49, purchasePrice: 0.81 } });
  const updated = await prisma.article.findUnique({ where: { sku: "100234" } });
  assert(updated?.salesPrice === 1.49, "DATANORM-Preisupdate");
  await prisma.article.update({ where: { id: article.id }, data: { salesPrice: previous, purchasePrice: article.purchasePrice } });

  console.log("Smoke-Test in Ordnung.");
  console.log(`Angebot ${quote.number}, GAEB ${gaeb.items.length} Positionen, Entwurf ${draft.lines.length} Zeilen, PDF ${pdf.length} Bytes.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
