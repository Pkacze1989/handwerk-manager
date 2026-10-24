export const DOC_TYPES = [
  ["ANGEBOT", "Angebot"],
  ["AUFTRAGSBESTAETIGUNG", "Auftragsbestätigung"],
  ["LIEFERSCHEIN", "Lieferschein"],
  ["ABSCHLAG_PAUSCHAL", "Abschlagsrechnung (pauschal)"],
  ["ABSCHLAG_KUMULATIV", "Abschlagsrechnung (kumulativ)"],
  ["SCHLUSSRECHNUNG", "Schlussrechnung"],
  ["ABNAHME", "Abnahmeprotokoll"],
  ["REGIEBERICHT", "Regiebericht"],
  ["STUNDENNACHWEIS", "Stundennachweis"],
] as const;

export const INVOICE_TYPES = ["ABSCHLAG_PAUSCHAL", "ABSCHLAG_KUMULATIV", "SCHLUSSRECHNUNG"] as const;

export const DOC_STATUS = [
  ["ENTWURF", "Entwurf"],
  ["VERSENDET", "Versendet"],
  ["ANGENOMMEN", "Angenommen"],
  ["ABGELEHNT", "Abgelehnt"],
  ["OFFEN", "Offen"],
  ["TEILBEZAHLT", "Teilbezahlt"],
  ["BEZAHLT", "Bezahlt"],
  ["STORNIERT", "Storniert"],
] as const;

export const PROJECT_STATUS = [
  ["ANFRAGE", "Anfrage"],
  ["ANGEBOT", "Angebot"],
  ["AUFTRAG", "Auftrag"],
  ["BAUSTELLE", "Baustelle"],
  ["ABRECHNUNG", "Abrechnung"],
  ["ABGESCHLOSSEN", "Abgeschlossen"],
] as const;

export const TIME_TYPES = [
  ["ARBEIT", "Arbeit"],
  ["FAHRT", "Fahrt"],
  ["PAUSE", "Pause"],
  ["SCHLECHTWETTER", "Schlechtwetter"],
  ["URLAUB", "Urlaub"],
] as const;

export const PAID_TIME = new Set(["ARBEIT", "FAHRT", "SCHLECHTWETTER"]);

export const MEASURE_KINDS = [
  ["LAENGE", "Länge"],
  ["FLAECHE", "Fläche"],
  ["VOLUMEN", "Volumen"],
  ["STUECK", "Stück"],
  ["FORMEL", "Formel"],
] as const;

export const RESOURCE_TYPES = [
  ["MITARBEITER", "Mitarbeiter"],
  ["KOLONNE", "Kolonne"],
  ["MASCHINE", "Maschine"],
  ["FAHRZEUG", "Fahrzeug"],
] as const;

export const ROLES = [
  ["INHABER", "Inhaber"],
  ["BUERO", "Büro"],
  ["MONTEUR", "Monteur"],
  ["AZUBI", "Azubi"],
] as const;

export const URGENCY = [
  ["NIEDRIG", "Niedrig"],
  ["NORMAL", "Normal"],
  ["HOCH", "Hoch"],
  ["NOTDIENST", "Notdienst"],
] as const;

export const CALC_CATEGORIES = [
  ["MATERIAL", "Material"],
  ["LOHN", "Lohn"],
  ["GERAET", "Geräte"],
  ["NACHUNTERNEHMER", "Nachunternehmer"],
] as const;

export const LOG_KINDS = [
  ["FORTSCHRITT", "Baufortschritt"],
  ["MATERIAL", "Materialverbrauch"],
  ["REGIE", "Regie"],
  ["ABNAHME", "Abnahme"],
] as const;

export const FILE_KINDS = [
  ["PLAN", "Plan"],
  ["BILD", "Bild"],
  ["DOKUMENT", "Dokument"],
  ["SONSTIGES", "Sonstiges"],
] as const;

export function labelOf(list: readonly (readonly [string, string])[], value: string) {
  return list.find((entry) => entry[0] === value)?.[1] ?? value;
}

export function isInvoice(type: string) {
  return (INVOICE_TYPES as readonly string[]).includes(type);
}

export function statusTone(status: string): "neutral" | "good" | "warn" | "bad" | "copper" {
  if (["BEZAHLT", "ANGENOMMEN", "ABGESCHLOSSEN", "ERLEDIGT", "GEBUCHT"].includes(status)) return "good";
  if (["OFFEN", "TEILBEZAHLT", "BAUSTELLE", "IN_ARBEIT", "HOCH"].includes(status)) return "warn";
  if (["STORNIERT", "ABGELEHNT", "NOTDIENST"].includes(status)) return "bad";
  if (["ANGEBOT", "AUFTRAG", "ABRECHNUNG"].includes(status)) return "copper";
  return "neutral";
}

export const DOC_PREFIX: Record<string, string> = {
  ANGEBOT: "ANG",
  AUFTRAGSBESTAETIGUNG: "AB",
  LIEFERSCHEIN: "LS",
  ABSCHLAG_PAUSCHAL: "AR",
  ABSCHLAG_KUMULATIV: "AR",
  SCHLUSSRECHNUNG: "RE",
  ABNAHME: "ABN",
  REGIEBERICHT: "REG",
  STUNDENNACHWEIS: "STD",
};
