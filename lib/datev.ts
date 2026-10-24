import iconv from "iconv-lite";
import JSZip from "jszip";
import { round2 } from "./money";

export type DatevBooking = {
  amount: number;
  debitCredit: "S" | "H";
  account: string;
  contraAccount: string;
  date: Date;
  documentNumber: string;
  text: string;
};

export type DatevParty = {
  account: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  number: string;
  extra?: string;
};

function quote(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function amount(value: number) {
  return round2(value).toFixed(2).replace(".", ",");
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function ddmm(date: Date) {
  const iso = date.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
}

function stamp(date: Date) {
  return `${ymd(date)}${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}000`;
}

function crlf(lines: string[]) {
  return `${lines.join("\r\n")}\r\n`;
}

export const DATEV_BOOKING_COLUMNS = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
] as const;

export function buildExtfBookings(options: {
  bookings: DatevBooking[];
  from: Date;
  to: Date;
  consultant: string;
  client: string;
  accountLength: number;
  exportedBy: string;
  label: string;
}) {
  const header = [
    quote("EXTF"),
    "700",
    "21",
    quote("Buchungsstapel"),
    "9",
    stamp(new Date()),
    "",
    quote("WP"),
    quote(options.exportedBy.slice(0, 25)),
    "",
    options.consultant || "0",
    options.client || "0",
    ymd(new Date(Date.UTC(options.from.getUTCFullYear(), 0, 1))),
    String(options.accountLength || 4),
    ymd(options.from),
    ymd(options.to),
    quote(options.label.slice(0, 30)),
    quote("WP"),
    "1",
    "0",
    "0",
    quote("EUR"),
    "",
    "",
    "",
  ].join(";");

  const columns = DATEV_BOOKING_COLUMNS.map((column) => quote(column)).join(";");
  const rows = options.bookings.map((booking) =>
    [
      amount(booking.amount),
      quote(booking.debitCredit),
      quote("EUR"),
      "",
      "",
      "",
      booking.account,
      booking.contraAccount,
      "",
      ddmm(booking.date),
      quote(booking.documentNumber.slice(0, 36)),
      quote(ymd(booking.date)),
      "",
      quote(booking.text.slice(0, 60)),
    ].join(";"),
  );
  return crlf([header, columns, ...rows]);
}

export function buildPartyCsv(kind: "debitor" | "kreditor", parties: DatevParty[]) {
  const header =
    kind === "debitor"
      ? "Kontonummer;Name;Strasse;PLZ;Ort;Land;E-Mail;Telefon;Kundennummer;Leitweg-ID"
      : "Kontonummer;Name;Strasse;PLZ;Ort;Land;E-Mail;Telefon;Lieferantennummer";
  const rows = parties.map((party) =>
    [
      party.account,
      party.name,
      party.street,
      party.zip,
      party.city,
      "DE",
      party.email,
      party.phone,
      party.number,
      party.extra ?? "",
    ]
      .map((value) => quote(value))
      .join(";"),
  );
  return crlf([header, ...rows]);
}

export function datevReadme() {
  return `Werkplan DATEV-Export (Teilmenge, kein zertifizierter DATEV-Export)
=====================================================================

Dateien
-------
EXTF_Buchungsstapel.csv
  Windows-1252, CRLF, Semikolon.
  Zeile 1: EXTF-Kopf (Kennzeichen EXTF, Version 700, Kategorie 21,
  Formatname Buchungsstapel, Formatversion 9).
  Zeile 2: Spaltenüberschriften.
  Ab Zeile 3: Buchungen.

EXT_Debitoren.csv / EXT_Kreditoren.csv
  Windows-1252, CRLF, Semikolon, Textfelder in Anführungszeichen.
  Stammdaten der in den Buchungen verwendeten Personenkonten.

Kodierung
---------
Die CSV-Dateien sind Windows-1252, wie im DATEV-Umfeld üblich.
Diese LESEN.txt ist UTF-8.

Spalten EXTF_Buchungsstapel.csv
-------------------------------
Umsatz (ohne Soll/Haben-Kz)
  Bruttobetrag mit Komma als Dezimalzeichen, ohne Tausenderpunkt.
Soll/Haben-Kennzeichen
  S oder H aus Sicht des Kontos.
WKZ Umsatz
  EUR.
Kurs, Basis-Umsatz, WKZ Basis-Umsatz
  Leer.
Konto
  Personenkonto (Debitor ab 10000) oder Sachkonto (Aufwand/Bank).
Gegenkonto (ohne BU-Schlüssel)
  Erlöskonto (Vorgabe 8400, 19 % USt im Konto), Kreditor oder Debitor.
BU-Schlüssel
  Leer. Steuer steckt in den Automatikkonten 8400 / 3400.
Belegdatum
  TTMM. Das Jahr steht im EXTF-Kopf (Datum von/bis) und zusätzlich in Belegfeld 2.
Belegfeld 1
  Belegnummer.
Belegfeld 2
  Belegdatum JJJJMMTT.
Skonto
  Leer.
Buchungstext
  Maximal 60 Zeichen.

Buchungslogik (SKR03-nah, Anhalt)
---------------------------------
Ausgangsrechnung: Soll Debitor, Gegenkonto Erlöskonto, Umsatz = Brutto.
Zahlung dazu:    Soll Bankkonto, Gegenkonto Debitor, Umsatz = Zahlbetrag.
Eingangsrechnung: Soll Aufwandskonto, Gegenkonto Kreditor, Umsatz = Brutto.

Konten, Berater- und Mandantennummer kommen aus den Betriebsdaten.
Es wird kein Festschreibungs- oder ASCII-Prüfprotokoll erzeugt.
`;
}

export async function buildDatevZip(files: { name: string; content: string; encoding: "win1252" | "utf8" }[]) {
  const zip = new JSZip();
  for (const file of files) {
    if (file.encoding === "utf8") zip.file(file.name, file.content);
    else zip.file(file.name, iconv.encode(file.content, "win1252"));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}
