import { readFile } from "fs/promises";
import path from "path";
import { AFRelationship, PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import fontkit from "./fontkit";
import { formatDate, formatEuro, formatNumber } from "./format";
import { labelOf, DOC_TYPES, isInvoice } from "./labels";
import { invoiceXmlFromBundle, type loadDocument } from "./document-model";
import { buildZugferdCii } from "./einvoice";
import { round2 } from "./money";

type Bundle = Awaited<ReturnType<typeof loadDocument>>;

const spruce = rgb(30 / 255, 70 / 255, 56 / 255);
const copper = rgb(164 / 255, 91 / 255, 56 / 255);
const ink = rgb(28 / 255, 36 / 255, 33 / 255);
const muted = rgb(92 / 255, 103 / 255, 95 / 255);
const line = rgb(228 / 255, 221 / 255, 210 / 255);
const paper = rgb(251 / 255, 249 / 255, 245 / 255);

export async function renderDocumentPdf(bundle: Bundle, options?: { zugferd?: boolean }) {
  const { document, company } = bundle;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit as unknown as Parameters<PDFDocument["registerFontkit"]>[0]);
  const regular = await pdf.embedFont(await readFile(path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf")));
  const bold = await pdf.embedFont(await readFile(path.join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf")));
  const serif = await pdf.embedFont(await readFile(path.join(process.cwd(), "assets/fonts/NotoSerif-Regular.ttf")));

  const pageSize: [number, number] = [595.28, 841.89];
  const pages: PDFPage[] = [];
  let page = pdf.addPage(pageSize);
  pages.push(page);
  let y = 800;

  const margin = 46;
  const width = pageSize[0] - margin * 2;

  function newPage() {
    page = pdf.addPage(pageSize);
    pages.push(page);
    y = 800;
    drawHeader(true);
  }

  function ensure(height: number) {
    if (y - height < 58) newPage();
  }

  function drawHeader(compact = false) {
    page.drawRectangle({ x: 0, y: 812, width: pageSize[0], height: 8, color: spruce });
    page.drawText("WERKPLAN", { x: margin, y: y, size: 9, font: bold, color: spruce });
    const companyLine = company.name;
    const companyWidth = regular.widthOfTextAtSize(companyLine, 9);
    page.drawText(companyLine, { x: pageSize[0] - margin - companyWidth, y, size: 9, font: regular, color: muted });
    y -= compact ? 22 : 28;
    if (!compact) {
      page.drawText(labelOf(DOC_TYPES, document.type), { x: margin, y, size: 22, font: serif, color: ink });
      y -= 22;
      page.drawText(document.number, { x: margin, y, size: 12, font: bold, color: copper });
      y -= 18;
    }
  }

  function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }

  function paragraph(text: string, size = 10, color = ink) {
    for (const block of text.split(/\n/)) {
      const lines = wrap(block || " ", regular, size, width);
      for (const row of lines) {
        ensure(14);
        page.drawText(row, { x: margin, y, size, font: regular, color });
        y -= 13;
      }
    }
  }

  drawHeader();
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 0.6, color: line });
  y -= 22;

  const left = [
    document.customer.name,
    document.customer.contact ? document.customer.contact : "",
    document.customer.street || "",
    [document.customer.zip, document.customer.city].filter(Boolean).join(" "),
  ].filter(Boolean);
  const right = [
    `Datum: ${formatDate(document.date)}`,
    document.serviceDate ? `Leistung: ${formatDate(document.serviceDate)}` : "",
    document.validUntil ? `Gültig bis: ${formatDate(document.validUntil)}` : "",
    document.dueDate ? `Fällig: ${formatDate(document.dueDate)}` : "",
    document.project ? `Projekt: ${document.project.number}` : "",
    `Kunde: ${document.customer.number}`,
  ].filter(Boolean);

  const blockTop = y;
  left.forEach((row, index) => {
    page.drawText(row, { x: margin, y: blockTop - index * 13, size: 10, font: index === 0 ? bold : regular, color: ink });
  });
  right.forEach((row, index) => {
    page.drawText(row, { x: 340, y: blockTop - index * 13, size: 10, font: regular, color: ink });
  });
  y = blockTop - Math.max(left.length, right.length) * 13 - 16;

  if (document.project) {
    paragraph(document.project.title, 11);
    const place = [document.project.street, [document.project.zip, document.project.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    if (place) paragraph(place, 9, muted);
    y -= 6;
  }
  if (document.intro) {
    paragraph(document.intro, 10);
    y -= 8;
  }
  if (document.progressPercent) {
    paragraph(`Kumulierter Leistungsstand: ${formatNumber(document.progressPercent, 0)} %`, 10);
    y -= 6;
  }

  const showPrices = document.showPrices;
  const columns = showPrices
    ? [
        { label: "Pos", x: margin, w: 28 },
        { label: "Beschreibung", x: margin + 28, w: 250 },
        { label: "Menge", x: 340, w: 55 },
        { label: "ME", x: 400, w: 36 },
        { label: "EP", x: 440, w: 55 },
        { label: "GP", x: 498, w: 52 },
      ]
    : [
        { label: "Pos", x: margin, w: 28 },
        { label: "Beschreibung", x: margin + 28, w: 330 },
        { label: "Menge", x: 430, w: 60 },
        { label: "ME", x: 500, w: 50 },
      ];

  function tableHead() {
    ensure(22);
    page.drawRectangle({ x: margin, y: y - 6, width, height: 18, color: paper });
    for (const column of columns) {
      page.drawText(column.label, { x: column.x, y, size: 8, font: bold, color: spruce });
    }
    y -= 20;
  }

  tableHead();
  document.lines.forEach((entry, index) => {
    const descWidth = showPrices ? 240 : 320;
    const titleLines = wrap(entry.title, entry.kind === "TEXT" ? regular : bold, 9, descWidth);
    const detailLines = entry.description ? wrap(entry.description, regular, 8, descWidth) : [];
    const height = titleLines.length * 12 + detailLines.length * 11 + 8;
    if (y - height < 58) {
      newPage();
      tableHead();
    }
    titleLines.forEach((row, rowIndex) => {
      if (rowIndex === 0 && entry.kind !== "TEXT") {
        page.drawText(String(index + 1), { x: margin, y, size: 9, font: regular, color: muted });
      }
      page.drawText(row, {
        x: margin + 28,
        y,
        size: 9,
        font: entry.kind === "TEXT" ? regular : bold,
        color: ink,
      });
      y -= 12;
    });
    detailLines.forEach((row) => {
      page.drawText(row, { x: margin + 28, y, size: 8, font: regular, color: muted });
      y -= 11;
    });
    const rowY = y + 12 + (titleLines.length - 1) * 12 + detailLines.length * 11;
    if (entry.kind !== "TEXT") {
      const qty = formatNumber(entry.quantity, 2);
      page.drawText(qty, { x: showPrices ? 340 : 430, y: rowY, size: 9, font: regular, color: ink });
      page.drawText(entry.unit, { x: showPrices ? 400 : 500, y: rowY, size: 9, font: regular, color: ink });
      if (showPrices) {
        page.drawText(formatEuro(entry.unitPrice), { x: 430, y: rowY, size: 9, font: regular, color: ink });
        page.drawText(formatEuro(entry.lineTotal), { x: 488, y: rowY, size: 9, font: bold, color: ink });
      }
    }
    y -= 6;
  });

  if (showPrices) {
    ensure(72);
    y -= 4;
    page.drawLine({ start: { x: 360, y }, end: { x: pageSize[0] - margin, y }, thickness: 0.6, color: line });
    y -= 16;
    const totals = [
      ["Netto", formatEuro(document.net)],
      [`USt ${formatNumber(document.taxRate, 0)} %`, formatEuro(document.tax)],
      ["Brutto", formatEuro(document.gross)],
    ];
    totals.forEach((row, index) => {
      page.drawText(row[0], { x: 360, y, size: index === 2 ? 11 : 10, font: index === 2 ? bold : regular, color: ink });
      const valueWidth = (index === 2 ? bold : regular).widthOfTextAtSize(row[1], index === 2 ? 11 : 10);
      page.drawText(row[1], {
        x: pageSize[0] - margin - valueWidth,
        y,
        size: index === 2 ? 11 : 10,
        font: index === 2 ? bold : regular,
        color: ink,
      });
      y -= 15;
    });
    const paid = round2(document.payments.reduce((sum, payment) => sum + payment.amount, 0));
    if (isInvoice(document.type) && paid > 0) {
      page.drawText(`Davon gezahlt ${formatEuro(paid)}, offen ${formatEuro(Math.max(0, document.gross - paid))}.`, {
        x: 360,
        y,
        size: 8,
        font: regular,
        color: muted,
      });
      y -= 14;
    }
  }

  if (document.outro) {
    y -= 8;
    paragraph(document.outro, 10);
  }

  if (isInvoice(document.type)) {
    y -= 8;
    paragraph(
      `Bitte überweisen Sie auf ${company.bankName}, IBAN ${company.iban}, BIC ${company.bic}. Verwendungszweck: ${document.number}.`,
      9,
      muted,
    );
    if (options?.zugferd) {
      paragraph("Dieser PDF liegt der XML-Datensatz factur-x.xml als Dateianhang bei.", 8, muted);
    }
  }

  for (const signature of document.signatures) {
    ensure(110);
    y -= 8;
    page.drawText(`Unterschrift ${signature.signerName}${signature.role ? `, ${signature.role}` : ""}`, {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: ink,
    });
    y -= 8;
    const image = await embedSignature(pdf, signature.dataUrl);
    if (image) {
      const scale = Math.min(180 / image.width, 64 / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ensure(h + 16);
      page.drawImage(image, { x: margin, y: y - h, width: w, height: h });
      y -= h + 8;
    }
    page.drawText(formatDate(signature.signedAt), { x: margin, y, size: 8, font: regular, color: muted });
    y -= 16;
  }

  pages.forEach((printed, index) => {
    const footer = `${company.name} · ${company.street} · ${company.zip} ${company.city} · USt-IdNr. ${company.vatId} · ${company.tradeRegister}`;
    printed.drawText(footer.slice(0, 140), { x: margin, y: 28, size: 7, font: regular, color: muted });
    const pageNo = `${index + 1} / ${pages.length}`;
    printed.drawText(pageNo, { x: pageSize[0] - margin - 28, y: 28, size: 8, font: regular, color: muted });
  });

  pdf.setTitle(`${labelOf(DOC_TYPES, document.type)} ${document.number}`);
  pdf.setAuthor(company.name);
  pdf.setCreator("Werkplan");
  pdf.setProducer("Werkplan");

  if (options?.zugferd) {
    const xml = buildZugferdCii(invoiceXmlFromBundle(bundle));
    const now = new Date();
    await pdf.attach(new TextEncoder().encode(xml), "factur-x.xml", {
      mimeType: "application/xml",
      description: "ZUGFeRD/Factur-X XML (CII), eingebettet von Werkplan",
      creationDate: now,
      modificationDate: now,
      afRelationship: AFRelationship.Alternative,
    });
  }

  return pdf.save();
}

async function embedSignature(pdf: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const match = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (match[1] === "png") return pdf.embedPng(bytes);
  return pdf.embedJpg(bytes);
}
