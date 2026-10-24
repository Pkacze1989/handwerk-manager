import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { extractInvoice } from "../lib/ai/extract-invoice";
import { UPLOAD_ROOT } from "../lib/files";
import { addDaysISO, berlinToday, mondayOf, parseDateInput } from "../lib/format";
import { lineNet, round2, totalsOf } from "../lib/money";

const today = berlinToday();
const monday = mondayOf(today);
const password = hashPassword("baustelle");

function day(iso: string) {
  const parsed = parseDateInput(iso);
  if (!parsed) throw new Error(`Datum ${iso} ungültig`);
  return parsed;
}

function atBerlin(isoDate: string, time: string) {
  const guess = new Date(`${isoDate}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

function recentWorkdays(count: number) {
  const days: string[] = [];
  let cursor = addDaysISO(today, -1);
  while (days.length < count) {
    const [year, month, date] = cursor.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor);
    cursor = addDaysISO(cursor, -1);
  }
  return days.reverse();
}

async function main() {
  await prisma.$transaction([
    prisma.outboxMessage.deleteMany(),
    prisma.calcSnapshot.deleteMany(),
    prisma.calcLine.deleteMany(),
    prisma.calculation.deleteMany(),
    prisma.signature.deleteMany(),
    prisma.sitePhoto.deleteMany(),
    prisma.siteLog.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.projectEmail.deleteMany(),
    prisma.projectFile.deleteMany(),
    prisma.workInstruction.deleteMany(),
    prisma.crewMember.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.measurement.deleteMany(),
    prisma.timeEntry.deleteMany(),
    prisma.dunning.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.documentLine.deleteMany(),
    prisma.document.deleteMany(),
    prisma.incomingInvoice.deleteMany(),
    prisma.receptionNote.deleteMany(),
    prisma.resource.deleteMany(),
    prisma.article.deleteMany(),
    prisma.serviceItem.deleteMany(),
    prisma.project.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.user.deleteMany(),
    prisma.company.deleteMany(),
  ]);

  await prisma.company.create({
    data: {
      id: "company",
      name: "Bergmann Elektrotechnik GmbH",
      street: "Bautzner Straße 112",
      zip: "01099",
      city: "Dresden",
      phone: "0351 6562180",
      email: "buero@bergmann-elektro.example",
      website: "https://bergmann-elektro.example",
      taxNumber: "203/123/45678",
      vatId: "DE291334567",
      bankName: "Ostsächsische Sparkasse Dresden",
      iban: "DE12 8505 0300 3123 4567 89",
      bic: "OSDDDE81XXX",
      tradeRegister: "HRB 38921 Amtsgericht Dresden",
      owner: "Thomas Bergmann",
      datevBerater: "29045",
      datevMandant: "10001",
      datevRevenueAccount: "8400",
      datevExpenseAccount: "3400",
      datevBankAccount: "1200",
      datevAccountLength: 4,
    },
  });

  const people: [string, string, string, string, number, string][] = [
    ["thomas.bergmann@bergmann-elektro.example", "Thomas Bergmann", "INHABER", "0351 6562181", 72, "#1e4638"],
    ["lena.hoffmann@bergmann-elektro.example", "Lena Hoffmann", "BUERO", "0351 6562182", 38, "#3e6b58"],
    ["jonas.weber@bergmann-elektro.example", "Jonas Weber", "MONTEUR", "0172 4401181", 46, "#1f6f8b"],
    ["aylin.demir@bergmann-elektro.example", "Aylin Demir", "MONTEUR", "0172 4401182", 44, "#8a5a12"],
    ["markus.klein@bergmann-elektro.example", "Markus Klein", "MONTEUR", "0172 4401183", 45, "#a45b38"],
    ["tim.schulze@bergmann-elektro.example", "Tim Schulze", "AZUBI", "0172 4401184", 18, "#5c675f"],
  ];
  const [thomas, lena, jonas, aylin, markus, tim] = await Promise.all(
    people.map(([email, name, role, phone, rate, color]) =>
      prisma.user.create({
        data: { email, name, role, phone, hourlyRate: Number(rate), color, passwordHash: password },
      }),
    ),
  );

  const elbflorenz = await prisma.customer.create({
    data: {
      number: "KD-1001",
      name: "Wohnbau Elbflorenz GmbH",
      contact: "Sabine Krüger",
      street: "Königstraße 5",
      zip: "01097",
      city: "Dresden",
      email: "bauleitung@elbflorenz.example",
      phone: "0351 490220",
      vatId: "DE147220981",
      debtorNo: "10001",
      notes: "Rahmenkunde Neubau, Ansprechpartnerin Bauleitung.",
    },
  });
  const richter = await prisma.customer.create({
    data: {
      number: "KD-1002",
      name: "Familie Richter",
      contact: "Frau Richter",
      street: "Augsburger Straße 48",
      zip: "01309",
      city: "Dresden",
      email: "familie.richter@example.com",
      phone: "0351 445599",
      debtorNo: "10002",
    },
  });
  const kita = await prisma.customer.create({
    data: {
      number: "KD-1003",
      name: "Eigenbetrieb Kindertagesstätten Dresden",
      contact: "Amt für Kindertagesbetreuung",
      street: "An der Kreuzkirche 6",
      zip: "01067",
      city: "Dresden",
      email: "rechnung@kita-dresden.example",
      phone: "0351 4880",
      vatId: "DE140135681",
      leitwegId: "14-16051000-45",
      debtorNo: "10003",
      notes: "Öffentlicher Auftraggeber, XRechnung mit Leitweg-ID.",
    },
  });
  const vogel = await prisma.customer.create({
    data: {
      number: "KD-1004",
      name: "Praxis Dr. med. Vogel",
      contact: "Dr. Vogel",
      street: "Borsbergstraße 16",
      zip: "01309",
      city: "Dresden",
      email: "praxis.vogel@example.com",
      phone: "0351 312778",
      debtorNo: "10004",
    },
  });
  const petzold = await prisma.customer.create({
    data: {
      number: "KD-1005",
      name: "Hausverwaltung Petzold",
      contact: "Herr Petzold",
      street: "Pfotenhauerstraße 22",
      zip: "01307",
      city: "Dresden",
      email: "petzold@example.com",
      phone: "0351 445566",
      debtorNo: "10005",
    },
  });

  const nord = await prisma.supplier.create({
    data: {
      number: "LF-201",
      name: "Elektro Großhandel Nord GmbH",
      contact: "Einkauf Theke",
      street: "Magdeburger Straße 20",
      zip: "01067",
      city: "Dresden",
      email: "auftrag@grosshandel-nord.example",
      phone: "0351 800410",
      creditorNo: "70001",
    },
  });
  await prisma.supplier.create({
    data: {
      number: "LF-202",
      name: "Kabelwerk Elbsand GmbH",
      street: "Emerich-Ambros-Ufer 50",
      zip: "01159",
      city: "Dresden",
      email: "vertrieb@elbsand.example",
      phone: "0351 202180",
      creditorNo: "70002",
    },
  });
  await prisma.supplier.create({
    data: {
      number: "LF-203",
      name: "Leuchtenhaus Proksch",
      street: "Alaunstraße 90",
      zip: "01099",
      city: "Dresden",
      email: "proksch@example.com",
      phone: "0351 804433",
      creditorNo: "70003",
    },
  });

  const articles: [string, string, string, number, number, string][] = [
    ["100234", "NYM-J 3x1,5 Mantelleitung", "m", 0.72, 1.35, "nym-j 3x1,5,nym-j 3x1.5"],
    ["100235", "NYM-J 5x2,5 Mantelleitung", "m", 1.85, 3.4, "nym-j 5x2,5"],
    ["200110", "Steckdose Schuko UP reinweiß", "Stk", 4.2, 9.8, "schuko up,schukosteckdose"],
    ["200120", "Ausschalter UP reinweiß", "Stk", 3.8, 8.9, "ausschalter up"],
    ["200121", "Wechselschalter UP reinweiß", "Stk", 4.5, 10.4, "wechselschalter up"],
    ["200180", "Herdanschlussdose", "Stk", 6.4, 16.5, "herdanschlussdose"],
    ["200010", "Hohlwanddose", "Stk", 0.28, 0.85, "hohlwanddose"],
    ["200300", "Datendose CAT6", "Stk", 5.1, 14.5, "datendose,cat6"],
    ["300010", "Unterverteilung 4-reihig", "Stk", 186, 340, "unterverteilung 4-reihig"],
    ["300040", "Leitungsschutzschalter B16", "Stk", 3.1, 7.9, "ls-schalter,b16"],
    ["300041", "FI-Schutzschalter 40A 30mA", "Stk", 28, 64, "fi-schutzschalter,fi 40"],
    ["400200", "LED-Panel 60x60", "Stk", 32, 79, "led-panel,panel 60x60"],
    ["500100", "Kabelkanal 60x40", "m", 3.4, 8.2, "kabelkanal"],
    ["509999", "Brüstungskanal alt", "m", 2, 5, "bruestungskanal alt"],
  ];
  for (const [sku, name, unit, purchasePrice, salesPrice, matchTerms] of articles) {
    await prisma.article.create({ data: { sku, name, unit, purchasePrice, salesPrice, matchTerms, supplierId: nord.id } });
  }

  const services: [string, string, string, string, number, number, number, string][] = [
    ["L-100", "Steckdose setzen und anschließen", "inkl. Kleinmaterial Montage", "Stk", 45, 28, 62, "steckdose,steckdosen"],
    ["L-110", "Schalter setzen und anschließen", "Aus- oder Wechselschalter", "Stk", 40, 24, 54, "ausschalter,wechselschalter,schalter setzen"],
    ["L-200", "Leitung in Mauerwerk verlegen", "inkl. Schlitz", "m", 12, 6.5, 14.8, "leitung mauerwerk,schlitz"],
    ["L-210", "Leitung in Hohlwand verlegen", "auf Trageprofil", "m", 8, 4.2, 9.9, "leitung hohlwand"],
    ["L-300", "Unterverteilung setzen und verdrahten", "inkl. Beschriftung", "Stk", 240, 160, 420, "unterverteilung"],
    ["L-310", "Stromkreis verdrahten", "je Sicherung", "Stk", 30, 18, 46, "stromkreis"],
    ["L-400", "Herdanschluss herstellen", "inkl. Dose", "Stk", 50, 32, 78, "herdanschluss"],
    ["L-500", "Leuchte anschließen", "bauseitige Leuchte", "Stk", 35, 22, 58, "leuchte anschliessen,leuchten montieren"],
    ["L-600", "Kernbohrung bis 80 mm", "Decke oder Wand", "Stk", 25, 18, 49, "kernbohrung,durchbruch"],
    ["L-700", "Prüfung und Messung DIN VDE", "je Wohnung", "Stk", 90, 55, 140, "vde messung,abnahme und messung"],
    ["L-800", "Regiestunde Elektroinstallation", "Fachmonteur", "h", 60, 42, 68, "regiestunde"],
  ];
  for (const [code, name, description, unit, minutes, costPrice, salesPrice, matchTerms] of services) {
    await prisma.serviceItem.create({ data: { code, name, description, unit, minutes, costPrice, salesPrice, matchTerms } });
  }

  const year = new Date().getFullYear();
  const johannstadt = await prisma.project.create({
    data: {
      number: `P-${year}-014`,
      title: "Neubau MFH Johannstadt",
      customerId: elbflorenz.id,
      status: "BAUSTELLE",
      street: "Pfotenhauerstraße 108",
      zip: "01307",
      city: "Dresden",
      description: "Elektroinstallation für acht Wohnungen und den Hausanschlussraum, vom Rohbau bis zur Fertigmontage.",
      startDate: day(addDaysISO(today, -40)),
      endDate: day(addDaysISO(today, 50)),
    },
  });
  const badRichter = await prisma.project.create({
    data: {
      number: `P-${year}-015`,
      title: "Bad- und Küchensanierung Richter",
      customerId: richter.id,
      status: "AUFTRAG",
      street: "Augsburger Straße 48",
      zip: "01309",
      city: "Dresden",
      description: "Erneuerung der Elektroinstallation in Küche und Bad.",
      startDate: day(addDaysISO(today, 7)),
      endDate: day(addDaysISO(today, 18)),
    },
  });
  const kitaProject = await prisma.project.create({
    data: {
      number: `P-${year}-009`,
      title: "Erweiterung Kita Sonnenschein",
      customerId: kita.id,
      status: "ABRECHNUNG",
      street: "Reicker Straße 80",
      zip: "01219",
      city: "Dresden",
      description: "Zusätzliche Gruppe, Beleuchtung und Sicherheitsbeleuchtung.",
      startDate: day(addDaysISO(today, -80)),
      endDate: day(addDaysISO(today, -15)),
    },
  });
  const vogelProject = await prisma.project.create({
    data: {
      number: `P-${year}-004`,
      title: "Beleuchtung Praxis Vogel",
      customerId: vogel.id,
      status: "ABGESCHLOSSEN",
      street: "Borsbergstraße 16",
      zip: "01309",
      city: "Dresden",
      closedAt: day(addDaysISO(today, -20)),
      startDate: day(addDaysISO(today, -70)),
      endDate: day(addDaysISO(today, -25)),
    },
  });
  const herd = await prisma.project.create({
    data: {
      number: `P-${year}-016`,
      title: "Notdienst Herd Pfotenhauerstraße",
      customerId: petzold.id,
      status: "ANFRAGE",
      street: "Pfotenhauerstraße 22",
      zip: "01307",
      city: "Dresden",
      description: "Herd ohne Funktion, FI fällt sofort.",
    },
  });

  async function beleg(input: {
    type: string;
    number: string;
    status: string;
    customerId: string;
    projectId?: string;
    date: string;
    due?: string;
    valid?: string;
    intro: string;
    outro?: string;
    showPrices?: boolean;
    progress?: number;
    source?: string;
    lines: { title: string; description?: string; quantity: number; unit: string; unitPrice: number; sku?: string; source?: string; kind?: string }[];
  }) {
    const prepared = input.lines.map((line, position) => ({
      position,
      kind: line.kind ?? "POSITION",
      title: line.title,
      description: line.description,
      quantity: line.kind === "TEXT" ? 0 : line.quantity,
      unit: line.unit,
      unitPrice: line.kind === "TEXT" ? 0 : line.unitPrice,
      lineTotal: line.kind === "TEXT" ? 0 : lineNet(line.quantity, line.unitPrice),
      sku: line.sku,
      source: line.source ?? "FREE",
    }));
    const totals = totalsOf(prepared, 19);
    return prisma.document.create({
      data: {
        type: input.type,
        number: input.number,
        status: input.status,
        customerId: input.customerId,
        projectId: input.projectId,
        date: day(input.date),
        dueDate: input.due ? day(input.due) : null,
        validUntil: input.valid ? day(input.valid) : null,
        intro: input.intro,
        outro: input.outro,
        showPrices: input.showPrices ?? true,
        progressPercent: input.progress,
        sourceDocumentId: input.source,
        taxRate: 19,
        ...totals,
        lines: { create: prepared },
      },
    });
  }

  const quoteLines = [
    ["Steckdose setzen und anschließen", 120, "Stk", 62, "L-100"],
    ["Schalter setzen und anschließen", 80, "Stk", 54, "L-110"],
    ["Leitung in Hohlwand verlegen", 1800, "m", 9.9, "L-210"],
    ["Unterverteilung setzen und verdrahten", 8, "Stk", 420, "L-300"],
    ["Stromkreis verdrahten", 48, "Stk", 46, "L-310"],
    ["Herdanschluss herstellen", 8, "Stk", 78, "L-400"],
    ["Leuchte anschließen", 40, "Stk", 58, "L-500"],
    ["Prüfung und Messung DIN VDE", 8, "Stk", 140, "L-700"],
    ["NYM-J 3x1,5 Mantelleitung", 1800, "m", 1.35, "100234"],
    ["Steckdose Schuko UP reinweiß", 120, "Stk", 9.8, "200110"],
    ["Unterverteilung 4-reihig", 8, "Stk", 340, "300010"],
  ] as const;
  const angebot = await beleg({
    type: "ANGEBOT",
    number: `ANG-${year}-014`,
    status: "ANGENOMMEN",
    customerId: elbflorenz.id,
    projectId: johannstadt.id,
    date: addDaysISO(today, -55),
    valid: addDaysISO(today, -25),
    intro: "vielen Dank für Ihre Anfrage zum Neubau Johannstadt. Wir bieten die Elektroinstallation wie folgt an.",
    outro: "Das Angebot ist 30 Tage gültig und versteht sich zuzüglich der gesetzlichen Mehrwertsteuer.",
    lines: quoteLines.map(([title, quantity, unit, unitPrice, sku]) => ({ title, quantity, unit, unitPrice, sku, source: sku.startsWith("L-") ? "SERVICE" : "ARTICLE" })),
  });
  const quoteNet = angebot.net;
  await beleg({
    type: "AUFTRAGSBESTAETIGUNG",
    number: `AB-${year}-008`,
    status: "VERSENDET",
    customerId: elbflorenz.id,
    projectId: johannstadt.id,
    date: addDaysISO(today, -48),
    intro: `wir bestätigen den Auftrag gemäß Angebot ${angebot.number}.`,
    outro: "Die Ausführung erfolgt nach dem abgestimmten Bauzeitenplan.",
    source: angebot.id,
    lines: quoteLines.slice(0, 4).map(([title, quantity, unit, unitPrice, sku]) => ({ title, quantity, unit, unitPrice, sku })),
  });
  await beleg({
    type: "LIEFERSCHEIN",
    number: `LS-${year}-021`,
    status: "VERSENDET",
    customerId: elbflorenz.id,
    projectId: johannstadt.id,
    date: addDaysISO(today, -6),
    showPrices: false,
    intro: "folgende Materialien wurden auf der Baustelle Johannstadt abgeladen.",
    outro: "Bitte prüfen Sie die Lieferung bei Erhalt.",
    lines: [
      { title: "NYM-J 3x1,5 Mantelleitung", quantity: 400, unit: "m", unitPrice: 1.35, sku: "100234" },
      { title: "Steckdose Schuko UP reinweiß", quantity: 60, unit: "Stk", unitPrice: 9.8, sku: "200110" },
      { title: "Hohlwanddose", quantity: 80, unit: "Stk", unitPrice: 0.85, sku: "200010" },
    ],
  });
  const abschlagNet = round2(quoteNet * 0.4);
  const abschlag = await beleg({
    type: "ABSCHLAG_KUMULATIV",
    number: `AR-${year}-003`,
    status: "TEILBEZAHLT",
    customerId: elbflorenz.id,
    projectId: johannstadt.id,
    date: addDaysISO(today, -20),
    due: addDaysISO(today, -6),
    progress: 40,
    source: angebot.id,
    intro: "erster kumulierter Abschlag auf den beauftragten Leistungsumfang, Leistungsstand 40 Prozent.",
    outro: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    lines: [{ title: `Kumulierte Leistung 40 % laut ${angebot.number}`, quantity: 1, unit: "psch", unitPrice: abschlagNet }],
  });
  await prisma.payment.create({
    data: { documentId: abschlag.id, date: day(addDaysISO(today, -8)), amount: 10000, method: "UEBERWEISUNG", note: "Teilzahlung Elbflorenz" },
  });

  const kitaPaid = await beleg({
    type: "ABSCHLAG_PAUSCHAL",
    number: `AR-${year}-001`,
    status: "BEZAHLT",
    customerId: kita.id,
    projectId: kitaProject.id,
    date: addDaysISO(today, -50),
    due: addDaysISO(today, -36),
    intro: "pauschaler Abschlag für die Erweiterung der Kita Sonnenschein.",
    lines: [{ title: "Abschlag pauschal Rohinstallation", quantity: 1, unit: "psch", unitPrice: 5000 }],
  });
  await prisma.payment.create({ data: { documentId: kitaPaid.id, date: day(addDaysISO(today, -34)), amount: kitaPaid.gross, method: "UEBERWEISUNG" } });

  const kitaOpen = await beleg({
    type: "ABSCHLAG_PAUSCHAL",
    number: `AR-${year}-004`,
    status: "OFFEN",
    customerId: kita.id,
    projectId: kitaProject.id,
    date: addDaysISO(today, -18),
    due: addDaysISO(today, -4),
    intro: "zweiter pauschaler Abschlag nach Fertigmontage der Beleuchtung.",
    lines: [{ title: "Abschlag pauschal Fertigmontage", quantity: 1, unit: "psch", unitPrice: 3500 }],
  });
  const reminder = `Zahlungserinnerung zu ${kitaOpen.number}\n\nGuten Tag,\n\nfreundliche Erinnerung: zu Rechnung ${kitaOpen.number} stehen noch ${kitaOpen.gross.toFixed(2)} EUR offen.\n\nMit freundlichen Grüßen\nBergmann Elektrotechnik GmbH`;
  const dunning = await prisma.dunning.create({
    data: { documentId: kitaOpen.id, level: "ERINNERUNG", fee: 0, text: reminder, status: "VERSENDET", sentAt: day(addDaysISO(today, -2)) },
  });
  await prisma.outboxMessage.create({
    data: {
      kind: "ERINNERUNG",
      toAddr: kita.email!,
      subject: `Zahlungserinnerung ${kitaOpen.number}`,
      body: reminder,
      status: "VERSENDET",
      relatedId: dunning.id,
      sentAt: day(addDaysISO(today, -2)),
    },
  });

  const schluss = await beleg({
    type: "SCHLUSSRECHNUNG",
    number: `RE-${year}-002`,
    status: "BEZAHLT",
    customerId: vogel.id,
    projectId: vogelProject.id,
    date: addDaysISO(today, -30),
    due: addDaysISO(today, -16),
    intro: "wir berechnen die erneuerte Beleuchtung der Praxis.",
    lines: [
      { title: "LED-Panel 60x60 liefern und montieren", quantity: 8, unit: "Stk", unitPrice: 189, sku: "400200" },
      { title: "Kabelkanal 60x40", quantity: 22, unit: "m", unitPrice: 18.5, sku: "500100" },
    ],
  });
  await prisma.payment.create({ data: { documentId: schluss.id, date: day(addDaysISO(today, -14)), amount: schluss.gross, method: "UEBERWEISUNG" } });

  await beleg({
    type: "ANGEBOT",
    number: `ANG-${year}-018`,
    status: "VERSENDET",
    customerId: richter.id,
    projectId: badRichter.id,
    date: addDaysISO(today, -4),
    valid: addDaysISO(today, 26),
    intro: "vielen Dank für die Besichtigung. Für Küche und Bad bieten wir an:",
    lines: [
      { title: "Steckdose setzen und anschließen", quantity: 12, unit: "Stk", unitPrice: 62, sku: "L-100" },
      { title: "Schalter setzen und anschließen", quantity: 4, unit: "Stk", unitPrice: 54, sku: "L-110" },
      { title: "Herdanschluss herstellen", quantity: 1, unit: "Stk", unitPrice: 78, sku: "L-400" },
      { title: "Unterverteilung setzen und verdrahten", quantity: 1, unit: "Stk", unitPrice: 420, sku: "L-300" },
      { title: "NYM-J 3x1,5 Mantelleitung", quantity: 25, unit: "m", unitPrice: 1.35, sku: "100234" },
    ],
  });

  const regie = await beleg({
    type: "REGIEBERICHT",
    number: `REG-${year}-001`,
    status: "ENTWURF",
    customerId: elbflorenz.id,
    projectId: johannstadt.id,
    date: addDaysISO(today, -1),
    intro: "zusätzlich beauftragte Kernbohrung im Hausanschlussraum.",
    lines: [{ title: "Kernbohrung bis 80 mm", quantity: 2, unit: "Stk", unitPrice: 49, sku: "L-600" }],
  });

  await mkdir(UPLOAD_ROOT, { recursive: true });
  const photos = ["rohbau-eg.png", "uv-schacht.png", "grundriss-eg.png", "signatur-bauleiter.png"];
  for (const name of photos) {
    await copyFile(path.join(process.cwd(), "samples/fotos", name), path.join(UPLOAD_ROOT, name));
  }
  const signature = `data:image/png;base64,${(await readFile(path.join(UPLOAD_ROOT, "signatur-bauleiter.png"))).toString("base64")}`;
  await prisma.signature.create({
    data: { documentId: regie.id, signerName: "Sabine Krüger", role: "Bauleitung", dataUrl: signature, signedAt: day(addDaysISO(today, -1)) },
  });

  const resources = {
    jonas: await prisma.resource.create({ data: { type: "MITARBEITER", name: "Jonas Weber", userId: jonas.id } }),
    aylin: await prisma.resource.create({ data: { type: "MITARBEITER", name: "Aylin Demir", userId: aylin.id } }),
    markus: await prisma.resource.create({ data: { type: "MITARBEITER", name: "Markus Klein", userId: markus.id } }),
    tim: await prisma.resource.create({ data: { type: "MITARBEITER", name: "Tim Schulze", userId: tim.id } }),
    crew: await prisma.resource.create({ data: { type: "KOLONNE", name: "Kolonne Johannstadt", details: "Rohbau und Fertigmontage" } }),
    hammer: await prisma.resource.create({ data: { type: "MASCHINE", name: "Kombihammer 3,5 J", details: "Hausanschluss und Schlitze" } }),
    winch: await prisma.resource.create({ data: { type: "MASCHINE", name: "Kabelzugwinde", details: "Steigeschacht" } }),
    van: await prisma.resource.create({ data: { type: "FAHRZEUG", name: "Transporter DD-BK 240" } }),
    caddy: await prisma.resource.create({ data: { type: "FAHRZEUG", name: "Caddy DD-EL 88" } }),
  };
  await prisma.crewMember.createMany({ data: [{ crewId: resources.crew.id, userId: jonas.id }, { crewId: resources.crew.id, userId: aylin.id }] });
  const friday = addDaysISO(monday, 4);
  const nextMonday = addDaysISO(monday, 7);
  const nextWednesday = addDaysISO(monday, 9);
  await prisma.assignment.createMany({
    data: [
      { resourceId: resources.crew.id, projectId: johannstadt.id, startDate: day(monday), endDate: day(friday), note: "EG Wohnungen 1–4" },
      { resourceId: resources.van.id, projectId: johannstadt.id, startDate: day(monday), endDate: day(friday) },
      { resourceId: resources.hammer.id, projectId: johannstadt.id, startDate: day(monday), endDate: day(friday) },
      { resourceId: resources.markus.id, projectId: badRichter.id, userId: markus.id, startDate: day(addDaysISO(monday, 3)), endDate: day(friday), note: "Aufmaß Küche" },
      { resourceId: resources.caddy.id, projectId: badRichter.id, startDate: day(addDaysISO(monday, 3)), endDate: day(friday) },
      { resourceId: resources.crew.id, projectId: johannstadt.id, startDate: day(nextMonday), endDate: day(nextWednesday), note: "OG Nord" },
      { resourceId: resources.jonas.id, projectId: johannstadt.id, userId: jonas.id, startDate: day(today), endDate: day(today), note: "Unterverteilung Wohnung 4" },
    ],
  });

  for (const iso of recentWorkdays(4)) {
    await prisma.timeEntry.createMany({
      data: [
        { userId: jonas.id, projectId: johannstadt.id, type: "FAHRT", start: atBerlin(iso, "06:30"), end: atBerlin(iso, "07:00") },
        { userId: jonas.id, projectId: johannstadt.id, type: "ARBEIT", start: atBerlin(iso, "07:00"), end: atBerlin(iso, "12:00"), note: "Steckdosen EG" },
        { userId: jonas.id, projectId: johannstadt.id, type: "PAUSE", start: atBerlin(iso, "12:00"), end: atBerlin(iso, "12:30") },
        { userId: jonas.id, projectId: johannstadt.id, type: "ARBEIT", start: atBerlin(iso, "12:30"), end: atBerlin(iso, "16:00") },
        { userId: aylin.id, projectId: johannstadt.id, type: "ARBEIT", start: atBerlin(iso, "07:00"), end: atBerlin(iso, "15:30") },
      ],
    });
  }
  const wet = recentWorkdays(1)[0];
  await prisma.timeEntry.create({
    data: { userId: aylin.id, projectId: johannstadt.id, type: "SCHLECHTWETTER", start: atBerlin(wet, "15:30"), end: atBerlin(wet, "16:30"), note: "Regen, Außenbereich abgebrochen" },
  });
  await prisma.timeEntry.create({
    data: { userId: tim.id, type: "URLAUB", start: atBerlin(addDaysISO(today, -2), "07:00"), end: atBerlin(addDaysISO(today, -2), "16:00"), note: "Berufsschule frei" },
  });
  await prisma.timeEntry.create({
    data: { userId: jonas.id, projectId: johannstadt.id, type: "ARBEIT", start: new Date(Date.now() - 2.5 * 60 * 60 * 1000), note: "Unterverteilung Wohnung 4" },
  });

  await prisma.measurement.createMany({
    data: [
      { projectId: johannstadt.id, title: "Wohnzimmer Wohnung 2", kind: "FLAECHE", formula: "l * b", inputsJson: JSON.stringify({ l: 5.4, b: 3.8 }), result: round2(5.4 * 3.8), unit: "m²" },
      { projectId: johannstadt.id, title: "Küchenzeile Leitung", kind: "LAENGE", formula: "laenge", inputsJson: JSON.stringify({ laenge: 12.5 }), result: 12.5, unit: "m" },
      { projectId: johannstadt.id, title: "Dosen Wohnung 3", kind: "STUECK", formula: "n", inputsJson: JSON.stringify({ n: 14 }), result: 14, unit: "Stk" },
      { projectId: badRichter.id, title: "Kabelzugabe Bad", kind: "FORMEL", formula: "(l + b) * 2 * 1.1", inputsJson: JSON.stringify({ l: 3.2, b: 2.4 }), result: round2((3.2 + 2.4) * 2 * 1.1), unit: "m", note: "Umfang mit 10 Prozent Zugabe" },
    ],
  });

  const log = await prisma.siteLog.create({
    data: {
      projectId: johannstadt.id,
      userId: jonas.id,
      date: day(addDaysISO(today, -1)),
      kind: "FORTSCHRITT",
      text: "EG Wohnungen 1 bis 3: Steckdosen gesetzt, Leitungen Küche gezogen. UV Wohnung 4 vormontiert.",
      weather: "trocken, 11 °C",
      materials: "40 Steckdosen, 180 m NYM-J 3x1,5",
      hours: 8,
    },
  });
  await prisma.sitePhoto.create({ data: { siteLogId: log.id, projectId: johannstadt.id, path: "rohbau-eg.png", fileName: "rohbau-eg.png", caption: "Rohbau EG" } });
  await prisma.sitePhoto.create({ data: { projectId: johannstadt.id, path: "uv-schacht.png", fileName: "uv-schacht.png", caption: "Unterverteilung Schacht" } });
  const regieLog = await prisma.siteLog.create({
    data: {
      projectId: johannstadt.id,
      userId: jonas.id,
      date: day(addDaysISO(today, -1)),
      kind: "REGIE",
      text: "Zwei Kernbohrungen Hausanschlussraum, vom Statiker freigegeben.",
      materials: "Kombihammer, Kernbohrer 80 mm",
      hours: 1.5,
    },
  });
  await prisma.signature.create({ data: { siteLogId: regieLog.id, signerName: "Sabine Krüger", role: "Bauleitung", dataUrl: signature } });

  await prisma.projectFile.createMany({
    data: [
      { projectId: johannstadt.id, kind: "PLAN", name: "Grundriss EG", path: "grundriss-eg.png", mime: "image/png" },
      { projectId: johannstadt.id, kind: "BILD", name: "Rohbau EG", path: "rohbau-eg.png", mime: "image/png" },
      { projectId: johannstadt.id, kind: "BILD", name: "Unterverteilung", path: "uv-schacht.png", mime: "image/png" },
    ],
  });
  await prisma.projectEmail.createMany({
    data: [
      {
        projectId: johannstadt.id,
        direction: "EINGANG",
        fromAddr: "architekt@elbflorenz.example",
        toAddr: "buero@bergmann-elektro.example",
        subject: "Planstand EG Revision C",
        body: "Anbei der überarbeitete Grundriss. Die Kücheninsel in Wohnung 2 wandert um 40 cm, bitte die Steckdosen nachziehen.",
        sentAt: day(addDaysISO(today, -3)),
      },
      {
        projectId: johannstadt.id,
        direction: "AUSGANG",
        fromAddr: "lena.hoffmann@bergmann-elektro.example",
        toAddr: "auftrag@grosshandel-nord.example",
        subject: "Abruf NYM und Dosen",
        body: "Bitte 400 m NYM-J 3x1,5 und 60 Schukosteckdosen auf die Baustelle Pfotenhauerstraße 108 liefern.",
        sentAt: day(addDaysISO(today, -7)),
      },
    ],
  });
  await prisma.chatMessage.createMany({
    data: [
      { projectId: johannstadt.id, userId: lena.id, body: "@Jonas Weber Der FI 40A/30mA ist bestellt und kommt morgen früh mit dem Transporter.", mentions: jonas.id, createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000) },
      { projectId: johannstadt.id, userId: jonas.id, body: "Danke. In Wohnung 2 fehlt noch die Herdanschlussdose, sonst sind die Steckdosen EG durch.", createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000) },
      { projectId: johannstadt.id, userId: aylin.id, body: "Foto vom Schacht. @Lena Hoffmann Bitte den Planstand C in die Akte legen.", imagePath: "uv-schacht.png", imageName: "uv-schacht.png", mentions: lena.id, createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    ],
  });

  await prisma.workInstruction.create({
    data: {
      projectId: johannstadt.id,
      assigneeId: jonas.id,
      authorId: lena.id,
      title: "UV Wohnung 4 verdrahten",
      body: "Beschriftung nach Stromkreisverzeichnis Rev. C. FI und acht B16 setzen, Deckel erst nach Messung schließen.",
      materials: JSON.stringify([
        { text: "Unterverteilung 4-reihig", done: true },
        { text: "FI 40A 30mA", done: false },
        { text: "8× LS B16", done: false },
      ]),
      status: "IN_ARBEIT",
      dueDate: day(addDaysISO(today, 1)),
    },
  });
  await prisma.workInstruction.create({
    data: {
      projectId: johannstadt.id,
      assigneeId: aylin.id,
      authorId: thomas.id,
      title: "Steckdosen OG Nord",
      body: "Dosen nach Grundriss setzen, noch nicht anklemmen. Küche auslassen bis der neue Plan liegt.",
      materials: JSON.stringify([
        { text: "24× Steckdose Schuko", done: false },
        { text: "24× Hohlwanddose", done: false },
      ]),
      status: "OFFEN",
      dueDate: day(nextWednesday),
    },
  });
  await prisma.workInstruction.create({
    data: {
      projectId: badRichter.id,
      assigneeId: markus.id,
      authorId: lena.id,
      title: "Herdanschluss Küche vorbereiten",
      body: "Leitung 5x2,5 bis zur vorgesehenen Dose legen, Anschluss nach Freigabe der Küchenplanung.",
      materials: JSON.stringify([{ text: "NYM-J 5x2,5", done: false }, { text: "Herdanschlussdose", done: false }]),
      status: "OFFEN",
      dueDate: day(addDaysISO(today, 6)),
    },
  });

  const calc = await prisma.calculation.create({
    data: { projectId: badRichter.id, title: "Vorkalkulation Küche und Bad", surchargePercent: 18, marginPercent: 12 },
  });
  await prisma.calcLine.createMany({
    data: [
      { calculationId: calc.id, category: "MATERIAL", title: "NYM, Dosen, UV-Feld", quantity: 1, unit: "psch", unitCost: 640, surchargePercent: 18 },
      { calculationId: calc.id, category: "LOHN", title: "Montage zwei Tage", quantity: 16, unit: "h", unitCost: 45, surchargePercent: 18 },
      { calculationId: calc.id, category: "GERAET", title: "Kernbohrgerät", quantity: 1, unit: "Tag", unitCost: 85, surchargePercent: 10 },
      { calculationId: calc.id, category: "NACHUNTERNEHMER", title: "Schlitze Trockenbau", quantity: 1, unit: "psch", unitCost: 280, surchargePercent: 8 },
    ],
  });

  await prisma.calcSnapshot.create({
    data: {
      projectId: johannstadt.id,
      label: "Rohbau EG",
      takenAt: day(addDaysISO(today, -5)),
      sollNet: quoteNet,
      istCost: 8200,
      invoiced: abschlag.net,
      profit: round2(abschlag.net - 8200),
      detailJson: JSON.stringify({ note: "Stand vor der Fertigmontage OG" }),
    },
  });

  const invoiceDate = addDaysISO(today, -12);
  const [invoiceYear, invoiceMonth, invoiceDay] = invoiceDate.split("-");
  const raw = await readFile(path.join(process.cwd(), "samples/eingang/rechnung-nord.txt"), "utf8");
  const rewritten = raw.replace("12.10.2026", `${invoiceDay}.${invoiceMonth}.${invoiceYear}`);
  await writeFile(path.join(UPLOAD_ROOT, "rechnung-nord.txt"), rewritten);
  const extracted = extractInvoice(rewritten, "rechnung-nord.txt");
  if (extracted.gross !== 1761.8 || extracted.number !== "ER-2026-1182") {
    throw new Error(`Extractor unerwartet: ${JSON.stringify(extracted)}`);
  }
  await prisma.incomingInvoice.create({
    data: {
      supplierId: nord.id,
      supplierName: extracted.supplierName,
      projectId: johannstadt.id,
      number: extracted.number!,
      date: day(extracted.date!),
      net: extracted.net!,
      tax: extracted.tax!,
      gross: extracted.gross,
      filePath: "rechnung-nord.txt",
      fileName: "rechnung-nord.txt",
      rawText: rewritten,
      notes: extracted.notes.join("\n"),
      status: "GEBUCHT",
    },
  });

  await prisma.receptionNote.create({
    data: {
      customerId: petzold.id,
      projectId: herd.id,
      callerName: "Herr Petzold",
      phone: "0351 445566",
      concern: "Herd ohne Funktion, der FI-Schutzschalter fällt sofort.",
      urgency: "NOTDIENST",
      simulated: true,
    },
  });

  console.log("Werkplan-Demo steht bereit. Anmeldung mit Passwort baustelle.");
  console.log(`Angebot ${angebot.number}: netto ${quoteNet.toFixed(2)} EUR, Abschlag ${abschlag.number}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
